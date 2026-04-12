<?php
/**
 * tm-refresh.php — Daily update of existing TM-collated posts
 *
 * Reads posts.tm_attraction_id to build the refresh list (fast indexed query).
 * Batches multiple attraction IDs into comma-separated API calls (up to 200
 * results per page across many attractions). Paginates each batch to
 * completion, then processes results grouped by attraction.
 *
 * Tracks position via the _cursor row in tm_staging (refresh_position field).
 * Each run continues from where the previous run stopped. Cycles back to
 * the start when all posts have been reached.
 *
 * Budget check is between batches — a multi-page batch is always completed
 * even if that exceeds the budget slightly.
 *
 * Parameters:
 *   max_api  — hard API call ceiling for this run (default: 2000)
 */

declare(strict_types=1);

if (php_sapi_name() === 'cli' && !defined('TM_CRON_ORCHESTRATOR') && isset($argv[1])) {
    parse_str($argv[1], $_GET);
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────

$_tmCronMode = defined('TM_CRON_ORCHESTRATOR');

if ($_tmCronMode) {
    global $mysqli, $TICKETMASTER_CONSUMER_KEY;
} else {
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
}

// ── Constants ──────────────────────────────────────────────────────────────────

if (!defined('TM_ATTRIBUTION')) {
    define('TM_ATTRIBUTION', "Powered by Ticketmaster\n\nClick the Get Tickets button for full event details, pricing, and availability.");
}
if (!defined('COORD_PRECISION')) {
    define('COORD_PRECISION', 4);
}
if (!defined('SEGMENT_MAP')) {
    define('SEGMENT_MAP', [
        'Music'          => 'live-music',
        'Sports'         => 'live-sport',
        'Arts & Theatre' => 'performing-arts',
        'Film'           => 'cinema',
        'Miscellaneous'  => 'other-events',
    ]);
}
if (!defined('GENRE_OVERRIDES')) {
    define('GENRE_OVERRIDES', [
        'Festival'  => 'festivals',
        'Festivals' => 'festivals',
    ]);
}

// ── Helpers (same logic as tm-collate.php) ──────────────────────────────────────

if (!function_exists('tmFetch')) {
function tmFetch(string $url): array {
    $ch = curl_init($url);
    $responseHeaders = [];
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HEADERFUNCTION => function ($ch, $header) use (&$responseHeaders) {
            $len   = strlen($header);
            $parts = explode(':', $header, 2);
            if (count($parts) === 2) {
                $responseHeaders[strtolower(trim($parts[0]))] = trim($parts[1]);
            }
            return $len;
        },
    ]);
    $resp     = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($httpCode === 429) return ['_error' => 'rate_limit', '_headers' => $responseHeaders];
    if ($httpCode !== 200 || !$resp) return ['_error' => 'http_' . $httpCode];
    $decoded = json_decode($resp, true);
    if (!is_array($decoded)) return ['_error' => 'bad_json'];
    $decoded['_headers'] = $responseHeaders;
    return $decoded;
}
}

if (!function_exists('sessionKey')) {
function sessionKey(int $n): string {
    $a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if ($n < 26) return $a[$n];
    return $a[intdiv($n, 26) - 1] . $a[$n % 26];
}
}

if (!function_exists('groupDescription')) {
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
}

if (!function_exists('groupSubcategory')) {
function groupSubcategory(array $events): string {
    $segment = $events[0]['classifications'][0]['segment']['name'] ?? 'Miscellaneous';
    $genre   = $events[0]['classifications'][0]['genre']['name']   ?? '';
    if (isset(GENRE_OVERRIDES[$genre])) return GENRE_OVERRIDES[$genre];
    return SEGMENT_MAP[$segment] ?? 'other-events';
}
}

if (!function_exists('priceSummary')) {
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
}

if (!function_exists('coordKey')) {
function coordKey(float $lat, float $lng): string {
    return round($lat, COORD_PRECISION) . ',' . round($lng, COORD_PRECISION);
}
}

// ── Parameters ─────────────────────────────────────────────────────────────────

$maxApi = min(5000, max(1, intval($_GET['max_api'] ?? 2000)));
$BATCH_SIZE = 200;

// ── Read refresh cursor ────────────────────────────────────────────────────────

