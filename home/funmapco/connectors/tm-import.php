<?php
/**
 * tm-import.php — tm_staging → posts
 *
 * One FunMap post per attraction (touring act / named event).
 * One map card per venue within that attraction.
 * One session row per performance at that venue.
 *
 * Parameters:
 *   limit — max attractions to process per run (default: 50, max: 200)
 */

declare(strict_types=1);

// ── Bootstrap ─────────────────────────────────────────────────────────────────

$configDbCandidates = [
    __DIR__ . '/../config/config-db.php',
    dirname(__DIR__) . '/config/config-db.php',
    dirname(__DIR__, 2) . '/config/config-db.php',
    dirname(__DIR__, 3) . '/../config/config-db.php',
    dirname(__DIR__) . '/../config/config-db.php',
];

$mysqli = null;
foreach ($configDbCandidates as $p) { if (is_file($p)) { require_once $p; break; } }

if (!isset($mysqli) || !($mysqli instanceof mysqli)) die('ERROR: No database connection.');
$mysqli->set_charset('utf8mb4');

// ── Constants ──────────────────────────────────────────────────────────────────

const TM_MEMBER_ID   = 213;
const TM_MEMBER_ROLE = 'member';
const TM_MEMBER_NAME = 'Ticketmaster';
const TM_ATTRIBUTION = 'Powered by Ticketmaster';
const MIN_IMAGE_WIDTH = 1000;

const SEGMENT_MAP = [
    'Music'          => 'live-music',
    'Sports'         => 'live-sport',
    'Arts & Theatre' => 'performing-arts',
    'Film'           => 'cinema',
    'Miscellaneous'  => 'other-events',
];

