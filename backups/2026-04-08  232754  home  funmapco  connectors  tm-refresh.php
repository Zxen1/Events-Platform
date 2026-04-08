<?php
/**
 * tm-refresh.php — Weekly update of existing TM-imported posts
 *
 * Re-fetches event data from the Ticketmaster API for attractions that
 * already have posts. Compares fresh data against existing post/map card/
 * session/pricing rows and updates any columns that differ.
 *
 * Post IDs, map card IDs, and URLs are never changed or deleted.
 * New venues get new map cards. Sessions and pricing are replaced in full
 * for each map card (nothing external references their IDs).
 *
 * Parameters:
 *   limit — max attractions to refresh per run (default: 50, max: 200)
 */

declare(strict_types=1);

if (php_sapi_name() === 'cli' && isset($argv[1])) {
    parse_str($argv[1], $_GET);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

$configDbCandidates = [
    __DIR__ . '/../config/config-db.php',
    dirname(__DIR__) . '/config/config-db.php',
    dirname(__DIR__, 2) . '/config/config-db.php',
    dirname(__DIR__, 3) . '/../config/config-db.php',
    dirname(__DIR__) . '/../config/config-db.php',
];
$configAppCandidates = [
    __DIR__ . '/../config/config-app.php',
    dirname(__DIR__) . '/config/config-app.php',
    dirname(__DIR__, 2) . '/config/config-app.php',
    dirname(__DIR__, 3) . '/../config/config-app.php',
    dirname(__DIR__) . '/../config/config-app.php',
];

$mysqli = null;
foreach ($configDbCandidates  as $p) { if (is_file($p)) { require_once $p; break; } }
foreach ($configAppCandidates as $p) { if (is_file($p)) { require_once $p; break; } }

if (!isset($mysqli) || !($mysqli instanceof mysqli)) die('ERROR: No database connection.');
if (empty($TICKETMASTER_CONSUMER_KEY))               die('ERROR: TICKETMASTER_CONSUMER_KEY missing.');
$mysqli->set_charset('utf8mb4');

// ── Constants ──────────────────────────────────────────────────────────────────

const TM_ATTRIBUTION  = "Powered by Ticketmaster\n\nClick the Get Tickets button for full event details, pricing, and availability.";
const COORD_PRECISION = 4;

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

// ── Helpers (same logic as tm-import.php) ──────────────────────────────────────

function tmFetch(string $url): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30]);
    $resp     = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($httpCode === 429) return ['_error' => 'rate_limit'];
    if ($httpCode !== 200 || !$resp) return ['_error' => 'http_' . $httpCode];
    $decoded = json_decode($resp, true);
    return is_array($decoded) ? $decoded : ['_error' => 'bad_json'];
}

function sessionKey(int $n): string {
    $a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if ($n < 26) return $a[$n];
    return $a[intdiv($n, 26) - 1] . $a[$n % 26];
}

/**
 * Build a rich description from event info + venue details.
 * Venue-specific sections only included for single-venue posts.
 */
function groupDescription(array $events, int $venueCount = 1): string {
    $sections = [];

    foreach ($events as $event) {
        $info = trim($event['info'] ?? '');
        if ($info) { $sections[] = $info; break; }
    }

    foreach ($events as $event) {
        $note = trim($event['pleaseNote'] ?? '');
        if ($note) { $sections[] = 'Please note: ' . $note; break; }
    }

    if ($venueCount === 1) {
        $venue = $events[0]['_embedded']['venues'][0] ?? [];

        $childRule = trim($venue['generalInfo']['childRule'] ?? '');
        if ($childRule) $sections[] = "Age/Children: " . $childRule;

        $generalRule = trim($venue['generalInfo']['generalRule'] ?? '');
        if ($generalRule) $sections[] = "General Rules: " . $generalRule;

        $accessible = trim($venue['accessibleSeatingDetail'] ?? '');
        if ($accessible) $sections[] = "Accessibility: " . $accessible;

        $boxParts = [];
        $hours   = trim($venue['boxOfficeInfo']['openHoursDetail']      ?? '');
        $phone   = trim($venue['boxOfficeInfo']['phoneNumberDetail']    ?? '');
        $payment = trim($venue['boxOfficeInfo']['acceptedPaymentDetail'] ?? '');
        $collect = trim($venue['boxOfficeInfo']['willCallDetail']       ?? '');
        if ($hours)   $boxParts[] = "Hours: "      . $hours;
        if ($phone)   $boxParts[] = "Phone: "      . $phone;
        if ($payment) $boxParts[] = "Payment: "    . $payment;
        if ($collect) $boxParts[] = "Collection: " . $collect;
        if ($boxParts) $sections[] = "Box Office\n" . implode("\n", $boxParts);

        $parking = trim($venue['parkingDetail'] ?? '');
        if ($parking) $sections[] = "Parking: " . $parking;
    }

    $sections[] = TM_ATTRIBUTION;
    return implode("\n\n", $sections);
}