$refreshPosition = 0;
$cursorRow = $mysqli->query(
    "SELECT skip_reason FROM tm_staging WHERE tm_event_id = '_cursor' LIMIT 1"
);
if ($cursorRow && $crow = $cursorRow->fetch_assoc()) {
    $cursorData = json_decode($crow['skip_reason'], true) ?: [];
    $refreshPosition = (int) ($cursorData['refresh_position'] ?? 0);
}

// ── Load TM posts from cursor position ─────────────────────────────────────────

$allPosts = [];
$res = $mysqli->query(
    "SELECT id, tm_attraction_id FROM posts
     WHERE tm_attraction_id IS NOT NULL
       AND expires_at > NOW()
       AND id > {$refreshPosition}
     ORDER BY id ASC"
);
while ($row = $res->fetch_assoc()) {
    $allPosts[] = ['post_id' => (int) $row['id'], 'attraction_id' => $row['tm_attraction_id']];
}

$cycled = false;
if (empty($allPosts)) {
    $refreshPosition = 0;
    $cycled = true;
    $res = $mysqli->query(
        "SELECT id, tm_attraction_id FROM posts
         WHERE tm_attraction_id IS NOT NULL
           AND expires_at > NOW()
         ORDER BY id ASC"
    );
    while ($row = $res->fetch_assoc()) {
        $allPosts[] = ['post_id' => (int) $row['id'], 'attraction_id' => $row['tm_attraction_id']];
    }
}

if (empty($allPosts)) {
    $msg = 'No TM posts to refresh.';
    if ($_tmCronMode) { echo $msg . "\n[API_CALLS:0]\n"; return; }
    die('<pre>' . $msg . '</pre>');
}

// ── Output header ──────────────────────────────────────────────────────────────

if (!$_tmCronMode) {
    header('Content-Type: text/html; charset=utf-8');
    @ob_end_flush();
    ob_implicit_flush(true);
    echo '<pre>';
}
echo "Ticketmaster refresh — " . count($allPosts) . " posts queued (budget: {$maxApi})";
if ($cycled) echo " [cycled to start]";
echo "\n" . str_repeat('─', 72) . "\n\n";

$apiCalls            = 0;
$updated             = 0;
$unchanged           = 0;
$errors              = 0;
$deleted             = 0;
$_lastRateLimitAvail = null;
$lastPostId          = $refreshPosition;

// ── Process in batches ─────────────────────────────────────────────────────────

$totalPosts = count($allPosts);
$offset     = 0;