const GENRE_OVERRIDES = [
    'Festival'  => 'festivals',
    'Festivals' => 'festivals',
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function tmGroupKey(array $event): string {
    return 'A_' . ($event['_embedded']['attractions'][0]['id'] ?? 'unknown');
}

/**
 * Session ticket group key: 0→A, 1→B … 25→Z, 26→AA …
 */
function sessionKey(int $n): string {
    $a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if ($n < 26) return $a[$n];
    return $a[intdiv($n, 26) - 1] . $a[$n % 26];
}

/**
 * Find the best (widest ≥ MIN_IMAGE_WIDTH) image across all events in the group.
 */
function bestImage(array $events): ?array {
    $best = null;
    foreach ($events as $event) {
        foreach (($event['images'] ?? []) as $img) {
            if (($img['width'] ?? 0) >= MIN_IMAGE_WIDTH) {
                if (!$best || $img['width'] > $best['width']) $best = $img;
            }
        }
    }
    return $best;
}

/**
 * Description from the first event in the group that has info text.
 */
function groupDescription(array $events): string {
    foreach ($events as $event) {
        $info  = trim($event['info']       ?? '');
        $note  = trim($event['pleaseNote'] ?? '');
        $parts = array_filter([$info, $note ? 'Please note: ' . $note : '']);
        if ($parts) return implode("\n\n", $parts) . "\n\n" . TM_ATTRIBUTION;
    }
    return TM_ATTRIBUTION;
}

/**
 * Subcategory key with genre overrides.
 */
function groupSubcategory(array $events): string {
    $segment = $events[0]['classifications'][0]['segment']['name'] ?? 'Miscellaneous';
    $genre   = $events[0]['classifications'][0]['genre']['name']   ?? '';
    if (isset(GENRE_OVERRIDES[$genre])) return GENRE_OVERRIDES[$genre];
    return SEGMENT_MAP[$segment] ?? 'other-events';
}

/**
 * Date-range summary string for a set of events (already sorted by date).
 */
function sessionSummary(array $events): string {
    $first = $events[0]['dates']['start']['localDate']                   ?? '';
    $last  = $events[count($events) - 1]['dates']['start']['localDate'] ?? '';
    if (count($events) === 1) {
        $t = $events[0]['dates']['start']['localTime'] ?? '00:00:00';
        return date('j M Y', strtotime($first)) . ', ' . substr($t, 0, 5);
    }
    return date('j M Y', strtotime($first)) . ' – ' . date('j M Y', strtotime($last));
}

/**
 * Lowest price + currency across a set of events.
 */
function priceSummary(array $events): ?string {
    $minPrice = null; $currency = null;
    foreach ($events as $e) {
        foreach (($e['priceRanges'] ?? []) as $pr) {
            if (isset($pr['min']) && ($minPrice === null || $pr['min'] < $minPrice)) {
                $minPrice = (float) $pr['min'];
                $currency = $pr['currency'] ?? null;
            }
        }
    }
    return ($minPrice !== null && $currency)
        ? 'From ' . $currency . ' ' . number_format($minPrice, 2)
        : null;
}

// ── Parameters ─────────────────────────────────────────────────────────────────

$limit = min(200, max(1, intval($_GET['limit'] ?? 50)));

// ── Storage settings ───────────────────────────────────────────────────────────

$sRes = $mysqli->query(
    "SELECT setting_key, setting_value FROM admin_settings
     WHERE setting_key IN ('folder_post_images','storage_api_key','storage_zone_name')"
);
$s = [];
while ($r = $sRes->fetch_assoc()) $s[$r['setting_key']] = trim($r['setting_value']);

$postImagesFolder = $s['folder_post_images'] ?? '';
$storageApiKey    = $s['storage_api_key']    ?? '';
$storageZoneName  = $s['storage_zone_name']  ?? '';

if (!$postImagesFolder || !$storageApiKey || !$storageZoneName) {
    die('ERROR: Missing storage configuration in admin_settings.');
}

$monthFolder = date('Y-m');
$cdnBasePath = rtrim(preg_replace('#^https?://[^/]+/#', '', $postImagesFolder), '/');

// ── Find distinct attractions to process ────────────────────────────────────────

$attractionIds = [];
$res = $mysqli->query(
    "SELECT DISTINCT attraction_id FROM tm_staging
     WHERE status = 'pending' AND attraction_id IS NOT NULL
     ORDER BY id ASC LIMIT {$limit}"
);
while ($row = $res->fetch_assoc()) {
    $attractionIds[] = $row['attraction_id'];
}

if (empty($attractionIds)) {
    die('<pre>No pending events in tm_staging. Run tm-collect.php first.</pre>');
}

// ── Load ALL rows for each attraction (no partial groups) ───────────────────────

$groups    = [];  // groupKey => [event, ...]
$rowsByKey = [];  // groupKey => [staging_id, ...]

foreach ($attractionIds as $attId) {
    $attEsc = $mysqli->real_escape_string($attId);
    $attRes = $mysqli->query(
        "SELECT id, tm_event_id, attraction_id, venue_id, event_json
         FROM tm_staging WHERE attraction_id = '{$attEsc}' AND status = 'pending'
         ORDER BY id ASC"
    );
    while ($row = $attRes->fetch_assoc()) {
        $row['event'] = json_decode($row['event_json'], true);
        $key = tmGroupKey($row['event']);
        $groups[$key][]    = $row['event'];
        $rowsByKey[$key][] = $row['id'];
    }
}

// Sort each group chronologically
foreach ($groups as $key => &$evts) {
    usort($evts, fn($a, $b) => strcmp(
        $a['dates']['start']['localDate'] ?? '',
        $b['dates']['start']['localDate'] ?? ''
    ));
}
unset($evts);

// ── Output header ──────────────────────────────────────────────────────────────

header('Content-Type: text/html; charset=utf-8');
echo '<pre>';
$totalRows = array_sum(array_map('count', $rowsByKey));
echo "Ticketmaster import — {$totalRows} staged events → " . count($groups) . " attractions\n";
echo str_repeat('─', 72) . "\n\n";

$imported      = 0;
$skippedGroups = 0;

// ── Process each attraction group ─────────────────────────────────────────────

foreach ($groups as $groupKey => $events) {

    $stagingIds = $rowsByKey[$groupKey];
    $firstEvent = $events[0];
    $idList     = implode(',', array_map('intval', $stagingIds));

    $skip = function(string $reason) use ($mysqli, $idList, &$skippedGroups) {
        $r = $mysqli->real_escape_string($reason);
        $mysqli->query(
            "UPDATE tm_staging SET status='skipped', skip_reason='{$r}', processed_at=NOW()
             WHERE id IN ({$idList})"
        );
        $skippedGroups++;
    };

    // ── Sub-group by venue ─────────────────────────────────────────────────────

    $venueGroups = []; // venueKey => [event, ...]
    foreach ($events as $event) {
        $vk = $event['_embedded']['venues'][0]['id'] ?? 'nv-' . md5(
            ($event['_embedded']['venues'][0]['name'] ?? '') .
            ($event['_embedded']['venues'][0]['city']['name'] ?? '')
        );
        $venueGroups[$vk][] = $event;
    }

    // Sort each venue group chronologically
    foreach ($venueGroups as &$vEvts) {
        usort($vEvts, fn($a, $b) => strcmp(
            $a['dates']['start']['localDate'] ?? '',
            $b['dates']['start']['localDate'] ?? ''
        ));
    }
    unset($vEvts);

    // ── Gate: at least one venue must have coordinates ─────────────────────────

    $validVenueGroups = [];
    foreach ($venueGroups as $vk => $vEvts) {
        $v = $vEvts[0]['_embedded']['venues'][0] ?? null;
        if ($v && !empty($v['location']['latitude']) && !empty($v['location']['longitude'])) {
            $validVenueGroups[$vk] = $vEvts;
        }
    }
    if (empty($validVenueGroups)) {
        $skip('no venues with coordinates');
        echo "SKIP [{$firstEvent['name']}] — no venues with coordinates\n";
        continue;
    }

    // ── Gate: qualifying image ─────────────────────────────────────────────────

    $bestImg = bestImage($events);
    if (!$bestImg) {
        $skip('no qualifying image');
        echo "SKIP [{$firstEvent['name']}] — no image >= " . MIN_IMAGE_WIDTH . "px\n";
        continue;
    }

    // ── Deduplication ─────────────────────────────────────────────────────────

    $attractionId = $firstEvent['_embedded']['attractions'][0]['id'] ?? null;
    if ($attractionId) {
        // Check if any staging row for this attraction_id was already imported
        $attEsc = $mysqli->real_escape_string($attractionId);
        $dupRes = $mysqli->query(
            "SELECT id FROM tm_staging
             WHERE attraction_id = '{$attEsc}' AND status = 'imported' LIMIT 1"
        );
        if ($dupRes && $dupRes->num_rows > 0) {
            $skip('already imported');
            echo "SKIP [{$firstEvent['name']}] — already imported\n";
            continue;
        }
    }

    // ── Metadata ───────────────────────────────────────────────────────────────

    $title       = trim($firstEvent['_embedded']['attractions'][0]['name'] ?? $firstEvent['name'] ?? '');
    $description = groupDescription($events);
    $subcatKey   = groupSubcategory($events);
    $locQty      = count($validVenueGroups);

    // Latest last-date across all venues
    $allDates = [];
    foreach ($validVenueGroups as $vEvts) {
        $allDates[] = $vEvts[count($vEvts) - 1]['dates']['start']['localDate'] ?? '';
    }
    $lastDateOverall = max($allDates);
    $expiresAt       = date('Y-m-d H:i:s', strtotime($lastDateOverall . ' +12 months'));

    // ── Insert post ────────────────────────────────────────────────────────────

    $mid   = TM_MEMBER_ID;
    $mrole = TM_MEMBER_ROLE;
    $mname = TM_MEMBER_NAME;
    $stmt  = $mysqli->prepare(
        "INSERT INTO `posts`
         (`post_key`,`member_id`,`member_role`,`member_name`,`subcategory_key`,
          `loc_qty`,`loc_paid`,`visibility`,`moderation_status`,
          `checkout_key`,`days_purchased`,`payment_status`,`expires_at`)
         VALUES ('TEMP',?,?,?,?,?,?,'active','clean','premium',0,'paid',?)"
    );
    $stmt->bind_param('isssiis', $mid, $mrole, $mname, $subcatKey, $locQty, $locQty, $expiresAt);
    $stmt->execute();
    $postId = $mysqli->insert_id;
    $stmt->close();

    if (!$postId) {
        echo "ERROR [{$title}] — post insert failed: " . $mysqli->error . "\n";
        $skippedGroups++;
        continue;
    }

    $postKey = substr(
        $postId . '-' . rtrim(preg_replace('/[^a-z0-9]+/', '-', strtolower($title)), '-'),
        0, 255
    );
    $stmt = $mysqli->prepare("UPDATE `posts` SET `post_key` = ? WHERE `id` = ?");
    $stmt->bind_param('si', $postKey, $postId);
    $stmt->execute();
    $stmt->close();

    // ── Download & upload image (once per post) ────────────────────────────────

    $imageFilename = str_pad((string)$postId, 8, '0', STR_PAD_LEFT)
        . '-' . rtrim(preg_replace('/[^a-z0-9]+/', '-', strtolower($title)), '-') . '.jpg';
    $imageContent = @file_get_contents($bestImg['url']);
    $imageSize    = $imageContent ? strlen($imageContent) : 0;

    if ($imageContent) {
        $bunnyApiUrl = 'https://storage.bunnycdn.com/' . $storageZoneName
            . '/' . $cdnBasePath . '/' . $monthFolder . '/' . $imageFilename;
        $ch = curl_init($bunnyApiUrl);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => 'PUT',
            CURLOPT_POSTFIELDS     => $imageContent,
            CURLOPT_HTTPHEADER     => ['AccessKey: ' . $storageApiKey, 'Content-Type: application/octet-stream'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 60,
        ]);
        curl_exec($ch);
        $bunnyCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($bunnyCode >= 200 && $bunnyCode < 300) {
            $finalImageUrl = rtrim($postImagesFolder, '/') . '/' . $monthFolder . '/' . $imageFilename;
        } else {
            echo "WARN [{$title}] — Bunny upload failed (HTTP {$bunnyCode}), hotlinking\n";
            $finalImageUrl = $bestImg['url'];
            $imageFilename = basename(parse_url($bestImg['url'], PHP_URL_PATH));
        }
    } else {
        echo "WARN [{$title}] — image download failed, hotlinking\n";
        $finalImageUrl = $bestImg['url'];
        $imageFilename = basename(parse_url($bestImg['url'], PHP_URL_PATH));
        $imageSize     = 0;
    }

    // ── Insert post_media (one row shared by all map cards) ────────────────────

    $settingsJson = json_encode([
        'file_name' => $imageFilename, 'file_type' => 'image/jpeg',
        'file_size' => $imageSize,     'crop'       => null,
    ]);
    $stmt = $mysqli->prepare(
        "INSERT INTO `post_media`
         (`member_id`,`member_role`,`post_id`,`file_name`,`file_url`,`file_size`,`settings_json`)
         VALUES (?,?,?,?,?,?,?)"
    );
    $stmt->bind_param('isissis', $mid, $mrole, $postId, $imageFilename, $finalImageUrl, $imageSize, $settingsJson);
    $stmt->execute();
    $mediaId = $mysqli->insert_id;
    $stmt->close();

    $mediaIdStr = (string) $mediaId;

    // ── One map card per venue ─────────────────────────────────────────────────

    $totalSessions = 0;
    foreach ($validVenueGroups as $vk => $vEvts) {

        $venue       = $vEvts[0]['_embedded']['venues'][0];
        $venueName   = trim($venue['name']                      ?? '');
        $addressLine = trim($venue['address']['line1']          ?? '');
        $city        = trim($venue['city']['name']              ?? '');
        $state       = (trim($venue['state']['name']    ?? '') ?: null);
        $postcode    = (trim($venue['postalCode']        ?? '') ?: null);
        $countryName = trim($venue['country']['name']           ?? '');
        $countryCode = trim($venue['country']['countryCode']    ?? '');
        $latitude    = (float) $venue['location']['latitude'];
        $longitude   = (float) $venue['location']['longitude'];
        $timezone    = $vEvts[0]['dates']['timezone'] ?? 'UTC';

        $venueTicketUrl  = trim($vEvts[0]['url'] ?? '');
        $venueSummary    = sessionSummary($vEvts);
        $venuePriceSumm  = priceSummary($vEvts);

        $stmt = $mysqli->prepare(
            "INSERT INTO `post_map_cards`
             (`post_id`,`subcategory_key`,`title`,`description`,`media_ids`,
              `location_type`,`venue_name`,`address_line`,`city`,`state`,
              `postcode`,`country_name`,`country_code`,
              `latitude`,`longitude`,`timezone`,
              `ticket_url`,`session_summary`,`price_summary`)
             VALUES (?,?,?,?,?,'venue',?,?,?,?,?,?,?,?,?,?,?,?,?)"
        );
        $stmt->bind_param(
            'isssssssssssddssss',
            $postId, $subcatKey, $title, $description, $mediaIdStr,
            $venueName, $addressLine, $city, $state,
            $postcode, $countryName, $countryCode,
            $latitude, $longitude, $timezone,
            $venueTicketUrl, $venueSummary, $venuePriceSumm
        );
        $stmt->execute();
        $mapCardId = $mysqli->insert_id;
        $stmt->close();

        // Sessions + pricing for this venue
        foreach ($vEvts as $i => $event) {
            $gk        = sessionKey($i);
            $localDate = $event['dates']['start']['localDate']  ?? '';
            $localTime = substr($event['dates']['start']['localTime'] ?? '00:00:00', 0, 5);
            if (!$localDate) continue;

            $stmt = $mysqli->prepare(
                "INSERT INTO `post_sessions`
                 (`post_map_card_id`,`session_date`,`session_time`,`ticket_group_key`)
                 VALUES (?,?,?,?)"
            );
            $stmt->bind_param('isss', $mapCardId, $localDate, $localTime, $gk);
            $stmt->execute();
            $stmt->close();

            foreach (($event['priceRanges'] ?? []) as $pr) {
                $prMin      = isset($pr['min']) ? (float) $pr['min'] : null;
                $prMax      = isset($pr['max']) ? (float) $pr['max'] : null;
                $prCurrency = $pr['currency'] ?? null;
                $prArea     = isset($pr['type']) ? ucfirst(strtolower($pr['type'])) : null;
                if ($prMin === null || !$prCurrency) continue;

                // Named type (Standard, Platinum, etc.) → allocated seating area
                // No type → general admission (allocated_areas = 0, area label is hardcoded by frontend)
                $allocatedAreas = $prArea ? 1 : 0;
                $ticketArea     = $prArea ?: null;

                // Tier 1 — minimum price
                $tier1 = 'From';
                $stmt = $mysqli->prepare(
                    "INSERT INTO `post_ticket_pricing`
                     (`post_map_card_id`,`ticket_group_key`,`allocated_areas`,`ticket_area`,`pricing_tier`,`price`,`currency`)
                     VALUES (?,?,?,?,?,?,?)"
                );
                $stmt->bind_param('isissds', $mapCardId, $gk, $allocatedAreas, $ticketArea, $tier1, $prMin, $prCurrency);
                $stmt->execute();
                $stmt->close();

                // Tier 2 — maximum price (only if different from minimum)
                if ($prMax !== null && $prMax > $prMin) {
                    $tier2 = 'To';
                    $stmt = $mysqli->prepare(
                        "INSERT INTO `post_ticket_pricing`
                         (`post_map_card_id`,`ticket_group_key`,`allocated_areas`,`ticket_area`,`pricing_tier`,`price`,`currency`)
                         VALUES (?,?,?,?,?,?,?)"
                    );
                    $stmt->bind_param('isissds', $mapCardId, $gk, $allocatedAreas, $ticketArea, $tier2, $prMax, $prCurrency);
                    $stmt->execute();
                    $stmt->close();
                }
            }
            $totalSessions++;
        }
    }

    // ── Mark all staging rows for this attraction as imported ──────────────────

    $mysqli->query(
        "UPDATE tm_staging SET status='imported', processed_at=NOW() WHERE id IN ({$idList})"
    );

    $venueCount = count($validVenueGroups);
    echo "OK  Post #{$postId} — {$title}"
        . " — {$venueCount} venue(s), {$totalSessions} session(s)\n";
    $imported++;
}

// ── Summary ────────────────────────────────────────────────────────────────────

echo "\n" . str_repeat('─', 72) . "\n";
echo "Done.  Imported: {$imported} posts  |  Skipped: {$skippedGroups} groups\n";

$remaining = $mysqli->query("SELECT COUNT(*) c FROM tm_staging WHERE status='pending'")->fetch_assoc()['c'] ?? 0;
if ($remaining > 0) echo "Still pending: {$remaining} events — run again to continue.\n";

echo '</pre>';
