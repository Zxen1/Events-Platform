<?php
/**
 * tm-import.php — Ticketmaster event import tool
 *
 * Fetches events from the Ticketmaster Discovery API, applies quality filters,
 * uploads images directly to Bunny CDN, and inserts posts into the database.
 *
 * Run in browser: Agent/tm-import.php?count=20&country=GB&page=0
 *
 * Parameters:
 *   count   — events to fetch (default 20, max 200)
 *   country — ISO country code (default GB)
 *   page    — API page offset (default 0)
 */

declare(strict_types=1);

// ── Bootstrap ─────────────────────────────────────────────────────────────────

$configDbCandidates = [
    __DIR__ . '/../home/funmapco/config/config-db.php',
    __DIR__ . '/../home/config/config-db.php',
    dirname(__DIR__, 2) . '/config/config-db.php',
    dirname(__DIR__, 2) . '/../config/config-db.php',
    __DIR__ . '/../config/config-db.php',
];

$configAppCandidates = [
    __DIR__ . '/../home/funmapco/config/config-app.php',
    __DIR__ . '/../home/config/config-app.php',
    dirname(__DIR__, 2) . '/config/config-app.php',
    dirname(__DIR__, 2) . '/../config/config-app.php',
    __DIR__ . '/../config/config-app.php',
];

$mysqli = null;
foreach ($configDbCandidates as $path) {
    if (is_file($path)) { require_once $path; break; }
}
foreach ($configAppCandidates as $path) {
    if (is_file($path)) { require_once $path; break; }
}

if (!isset($mysqli) || !($mysqli instanceof mysqli)) {
    die('ERROR: Could not connect to database.');
}
if (empty($TICKETMASTER_CONSUMER_KEY)) {
    die('ERROR: TICKETMASTER_CONSUMER_KEY not found in config-app.php.');
}

$mysqli->set_charset('utf8mb4');

// ── Constants ──────────────────────────────────────────────────────────────────

const TM_MEMBER_ID   = 213;
const TM_MEMBER_ROLE = 'member';
const TM_MEMBER_NAME = 'Ticketmaster';
const TM_ATTRIBUTION = 'Powered by Ticketmaster';
const MIN_IMAGE_WIDTH = 1000;

// Ticketmaster segment → subcategory key
const SEGMENT_MAP = [
    'Music'          => 'live-gigs',
    'Sports'         => 'live-sport',
    'Arts & Theatre' => 'live-theatre',
    'Film'           => 'screenings',
    'Miscellaneous'  => 'other-events',
];

// ── Parameters ─────────────────────────────────────────────────────────────────

$count   = min(200, max(1, intval($_GET['count'] ?? 20)));
$country = preg_replace('/[^A-Z]/', '', strtoupper($_GET['country'] ?? 'GB'));
$page    = max(0, intval($_GET['page'] ?? 0));

// ── Storage settings from admin_settings ──────────────────────────────────────

$settingsRes = $mysqli->query(
    "SELECT setting_key, setting_value FROM admin_settings
     WHERE setting_key IN ('folder_post_images','storage_api_key','storage_zone_name')"
);
$storageSettings = [];
while ($row = $settingsRes->fetch_assoc()) {
    $storageSettings[$row['setting_key']] = trim($row['setting_value']);
}

$postImagesFolder = $storageSettings['folder_post_images'] ?? '';
$storageApiKey    = $storageSettings['storage_api_key'] ?? '';
$storageZoneName  = $storageSettings['storage_zone_name'] ?? '';

if (!$postImagesFolder || !$storageApiKey || !$storageZoneName) {
    die('ERROR: Missing storage configuration in admin_settings (folder_post_images / storage_api_key / storage_zone_name).');
}

$monthFolder = date('Y-m');
$cdnBasePath = rtrim(preg_replace('#^https?://[^/]+/#', '', $postImagesFolder), '/');

// ── Fetch events from Ticketmaster ────────────────────────────────────────────

$apiUrl = 'https://app.ticketmaster.com/discovery/v2/events.json?' . http_build_query([
    'apikey'      => $TICKETMASTER_CONSUMER_KEY,
    'countryCode' => $country,
    'size'        => $count,
    'page'        => $page,
    'sort'        => 'date,asc',
]);