while ($offset < $totalPosts) {

    if ($apiCalls >= $maxApi) {
        echo "API budget reached ({$maxApi}) — stopping.\n";
        break;
    }

    // ── Build batch ────────────────────────────────────────────────────────────

    $batch = array_slice($allPosts, $offset, $BATCH_SIZE);
    $offset += count($batch);

    $batchMap = [];
    $idList   = [];
    foreach ($batch as $row) {
        $batchMap[$row['attraction_id']] = $row['post_id'];
        if (!in_array($row['attraction_id'], $idList)) {
            $idList[] = $row['attraction_id'];
        }
    }

    // ── Fetch all events for this batch from TM API ────────────────────────────

    $batchEvents = [];
    $page = 0;
    $rateLimitHit = false;
    $fetchError   = false;

    $baseParams = [
        'apikey'        => $TICKETMASTER_CONSUMER_KEY,
        'attractionId'  => implode(',', $idList),
        'size'          => 200,
        'sort'          => 'date,asc',
        'startDateTime' => date('Y-m-d') . 'T00:00:00Z',
    ];

    while (true) {
        $baseParams['page'] = $page;
        $url = 'https://app.ticketmaster.com/discovery/v2/events.json?' . http_build_query($baseParams);

        $data = tmFetch($url);
        if (isset($data['_error'])) {
            if ($data['_error'] === 'rate_limit') {
                echo "RATE LIMIT — stopping entirely.\n";
                $rateLimitHit = true;
                break;
            }
            echo "WARN batch — {$data['_error']}, skipping batch\n";
            $fetchError = true;
            $errors += count($idList);
            break;
        }
        $apiCalls++;
        if (isset($data['_headers']['rate-limit-available'])) {
            $_lastRateLimitAvail = (int) $data['_headers']['rate-limit-available'];
        }

        $events = $data['_embedded']['events'] ?? [];
        if (empty($events)) break;

        $batchEvents = array_merge($batchEvents, $events);

        $totalPages = $data['page']['totalPages'] ?? 1;
        $page++;
        if ($page >= $totalPages) break;
        usleep(250000);
    }

    if ($rateLimitHit) break;
    if ($fetchError) {
        $lastPostId = end($batch)['post_id'];
        continue;
    }

    // ── Group events by attraction ─────────────────────────────────────────────

    $eventsByAttraction = [];
    foreach ($batchEvents as $event) {
        $attId = $event['_embedded']['attractions'][0]['id'] ?? null;
        if ($attId && isset($batchMap[$attId])) {
            $eventsByAttraction[$attId][] = $event;
        }
    }

    // ── Process each attraction in the batch ───────────────────────────────────

    foreach ($batchMap as $attractionId => $postId) {

    $allEvents     = $eventsByAttraction[$attractionId] ?? [];
    $attractionName = $attractionId;
    if (!empty($allEvents)) {
        $attractionName = $allEvents[0]['_embedded']['attractions'][0]['name'] ?? $attractionId;
    }

    // ── Handle zero future events ──────────────────────────────────────────────

    if (empty($allEvents)) {
        $pastCheck = $mysqli->query(
            "SELECT COUNT(*) AS cnt FROM post_sessions ps
             JOIN post_map_cards mc ON mc.id = ps.post_map_card_id
             WHERE mc.post_id = {$postId} AND ps.session_date < CURDATE()"
        );
        $hasPast = (int) ($pastCheck->fetch_assoc()['cnt'] ?? 0);

        $attEsc = $mysqli->real_escape_string($attractionId);

        $mysqli->begin_transaction();
        try {
            if ($hasPast === 0) {
                $mysqli->query("DELETE FROM posts WHERE id = {$postId}");
                $mysqli->commit();
                $mysqli->query("UPDATE tm_staging SET processed_at = NOW() WHERE attraction_id = '{$attEsc}' AND status = 'imported'");
                echo "DEL [{$attractionId}] {$attractionName} — no events, no history, post #{$postId} deleted\n";
                $deleted++;
            } else {
                $cardIds = [];
                $cRes = $mysqli->query("SELECT id FROM post_map_cards WHERE post_id = {$postId}");
                while ($cRow = $cRes->fetch_assoc()) $cardIds[] = (int) $cRow['id'];

                if (!empty($cardIds)) {
                    $cardIdList = implode(',', $cardIds);
                    $mysqli->query(
                        "DELETE ptp FROM post_ticket_pricing ptp
                         JOIN post_sessions ps ON ps.post_map_card_id = ptp.post_map_card_id
                           AND ps.ticket_group_key = ptp.ticket_group_key
                         WHERE ps.post_map_card_id IN ({$cardIdList}) AND ps.session_date >= CURDATE()"
                    );
                    $mysqli->query("DELETE FROM post_sessions WHERE post_map_card_id IN ({$cardIdList}) AND session_date >= CURDATE()");

                    foreach ($cardIds as $cid) {
                        $mysqli->query(
                            "UPDATE post_map_cards SET
                             start_date = (SELECT MIN(ps.session_date) FROM post_sessions ps WHERE ps.post_map_card_id = {$cid}),
                             end_date = (SELECT MAX(ps.session_date) FROM post_sessions ps WHERE ps.post_map_card_id = {$cid})
                             WHERE id = {$cid}"
                        );
                    }
                }

                $mysqli->commit();
                $mysqli->query("UPDATE tm_staging SET processed_at = NOW() WHERE attraction_id = '{$attEsc}' AND status = 'imported'");
                echo "EXP [{$attractionId}] {$attractionName} — no future events, past preserved\n";
                $unchanged++;
            }
        } catch (\Throwable $e) {
            $mysqli->rollback();
            echo "ERROR [{$attractionId}] {$attractionName} — transaction failed: {$e->getMessage()}\n";
            $errors++;
        }

        usleep(250000);
        continue;
    }

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

    $validVenueGroups = [];
    foreach ($venueGroups as $vk => $vEvts) {
        $v = $vEvts[0]['_embedded']['venues'][0] ?? null;
        if ($v && !empty($v['location']['latitude']) && !empty($v['location']['longitude'])) {
            $validVenueGroups[$vk] = $vEvts;
        }
    }

    if (empty($validVenueGroups)) {
        echo "SKIP [{$attractionId}] {$attractionName} — no venues with coordinates\n";
        $attEsc = $mysqli->real_escape_string($attractionId);
        $mysqli->query("UPDATE tm_staging SET processed_at = NOW() WHERE attraction_id = '{$attEsc}' AND status = 'imported'");
        $unchanged++;
        usleep(250000);
        continue;
    }

    // ── Update staging JSON for ALL events, track which tm_event_ids changed ─

    $stmtUpdate = $mysqli->prepare(
        "UPDATE tm_staging SET event_json = ? WHERE tm_event_id = ? AND attraction_id = ?"
    );
    $stmtInsert = $mysqli->prepare(
        "INSERT IGNORE INTO tm_staging (tm_event_id, attraction_id, venue_id, event_json, status, post_id)
         VALUES (?, ?, ?, ?, 'imported', ?)"
    );

    $changedTmEventIds = [];
    foreach ($allEvents as $event) {
        $tmId    = $event['id'] ?? '';
        $venueId = $event['_embedded']['venues'][0]['id'] ?? null;
        $json    = json_encode($event, JSON_UNESCAPED_UNICODE);
        $stmtUpdate->bind_param('sss', $json, $tmId, $attractionId);
        $stmtUpdate->execute();
        if ($mysqli->affected_rows > 0) {
            $changedTmEventIds[$tmId] = true;
        }
        if ($stmtUpdate->affected_rows === 0) {
            $stmtInsert->bind_param('ssssi', $tmId, $attractionId, $venueId, $json, $postId);
            $stmtInsert->execute();
            if ($mysqli->affected_rows > 0) {
                $changedTmEventIds[$tmId] = true;
            }
        }
    }
    $stmtUpdate->close();
    $stmtInsert->close();

    // ── Map changed event IDs to venue keys ──────────────────────────────────

    $changedVenueKeys = [];
    foreach ($validVenueGroups as $vk => $vEvts) {
        foreach ($vEvts as $event) {
            if (isset($changedTmEventIds[$event['id'] ?? ''])) {
                $changedVenueKeys[$vk] = true;
                break;
            }
        }
    }

    // ── Also detect removed events (in staging but no longer in TM response) ─

    $allTmEventIds = [];
    foreach ($allEvents as $event) {
        $allTmEventIds[] = $event['id'] ?? '';
    }
    $attEscCheck = $mysqli->real_escape_string($attractionId);
    $existingRes = $mysqli->query(
        "SELECT tm_event_id, venue_id FROM tm_staging
         WHERE attraction_id = '{$attEscCheck}' AND status = 'imported'"
    );
    while ($existingRow = $existingRes->fetch_assoc()) {
        if (!in_array($existingRow['tm_event_id'], $allTmEventIds) && $existingRow['tm_event_id'] !== '_cursor') {
            $removedVenueId = $existingRow['venue_id'];
            foreach ($validVenueGroups as $vk => $vEvts) {
                $vId = $vEvts[0]['_embedded']['venues'][0]['id'] ?? null;
                if ($vId === $removedVenueId) {
                    $changedVenueKeys[$vk] = true;
                }
            }
            $mysqli->query(
                "DELETE FROM tm_staging WHERE tm_event_id = '" .
                $mysqli->real_escape_string($existingRow['tm_event_id']) .
                "' AND attraction_id = '{$attEscCheck}'"
            );
        }
    }

    // ── Compute fresh post-level values ────────────────────────────────────────

    $freshSubcat = groupSubcategory($allEvents);
    $freshLocQty = count($validVenueGroups);
    $allDates    = [];
    foreach ($validVenueGroups as $vEvts) {
        $allDates[] = $vEvts[count($vEvts) - 1]['dates']['start']['localDate'] ?? '';
    }
    $freshExpires = date('Y-m-d H:i:s', strtotime(max($allDates) . ' +12 months'));

    // ── Load and update post ───────────────────────────────────────────────────

    $postRow = $mysqli->query(
        "SELECT subcategory_key, loc_qty, loc_paid, expires_at FROM posts WHERE id = {$postId}"
    )->fetch_assoc();

    if (!$postRow) {
        echo "ERROR [{$attractionId}] {$attractionName} — Post #{$postId} not found in DB\n";
        $errors++;
        continue;
    }

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

    // ── Load existing map cards by coordinate ──────────────────────────────────

    $existingCards = [];
    $cardRes = $mysqli->query("SELECT * FROM post_map_cards WHERE post_id = {$postId}");
    while ($card = $cardRes->fetch_assoc()) {
        $ck = coordKey((float) $card['latitude'], (float) $card['longitude']);
        $existingCards[$ck] = $card;
    }

    $freshTitle       = trim($allEvents[0]['_embedded']['attractions'][0]['name'] ?? $allEvents[0]['name'] ?? '');
    $freshDescription = groupDescription($allEvents, $freshLocQty);
    $newVenues        = 0;
    $processedCoords  = [];

    $mediaIdStr = '';
    $mediaRes = $mysqli->query("SELECT id FROM post_media WHERE post_id = {$postId} ORDER BY id ASC LIMIT 1");
    if ($mRow = $mediaRes->fetch_assoc()) $mediaIdStr = (string) $mRow['id'];

    // ── Process each venue: skip unchanged, rebuild changed, insert new ──────

    $mysqli->begin_transaction();

    try {

    foreach ($validVenueGroups as $vk => $vEvts) {

        $venue       = $vEvts[0]['_embedded']['venues'][0];
        $latitude    = (float) $venue['location']['latitude'];
        $longitude   = (float) $venue['location']['longitude'];
        $ck          = coordKey($latitude, $longitude);
        $processedCoords[$ck] = true;

        $isNew     = !isset($existingCards[$ck]);
        $isChanged = isset($changedVenueKeys[$vk]);

        // ── Unchanged existing venue — skip entirely ─────────────────────────
        if (!$isNew && !$isChanged) {
            continue;
        }

        $venueName   = trim($venue['name']                      ?? '');
        $addressLine = trim($venue['address']['line1']          ?? '');
        $city        = trim($venue['city']['name']              ?? '');
        $state       = (trim($venue['state']['name']    ?? '') ?: null);
        $postcode    = (trim($venue['postalCode']        ?? '') ?: null);
        $countryName = trim($venue['country']['name']           ?? '');
        $countryCode = trim($venue['country']['countryCode']    ?? '');
        $timezone    = $vEvts[0]['dates']['timezone'] ?? 'UTC';

        $venueTicketUrl = trim($vEvts[0]['url'] ?? '');
        $venuePriceSumm = priceSummary($vEvts);

        if ($isNew) {
            $newVenues++;
            $changes[] = "new venue: {$venueName}, {$city}";
        } else {
            $changes[] = "updated venue: {$venueName}, {$city}";
        }

        // ── Save past data and update/insert card ─────────────────────────────
        $pastSessions = [];
        $pastPricing  = [];
        $cardId       = 0;

        if (!$isNew) {
            $cardId = (int) $existingCards[$ck]['id'];

            $psRes = $mysqli->query(
                "SELECT session_date, session_time, ticket_group_key
                 FROM post_sessions WHERE post_map_card_id = {$cardId} AND session_date < CURDATE()"
            );
            while ($ps = $psRes->fetch_assoc()) $pastSessions[] = $ps;

            if (!empty($pastSessions)) {
                $pastKeys = array_map(fn($s) => "'" . $mysqli->real_escape_string($s['ticket_group_key']) . "'", $pastSessions);
                $ppRes = $mysqli->query(
                    "SELECT ticket_group_key, allocated_areas, ticket_area, pricing_tier, price, currency
                     FROM post_ticket_pricing WHERE post_map_card_id = {$cardId}
                     AND ticket_group_key IN (" . implode(',', $pastKeys) . ")"
                );
                while ($pp = $ppRes->fetch_assoc()) $pastPricing[] = $pp;
            }

            // Delete children — they'll be reinserted below
            $mysqli->query("DELETE FROM post_ticket_pricing WHERE post_map_card_id = {$cardId}");
            $mysqli->query("DELETE FROM post_item_pricing WHERE post_map_card_id = {$cardId}");
            $mysqli->query("DELETE FROM post_sessions WHERE post_map_card_id = {$cardId}");
            $mysqli->query("DELETE FROM post_amenities WHERE post_map_card_id = {$cardId}");

            // UPDATE card in place — preserves post_map_card_id
            $locType = 'venue';
            $stmt = $mysqli->prepare(
                "UPDATE `post_map_cards` SET
                 `subcategory_key`=?,`title`=?,`description`=?,`media_ids`=?,
                 `location_type`=?,`venue_name`=?,`address_line`=?,`city`=?,`state`=?,
                 `postcode`=?,`country_name`=?,`country_code`=?,
                 `latitude`=?,`longitude`=?,`timezone`=?,
                 `ticket_url`=?,`price_summary`=?,`updated_at`=NOW()
                 WHERE `id`=?"
            );
            $stmt->bind_param(
                'ssssssssssssddsss' . 'i',
                $freshSubcat, $freshTitle, $freshDescription, $mediaIdStr,
                $locType, $venueName, $addressLine, $city, $state,
                $postcode, $countryName, $countryCode,
                $latitude, $longitude, $timezone,
                $venueTicketUrl, $venuePriceSumm,
                $cardId
            );
            $stmt->execute();
            $stmt->close();
        } else {
            // INSERT new card
            $stmt = $mysqli->prepare(
                "INSERT INTO `post_map_cards`
                 (`post_id`,`subcategory_key`,`title`,`description`,`media_ids`,
                  `location_type`,`venue_name`,`address_line`,`city`,`state`,
                  `postcode`,`country_name`,`country_code`,
                  `latitude`,`longitude`,`timezone`,
                  `ticket_url`,`price_summary`)
                 VALUES (?,?,?,?,?,'venue',?,?,?,?,?,?,?,?,?,?,?,?)"
            );
            $stmt->bind_param(
                'isssssssssssddsss',
                $postId, $freshSubcat, $freshTitle, $freshDescription, $mediaIdStr,
                $venueName, $addressLine, $city, $state,
                $postcode, $countryName, $countryCode,
                $latitude, $longitude, $timezone,
                $venueTicketUrl, $venuePriceSumm
            );
            $stmt->execute();
            $cardId = $mysqli->insert_id;
            $stmt->close();
        }

        // ── Reinsert past sessions ───────────────────────────────────────────
        $pastCount = 0;
        foreach ($pastSessions as $ps) {
            $stmt = $mysqli->prepare(
                "INSERT INTO `post_sessions` (`post_map_card_id`,`session_date`,`session_time`,`ticket_group_key`)
                 VALUES (?,?,?,?)"
            );
            $stmt->bind_param('isss', $cardId, $ps['session_date'], $ps['session_time'], $ps['ticket_group_key']);
            $stmt->execute();
            $stmt->close();
            $pastCount++;
        }
        foreach ($pastPricing as $pp) {
            $ppAllocated = (int) $pp['allocated_areas'];
            $ppPrice     = (float) $pp['price'];
            $stmt = $mysqli->prepare(
                "INSERT INTO `post_ticket_pricing`
                 (`post_map_card_id`,`ticket_group_key`,`allocated_areas`,`ticket_area`,`pricing_tier`,`price`,`currency`)
                 VALUES (?,?,?,?,?,?,?)"
            );
            $stmt->bind_param('isissds', $cardId, $pp['ticket_group_key'], $ppAllocated, $pp['ticket_area'], $pp['pricing_tier'], $ppPrice, $pp['currency']);
            $stmt->execute();
            $stmt->close();
        }

        // ── Insert future sessions from TM ───────────────────────────────────
        foreach ($vEvts as $i => $event) {
            $gk        = sessionKey($pastCount + $i);
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

        // ── Recalculate dates ────────────────────────────────────────────────
        $mysqli->query(
            "UPDATE post_map_cards SET
             start_date = (SELECT MIN(ps.session_date) FROM post_sessions ps WHERE ps.post_map_card_id = {$cardId}),
             end_date = (SELECT MAX(ps.session_date) FROM post_sessions ps WHERE ps.post_map_card_id = {$cardId})
             WHERE id = {$cardId}"
        );
    }

    // ── Handle removed venues (in DB but not in TM response) ─────────────────

    foreach ($existingCards as $ck => $oldCard) {
        if (isset($processedCoords[$ck])) continue;

        $oldCardId = (int) $oldCard['id'];
        $hasPastSessions = false;
        $psCheck = $mysqli->query(
            "SELECT COUNT(*) AS cnt FROM post_sessions
             WHERE post_map_card_id = {$oldCardId} AND session_date < CURDATE()"
        );
        if ($psCheck && ($r = $psCheck->fetch_assoc())) {
            $hasPastSessions = ((int) $r['cnt']) > 0;
        }

        if ($hasPastSessions) {
            $mysqli->query(
                "DELETE ptp FROM post_ticket_pricing ptp
                 JOIN post_sessions ps ON ps.post_map_card_id = ptp.post_map_card_id
                   AND ps.ticket_group_key = ptp.ticket_group_key
                 WHERE ps.post_map_card_id = {$oldCardId} AND ps.session_date >= CURDATE()"
            );
            $mysqli->query("DELETE FROM post_sessions WHERE post_map_card_id = {$oldCardId} AND session_date >= CURDATE()");
            $mysqli->query(
                "UPDATE post_map_cards SET
                 start_date = (SELECT MIN(ps.session_date) FROM post_sessions ps WHERE ps.post_map_card_id = {$oldCardId}),
                 end_date = (SELECT MAX(ps.session_date) FROM post_sessions ps WHERE ps.post_map_card_id = {$oldCardId})
                 WHERE id = {$oldCardId}"
            );
            $changes[] = "venue removed (past preserved): " . ($oldCard['venue_name'] ?? 'unknown');
        } else {
            $mysqli->query("DELETE FROM post_ticket_pricing WHERE post_map_card_id = {$oldCardId}");
            $mysqli->query("DELETE FROM post_item_pricing WHERE post_map_card_id = {$oldCardId}");
            $mysqli->query("DELETE FROM post_sessions WHERE post_map_card_id = {$oldCardId}");
            $mysqli->query("DELETE FROM post_amenities WHERE post_map_card_id = {$oldCardId}");
            $mysqli->query("DELETE FROM post_map_cards WHERE id = {$oldCardId}");
            $changes[] = "venue removed: " . ($oldCard['venue_name'] ?? 'unknown');
        }
    }

    $mysqli->commit();

    } catch (\Throwable $e) {
        $mysqli->rollback();
        echo "ERROR [{$attractionId}] {$attractionName} — transaction failed: {$e->getMessage()}\n";
        $errors++;
        usleep(250000);
        continue;
    }

    // ── Mark this attraction as freshly refreshed ─────────────────────────────

    $attEsc = $mysqli->real_escape_string($attractionId);
    $mysqli->query(
        "UPDATE tm_staging SET processed_at = NOW()
         WHERE attraction_id = '{$attEsc}' AND status = 'imported'"
    );

    if (empty($changes) && $newVenues === 0) {
        echo "  [{$attractionId}] {$attractionName} — no changes\n";
        $unchanged++;
    } else {
        echo "OK  [{$attractionId}] {$attractionName} Post #{$postId}";
        if ($newVenues) echo " — {$newVenues} new venue(s)";
        echo "\n";
        foreach ($changes as $c) echo "    ↳ {$c}\n";
        $updated++;
    }

    } // end foreach batchMap (per-attraction)

    $lastPostId = end($batch)['post_id'];
    usleep(250000);

} // end while (batch loop)

// ── Save refresh cursor ────────────────────────────────────────────────────────

$cursorRow = $mysqli->query(
    "SELECT skip_reason FROM tm_staging WHERE tm_event_id = '_cursor' LIMIT 1"
);
if ($cursorRow && $crow = $cursorRow->fetch_assoc()) {
    $cursorData = json_decode($crow['skip_reason'], true) ?: [];
} else {
    $cursorData = [];
}
$cursorData['refresh_position'] = $lastPostId;
$cursorJson = $mysqli->real_escape_string(json_encode($cursorData));
$mysqli->query(
    "UPDATE tm_staging SET skip_reason = '{$cursorJson}' WHERE tm_event_id = '_cursor'"
);

echo "\nCursor saved: post #{$lastPostId}\n";

// ── Summary ────────────────────────────────────────────────────────────────────

echo "\n" . str_repeat('─', 72) . "\n";
echo "API calls: {$apiCalls}  |  Updated: {$updated}  |  Unchanged: {$unchanged}  |  Errors: {$errors}  |  Deleted: {$deleted}\n";
echo "[API_CALLS:{$apiCalls}]\n";
if ($_lastRateLimitAvail !== null) {
    echo "[RATE_LIMIT_AVAILABLE:{$_lastRateLimitAvail}]\n";
}
if (!$_tmCronMode) echo '</pre>';