function groupSubcategory(array $events): string {
    $segment = $events[0]['classifications'][0]['segment']['name'] ?? 'Miscellaneous';
    $genre   = $events[0]['classifications'][0]['genre']['name']   ?? '';
    if (isset(GENRE_OVERRIDES[$genre])) return GENRE_OVERRIDES[$genre];
    return SEGMENT_MAP[$segment] ?? 'other-events';
}

function sessionSummary(array $events): string {
    $first = $events[0]['dates']['start']['localDate']                   ?? '';
    $last  = $events[count($events) - 1]['dates']['start']['localDate'] ?? '';
    if (count($events) === 1) {
        $t = $events[0]['dates']['start']['localTime'] ?? '00:00:00';
        return date('j M Y', strtotime($first)) . ', ' . substr($t, 0, 5);
    }
    return date('j M Y', strtotime($first)) . ' – ' . date('j M Y', strtotime($last));
}

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

function coordKey(float $lat, float $lng): string {
    return round($lat, COORD_PRECISION) . ',' . round($lng, COORD_PRECISION);
}

// ── Parameters ─────────────────────────────────────────────────────────────────

$limit = min(200, max(1, intval($_GET['limit'] ?? 50)));

// ── Find imported attractions with post IDs ─────────────────────────────────────

$attractions = []; // attraction_id => post_id
$res = $mysqli->query(
    "SELECT DISTINCT attraction_id, post_id FROM tm_staging
     WHERE status = 'imported' AND post_id IS NOT NULL AND attraction_id IS NOT NULL
     ORDER BY post_id ASC LIMIT {$limit}"
);
while ($row = $res->fetch_assoc()) {
    $attractions[$row['attraction_id']] = (int) $row['post_id'];
}

if (empty($attractions)) {
    die('<pre>No imported attractions to refresh.</pre>');
}

// ── Output header ──────────────────────────────────────────────────────────────

header('Content-Type: text/html; charset=utf-8');
@ob_end_flush();
ob_implicit_flush(true);
echo '<pre>';
echo "Ticketmaster refresh — " . count($attractions) . " attractions to check\n";
echo str_repeat('─', 72) . "\n\n";

$apiCalls   = 0;
$updated    = 0;
$unchanged  = 0;
$errors     = 0;

// ── Process each attraction ────────────────────────────────────────────────────