$ch = curl_init($apiUrl);
curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode !== 200 || !$response) {
    die('ERROR: Ticketmaster API returned HTTP ' . $httpCode . "\n" . $response);
}

$data   = json_decode($response, true);
$events = $data['_embedded']['events'] ?? [];

if (empty($events)) {
    die('No events returned from Ticketmaster for country=' . $country . ', page=' . $page);
}

// ── Output ─────────────────────────────────────────────────────────────────────

header('Content-Type: text/html; charset=utf-8');
echo '<pre>';
echo "Ticketmaster import — country={$country}, page={$page}, fetched=" . count($events) . "\n";
echo str_repeat('─', 72) . "\n\n";

$imported = 0;
$skipped  = 0;

// ── Process events ─────────────────────────────────────────────────────────────

foreach ($events as $event) {
    $tmId       = $event['id']    ?? '';
    $title      = trim($event['name'] ?? '');
    $ticketUrl  = $event['url']   ?? '';
    $info       = trim($event['info']       ?? '');
    $pleaseNote = trim($event['pleaseNote'] ?? '');
    $timezone   = $event['dates']['timezone']          ?? 'UTC';
    $localDate  = $event['dates']['start']['localDate'] ?? '';
    $localTime  = $event['dates']['start']['localTime'] ?? '00:00:00';

    // ── Quality gate: must have a ticket URL and date ──────────────────────────
    if (!$ticketUrl || !$localDate) {
        echo "SKIP [{$tmId}] {$title} — missing URL or date\n";
        $skipped++;
        continue;
    }

    // ── Quality gate: must have price ranges ──────────────────────────────────
    $priceRanges = $event['priceRanges'] ?? [];
    if (empty($priceRanges)) {
        echo "SKIP [{$tmId}] {$title} — no price data\n";
        $skipped++;
        continue;
    }

    // ── Quality gate: must have venue with coordinates ────────────────────────
    $venue = $event['_embedded']['venues'][0] ?? null;
    if (!$venue || empty($venue['location']['latitude']) || empty($venue['location']['longitude'])) {
        echo "SKIP [{$tmId}] {$title} — no venue/coordinates\n";
        $skipped++;
        continue;
    }

    // ── Quality gate: best image must be >= MIN_IMAGE_WIDTH ───────────────────
    $bestImage = null;
    foreach (($event['images'] ?? []) as $img) {
        if (($img['width'] ?? 0) >= MIN_IMAGE_WIDTH) {
            if (!$bestImage || $img['width'] > $bestImage['width']) {
                $bestImage = $img;
            }
        }
    }
    if (!$bestImage) {
        echo "SKIP [{$tmId}] {$title} — no qualifying image (min " . MIN_IMAGE_WIDTH . "px)\n";
        $skipped++;
        continue;
    }

    // ── Deduplication: skip if ticket URL already exists ──────────────────────
    $urlEsc = $mysqli->real_escape_string($ticketUrl);
    $dup    = $mysqli->query("SELECT id FROM post_map_cards WHERE ticket_url = '{$urlEsc}' LIMIT 1");
    if ($dup && $dup->num_rows > 0) {
        echo "SKIP [{$tmId}] {$title} — already imported\n";
        $skipped++;
        continue;
    }

    // ── Build description ──────────────────────────────────────────────────────
    $parts = array_filter([$info, $pleaseNote ? 'Please note: ' . $pleaseNote : '']);
    $description = implode("\n\n", $parts);
    $description = $description ? $description . "\n\n" . TM_ATTRIBUTION : TM_ATTRIBUTION;

    // ── Venue fields ───────────────────────────────────────────────────────────
    $venueName   = trim($venue['name'] ?? '');
    $addressLine = trim($venue['address']['line1'] ?? '');
    $city        = trim($venue['city']['name'] ?? '');
    $state       = trim($venue['state']['name'] ?? '') ?: null;
    $postcode    = trim($venue['postalCode'] ?? '') ?: null;
    $countryName = trim($venue['country']['name'] ?? '');
    $countryCode = trim($venue['country']['countryCode'] ?? '');
    $latitude    = (float) $venue['location']['latitude'];
    $longitude   = (float) $venue['location']['longitude'];

    // ── Subcategory ────────────────────────────────────────────────────────────
    $segment        = $event['classifications'][0]['segment']['name'] ?? 'Miscellaneous';
    $subcategoryKey = SEGMENT_MAP[$segment] ?? 'other-events';

    // ── Price ──────────────────────────────────────────────────────────────────
    $minPrice = null;
    $currency = null;
    foreach ($priceRanges as $pr) {
        if (isset($pr['min']) && ($minPrice === null || $pr['min'] < $minPrice)) {
            $minPrice = (float) $pr['min'];
            $currency = $pr['currency'] ?? null;
        }
    }

    $priceSummary = ($minPrice !== null && $currency)
        ? 'From ' . $currency . ' ' . number_format($minPrice, 2)
        : null;

    $expiresAt = date('Y-m-d H:i:s', strtotime($localDate . ' +12 months'));

    // ── Insert post ────────────────────────────────────────────────────────────
    $stmt = $mysqli->prepare(
        "INSERT INTO `posts`
         (`post_key`,`member_id`,`member_role`,`member_name`,`subcategory_key`,
          `loc_qty`,`loc_paid`,`visibility`,`moderation_status`,
          `checkout_key`,`days_purchased`,`payment_status`,`expires_at`)
         VALUES ('TEMP',?,?,?,?,1,1,'active','clean','premium',0,'paid',?)"
    );
    $stmt->bind_param('issss', TM_MEMBER_ID, TM_MEMBER_ROLE, TM_MEMBER_NAME, $subcategoryKey, $expiresAt);
    $stmt->execute();
    $postId = $mysqli->insert_id;
    $stmt->close();

    if (!$postId) {
        echo "ERROR [{$tmId}] {$title} — post insert failed: " . $mysqli->error . "\n";
        $skipped++;
        continue;
    }

    $postKey = $postId . '-' . rtrim(preg_replace('/[^a-z0-9]+/', '-', strtolower($title)), '-');
    $postKey = substr($postKey, 0, 255);
    $stmt = $mysqli->prepare("UPDATE `posts` SET `post_key` = ? WHERE `id` = ?");
    $stmt->bind_param('si', $postKey, $postId);
    $stmt->execute();
    $stmt->close();

    // ── Download image ─────────────────────────────────────────────────────────
    $imageFilename = str_pad((string)$postId, 8, '0', STR_PAD_LEFT) . '-'
        . rtrim(preg_replace('/[^a-z0-9]+/', '-', strtolower($title)), '-') . '.jpg';
    $imageContent  = @file_get_contents($bestImage['url']);
    $imageSize     = $imageContent ? strlen($imageContent) : 0;

    if ($imageContent) {
        // ── Upload to Bunny CDN ────────────────────────────────────────────────
        $bunnyPath = $cdnBasePath . '/' . $monthFolder . '/' . $imageFilename;
        $bunnyApi  = 'https://storage.bunnycdn.com/' . $storageZoneName . '/' . $bunnyPath;

        $ch = curl_init($bunnyApi);
        curl_setopt_array($ch, [
            CURLOPT_CUSTOMREQUEST  => 'PUT',
            CURLOPT_POSTFIELDS     => $imageContent,
            CURLOPT_HTTPHEADER     => ['AccessKey: ' . $storageApiKey, 'Content-Type: application/octet-stream'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 60,
        ]);
        $bunnyRes  = curl_exec($ch);
        $bunnyCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($bunnyCode >= 200 && $bunnyCode < 300) {
            $finalImageUrl = rtrim($postImagesFolder, '/') . '/' . $monthFolder . '/' . $imageFilename;
        } else {
            echo "WARN [{$tmId}] {$title} — Bunny upload failed (HTTP {$bunnyCode}), hotlinking\n";
            $finalImageUrl = $bestImage['url'];
            $imageFilename = basename(parse_url($bestImage['url'], PHP_URL_PATH));
        }
    } else {
        echo "WARN [{$tmId}] {$title} — image download failed, hotlinking\n";
        $finalImageUrl = $bestImage['url'];
        $imageFilename = basename(parse_url($bestImage['url'], PHP_URL_PATH));
    }

    // ── Insert post_media ──────────────────────────────────────────────────────
    $settingsJson = json_encode([
        'file_name' => $imageFilename,
        'file_type' => 'image/jpeg',
        'file_size' => $imageSize,
        'crop'      => null,
    ]);
    $stmt = $mysqli->prepare(
        "INSERT INTO `post_media`
         (`member_id`,`member_role`,`post_id`,`file_name`,`file_url`,`file_size`,`settings_json`)
         VALUES (?,?,?,?,?,?,?)"
    );
    $memberRole = TM_MEMBER_ROLE;
    $memberId   = TM_MEMBER_ID;
    $stmt->bind_param('ississi', $memberId, $memberRole, $postId, $imageFilename, $finalImageUrl, $imageSize, $settingsJson);
    $stmt->execute();
    $mediaId = $mysqli->insert_id;
    $stmt->close();

    // ── Insert post_map_cards ──────────────────────────────────────────────────
    $sessionSummary = date('j M Y', strtotime($localDate)) . ', ' . substr($localTime, 0, 5);

    $stmt = $mysqli->prepare(
        "INSERT INTO `post_map_cards`
         (`post_id`,`subcategory_key`,`title`,`description`,`media_ids`,
          `location_type`,`venue_name`,`address_line`,`city`,`state`,
          `postcode`,`country_name`,`country_code`,
          `latitude`,`longitude`,`timezone`,
          `ticket_url`,`session_summary`,`price_summary`)
         VALUES (?,?,?,?,?,'venue',?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
    );
    $mediaIdStr = (string)$mediaId;
    $stmt->bind_param(
        'issssssssssssddssss',
        $postId, $subcategoryKey, $title, $description, $mediaIdStr,
        $venueName, $addressLine, $city, $state,
        $postcode, $countryName, $countryCode,
        $latitude, $longitude, $timezone,
        $ticketUrl, $sessionSummary, $priceSummary
    );
    $stmt->execute();
    $mapCardId = $mysqli->insert_id;
    $stmt->close();

    // ── Insert post_sessions ───────────────────────────────────────────────────
    $sessionTime = substr($localTime, 0, 5);
    $ticketGroup = 'A';
    $stmt = $mysqli->prepare(
        "INSERT INTO `post_sessions` (`post_map_card_id`,`session_date`,`session_time`,`ticket_group_key`)
         VALUES (?,?,?,?)"
    );
    $stmt->bind_param('isss', $mapCardId, $localDate, $sessionTime, $ticketGroup);
    $stmt->execute();
    $stmt->close();

    // ── Insert post_ticket_pricing ─────────────────────────────────────────────
    if ($minPrice !== null && $currency) {
        $stmt = $mysqli->prepare(
            "INSERT INTO `post_ticket_pricing`
             (`post_map_card_id`,`ticket_group_key`,`price`,`currency`)
             VALUES (?,?,?,?)"
        );
        $stmt->bind_param('isds', $mapCardId, $ticketGroup, $minPrice, $currency);
        $stmt->execute();
        $stmt->close();
    }

    // ── Insert post_links ──────────────────────────────────────────────────────
    $linkType = 'tickets';
    $isActive = 1;
    $stmt = $mysqli->prepare(
        "INSERT INTO `post_links` (`post_map_card_id`,`link_type`,`external_url`,`is_active`)
         VALUES (?,?,?,?)"
    );
    $stmt->bind_param('issi', $mapCardId, $linkType, $ticketUrl, $isActive);
    $stmt->execute();
    $stmt->close();

    echo "OK  [{$tmId}] Post #{$postId} — {$title} @ {$venueName}, {$city} — {$sessionSummary}"
        . ($priceSummary ? " — {$priceSummary}" : '') . "\n";
    $imported++;
}

echo "\n" . str_repeat('─', 72) . "\n";
echo "Done. Imported: {$imported} | Skipped: {$skipped}\n";
echo '</pre>';