foreach ($attractions as $attractionId => $postId) {

    // ── Re-fetch all events from TM API ────────────────────────────────────────

    $baseParams = [
        'apikey'        => $TICKETMASTER_CONSUMER_KEY,
        'attractionId'  => $attractionId,
        'size'          => 200,
        'sort'          => 'date,asc',
        'startDateTime' => date('Y-m-d') . 'T00:00:00Z',
    ];

    $allEvents = [];
    $page = 0;
    $attractionName = $attractionId;
    while (true) {
        $baseParams['page'] = $page;
        $url = 'https://app.ticketmaster.com/discovery/v2/events.json?' . http_build_query($baseParams);

        $data = tmFetch($url);
        if (isset($data['_error'])) {
            if ($data['_error'] === 'rate_limit') {
                echo "RATE LIMIT — stopping entirely.\n";
                break 2;
            }
            echo "WARN [{$attractionId}] Post #{$postId} — {$data['_error']}, skipping\n";
            $allEvents = [];
            $errors++;
            break;
        }
        $apiCalls++;

        $events = $data['_embedded']['events'] ?? [];
        if (empty($events)) break;

        $allEvents = array_merge($allEvents, $events);
        if ($page === 0) {
            $attractionName = $events[0]['_embedded']['attractions'][0]['name'] ?? $attractionId;
        }

        $totalPages = $data['page']['totalPages'] ?? 1;
        $page++;
        if ($page >= $totalPages) break;
        usleep(250000);
    }

    if (empty($allEvents)) {
        echo "SKIP [{$attractionId}] {$attractionName} — no future events returned\n";
        usleep(250000);
        continue;
    }

    // ── Update staging JSON for existing events, insert new ones ────────────────

    $stmtUpdate = $mysqli->prepare(
        "UPDATE tm_staging SET event_json = ? WHERE tm_event_id = ? AND attraction_id = ?"
    );
    $stmtInsert = $mysqli->prepare(
        "INSERT IGNORE INTO tm_staging (tm_event_id, attraction_id, venue_id, event_json, status, post_id)
         VALUES (?, ?, ?, ?, 'imported', ?)"
    );
    foreach ($allEvents as $event) {
        $tmId         = $event['id'] ?? '';
        $venueId      = $event['_embedded']['venues'][0]['id'] ?? null;
        $json         = json_encode($event, JSON_UNESCAPED_UNICODE);
        $stmtUpdate->bind_param('sss', $json, $tmId, $attractionId);
        $stmtUpdate->execute();
        if ($mysqli->affected_rows === 0) {
            $stmtInsert->bind_param('ssssi', $tmId, $attractionId, $venueId, $json, $postId);
            $stmtInsert->execute();
        }
    }
    $stmtUpdate->close();
    $stmtInsert->close();

    // ── Sort events chronologically ────────────────────────────────────────────

    usort($allEvents, fn($a, $b) => strcmp(
        $a['dates']['start']['localDate'] ?? '',
        $b['dates']['start']['localDate'] ?? ''
    ));

    // ── Group by venue ─────────────────────────────────────────────────────────

    $venueGroups = [];
    foreach ($allEvents as $event) {
        $vk = $event['_embedded']['venues'][0]['id'] ?? 'nv-' . md5(
            ($event['_embedded']['venues'][0]['name'] ?? '') .
            ($event['_embedded']['venues'][0]['city']['name'] ?? '')
        );
        $venueGroups[$vk][] = $event;
    }
    foreach ($venueGroups as &$vEvts) {
        usort($vEvts, fn($a, $b) => strcmp(
            $a['dates']['start']['localDate'] ?? '',
            $b['dates']['start']['localDate'] ?? ''
        ));
    }
    unset($vEvts);

    // Filter to venues with coordinates
    $validVenueGroups = [];
    foreach ($venueGroups as $vk => $vEvts) {
        $v = $vEvts[0]['_embedded']['venues'][0] ?? null;
        if ($v && !empty($v['location']['latitude']) && !empty($v['location']['longitude'])) {
            $validVenueGroups[$vk] = $vEvts;
        }
    }

    if (empty($validVenueGroups)) {
        echo "SKIP [{$attractionId}] {$attractionName} — no venues with coordinates\n";
        usleep(250000);
        continue;
    }

    // ── Compute fresh post-level values ────────────────────────────────────────

    $freshSubcat = groupSubcategory($allEvents);
    $freshLocQty = count($validVenueGroups);
    $allDates    = [];
    foreach ($validVenueGroups as $vEvts) {
        $allDates[] = $vEvts[count($vEvts) - 1]['dates']['start']['localDate'] ?? '';
    }
    $freshExpires = date('Y-m-d H:i:s', strtotime(max($allDates) . ' +12 months'));

    // ── Load existing post ─────────────────────────────────────────────────────

    $postRow = $mysqli->query(
        "SELECT subcategory_key, loc_qty, loc_paid, expires_at FROM posts WHERE id = {$postId}"
    )->fetch_assoc();

    if (!$postRow) {
        echo "ERROR [{$attractionId}] {$attractionName} — Post #{$postId} not found in DB\n";
        $errors++;
        continue;
    }

    // ── Diff and update post columns ───────────────────────────────────────────

    $changes     = [];
    $postUpdates = [];

    if ($postRow['subcategory_key'] !== $freshSubcat) {
        $postUpdates[] = "subcategory_key = '" . $mysqli->real_escape_string($freshSubcat) . "'";
        $changes[] = "subcategory: {$postRow['subcategory_key']} → {$freshSubcat}";
    }
    if ((int) $postRow['loc_qty'] !== $freshLocQty) {
        $postUpdates[] = "loc_qty = {$freshLocQty}";
        $postUpdates[] = "loc_paid = {$freshLocQty}";
        $changes[] = "venues: {$postRow['loc_qty']} → {$freshLocQty}";
    }
    if ($postRow['expires_at'] !== $freshExpires) {
        $postUpdates[] = "expires_at = '" . $mysqli->real_escape_string($freshExpires) . "'";
        $changes[] = "expires: {$postRow['expires_at']} → {$freshExpires}";
    }

    if ($postUpdates) {
        $mysqli->query("UPDATE posts SET " . implode(', ', $postUpdates) . " WHERE id = {$postId}");
    }

    // ── Load existing map cards for this post ──────────────────────────────────

    $existingCards = []; // coordKey => row
    $cardRes = $mysqli->query(
        "SELECT id, subcategory_key, title, description, venue_name, address_line,
                city, state, postcode, country_name, country_code,
                latitude, longitude, timezone, ticket_url, session_summary, price_summary
         FROM post_map_cards WHERE post_id = {$postId}"
    );
    while ($card = $cardRes->fetch_assoc()) {
        $ck = coordKey((float) $card['latitude'], (float) $card['longitude']);
        $existingCards[$ck] = $card;
    }

    // ── Process each venue group ───────────────────────────────────────────────

    $freshTitle       = trim($allEvents[0]['_embedded']['attractions'][0]['name'] ?? $allEvents[0]['name'] ?? '');
    $freshDescription = groupDescription($allEvents, $freshLocQty);
    $newVenues        = 0;
    $updatedCards     = 0;

    foreach ($validVenueGroups as $vk => $vEvts) {

        $venue       = $vEvts[0]['_embedded']['venues'][0];
        $latitude    = (float) $venue['location']['latitude'];
        $longitude   = (float) $venue['location']['longitude'];
        $ck          = coordKey($latitude, $longitude);

        $venueName   = trim($venue['name']                      ?? '');
        $addressLine = trim($venue['address']['line1']          ?? '');
        $city        = trim($venue['city']['name']              ?? '');
        $state       = (trim($venue['state']['name']    ?? '') ?: null);
        $postcode    = (trim($venue['postalCode']        ?? '') ?: null);
        $countryName = trim($venue['country']['name']           ?? '');
        $countryCode = trim($venue['country']['countryCode']    ?? '');
        $timezone    = $vEvts[0]['dates']['timezone'] ?? 'UTC';

        $venueTicketUrl = trim($vEvts[0]['url'] ?? '');
        $venueSummary   = sessionSummary($vEvts);
        $venuePriceSumm = priceSummary($vEvts);

        if (isset($existingCards[$ck])) {
            // ── Existing map card — compare and update ─────────────────────────
            $card    = $existingCards[$ck];
            $cardId  = (int) $card['id'];
            $cardUpd = [];

            $comparisons = [
                'subcategory_key' => $freshSubcat,
                'title'           => $freshTitle,
                'description'     => $freshDescription,
                'venue_name'      => $venueName,
                'address_line'    => $addressLine,
                'city'            => $city,
                'state'           => $state,
                'postcode'        => $postcode,
                'country_name'    => $countryName,
                'country_code'    => $countryCode,
                'timezone'        => $timezone,
                'ticket_url'      => $venueTicketUrl,
                'session_summary' => $venueSummary,
                'price_summary'   => $venuePriceSumm,
            ];

            foreach ($comparisons as $col => $freshVal) {
                $existVal = $card[$col];
                if ($freshVal === null && $existVal === null) continue;
                if ((string) $freshVal !== (string) $existVal) {
                    if ($freshVal === null) {
                        $cardUpd[] = "`{$col}` = NULL";
                    } else {
                        $cardUpd[] = "`{$col}` = '" . $mysqli->real_escape_string($freshVal) . "'";
                    }
                }
            }

            if ($cardUpd) {
                $mysqli->query("UPDATE post_map_cards SET " . implode(', ', $cardUpd) . " WHERE id = {$cardId}");
                $updatedCards++;
            }

            // Remove from map so we know it was matched
            unset($existingCards[$ck]);

        } else {
            // ── New venue — insert map card ────────────────────────────────────

            $mediaIdStr = '';
            $mediaRes = $mysqli->query(
                "SELECT id FROM post_media WHERE post_id = {$postId} ORDER BY id ASC LIMIT 1"
            );
            if ($mRow = $mediaRes->fetch_assoc()) $mediaIdStr = (string) $mRow['id'];

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
                $postId, $freshSubcat, $freshTitle, $freshDescription, $mediaIdStr,
                $venueName, $addressLine, $city, $state,
                $postcode, $countryName, $countryCode,
                $latitude, $longitude, $timezone,
                $venueTicketUrl, $venueSummary, $venuePriceSumm
            );
            $stmt->execute();
            $cardId = $mysqli->insert_id;
            $stmt->close();
            $newVenues++;
            $changes[] = "new venue: {$venueName}, {$city}";
        }

        // ── Replace sessions and pricing for this card ─────────────────────────

        $mysqli->query("DELETE FROM post_sessions WHERE post_map_card_id = {$cardId}");
        $mysqli->query("DELETE FROM post_ticket_pricing WHERE post_map_card_id = {$cardId}");

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
            $stmt->bind_param('isss', $cardId, $localDate, $localTime, $gk);
            $stmt->execute();
            $stmt->close();

            foreach (($event['priceRanges'] ?? []) as $pr) {
                $prMin      = isset($pr['min']) ? (float) $pr['min'] : null;
                $prMax      = isset($pr['max']) ? (float) $pr['max'] : null;
                $prCurrency = $pr['currency'] ?? null;
                $prArea     = isset($pr['type']) ? ucfirst(strtolower($pr['type'])) : null;
                if ($prMin === null || !$prCurrency) continue;

                $allocatedAreas = $prArea ? 1 : 0;
                $ticketArea     = $prArea ?: null;

                $tier1 = 'From';
                $stmt = $mysqli->prepare(
                    "INSERT INTO `post_ticket_pricing`
                     (`post_map_card_id`,`ticket_group_key`,`allocated_areas`,`ticket_area`,`pricing_tier`,`price`,`currency`)
                     VALUES (?,?,?,?,?,?,?)"
                );
                $stmt->bind_param('isissds', $cardId, $gk, $allocatedAreas, $ticketArea, $tier1, $prMin, $prCurrency);
                $stmt->execute();
                $stmt->close();

                if ($prMax !== null && $prMax > $prMin) {
                    $tier2 = 'To';
                    $stmt = $mysqli->prepare(
                        "INSERT INTO `post_ticket_pricing`
                         (`post_map_card_id`,`ticket_group_key`,`allocated_areas`,`ticket_area`,`pricing_tier`,`price`,`currency`)
                         VALUES (?,?,?,?,?,?,?)"
                    );
                    $stmt->bind_param('isissds', $cardId, $gk, $allocatedAreas, $ticketArea, $tier2, $prMax, $prCurrency);
                    $stmt->execute();
                    $stmt->close();
                }
            }
        }
    }

    // ── Report ─────────────────────────────────────────────────────────────────

    if (empty($changes) && $updatedCards === 0 && $newVenues === 0) {
        echo "  [{$attractionId}] {$attractionName} — no changes\n";
        $unchanged++;
    } else {
        echo "OK  [{$attractionId}] {$attractionName} Post #{$postId}";
        if ($updatedCards) echo " — {$updatedCards} card(s) updated";
        if ($newVenues)    echo " — {$newVenues} new venue(s)";
        echo "\n";
        foreach ($changes as $c) echo "    ↳ {$c}\n";
        $updated++;
    }

    usleep(250000);
}

// ── Summary ────────────────────────────────────────────────────────────────────

echo "\n" . str_repeat('─', 72) . "\n";
echo "API calls: {$apiCalls}  |  Updated: {$updated}  |  Unchanged: {$unchanged}  |  Errors: {$errors}\n";
echo '</pre>';
