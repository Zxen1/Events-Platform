<?php
/**
 * tm-collect.php — Ticketmaster API → tm_staging
 *
 * Phase 1: Fetches a discovery page to find attraction IDs.
 * Phase 2: For each new attraction, queries ALL its events across ALL venues
 *          so that tm-collate.php always has the complete picture for each act.
 *
 * Events with no attraction ID are ignored.
 * Segment "Miscellaneous" (venue admissions) is excluded.
 * Already-collected attractions are skipped (checked against tm_staging).
 *
 * Parameters:
 *   country    — ISO country code (default: GB)
 *   limit      — max attractions to fetch (default: 50, max: 500)
 *   pages      — discovery pages to scan (default: 3, max: 25)
 *   start_page — discovery page offset (default: 0)
 *   size       — events per discovery page (default: 200, max: 200)
 *   segment    — TM segment filter: Music, Sports, Arts & Theatre, Film (segmentName)
 *   genre      — TM genre filter: Rock, Pop, Football, Comedy, etc. (classificationName)
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

// ── Helpers ────────────────────────────────────────────────────────────────────

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

if (!function_exists('stageEvents')) {
function stageEvents(mysqli $db, array $events): array {
    $new = 0; $dup = 0;
    $stmt = $db->prepare(
        "INSERT IGNORE INTO `tm_staging` (`tm_event_id`,`attraction_id`,`venue_id`,`event_json`)
         VALUES (?,?,?,?)"
    );
    foreach ($events as $event) {
        $tmId         = $event['id'] ?? '';
        $attractionId = $event['_embedded']['attractions'][0]['id'] ?? null;
        $venueId      = $event['_embedded']['venues'][0]['id']      ?? null;
        $json         = json_encode($event, JSON_UNESCAPED_UNICODE);
        $stmt->bind_param('ssss', $tmId, $attractionId, $venueId, $json);
        $stmt->execute();
        if ($db->affected_rows > 0) $new++; else $dup++;
    }
    $stmt->close();
    return ['new' => $new, 'dup' => $dup];
}
}

// ── Parameters ─────────────────────────────────────────────────────────────────

$country        = preg_replace('/[^A-Z]/', '', strtoupper($_GET['country']    ?? 'GB'));
$pages          = min(25,  max(1, intval($_GET['pages']      ?? 3)));
$startPage      = max(0,          intval($_GET['start_page'] ?? 0));
$size           = min(200, max(1, intval($_GET['size']       ?? 200)));
$maxAttractions = min(500, max(1, intval($_GET['limit']      ?? 50)));
$segmentFilter  = $_GET['segment'] ?? '';
$genreFilter    = $_GET['genre']   ?? '';

// ── Excluded segments ───────────────────────────────────────────────────────────
// Miscellaneous = venue admissions (Sea Life, London Eye, Madame Tussauds, etc.)
// These are daily entry tickets, not events. Excluded from discovery.

$excludedSegments = ['Miscellaneous'];

// ── Output ─────────────────────────────────────────────────────────────────────

if (!$_tmCronMode) {
    header('Content-Type: text/html; charset=utf-8');
    @ob_end_flush();
    ob_implicit_flush(true);
    echo '<pre>';
}
echo "Ticketmaster collector — country={$country}, pages={$pages}, start_page={$startPage}"
    . ($segmentFilter ? ", segment={$segmentFilter}" : '')
    . ($genreFilter   ? ", genre={$genreFilter}"     : '') . "\n";
echo "Excluded segments: " . implode(', ', $excludedSegments) . "\n";
echo str_repeat('─', 72) . "\n\n";

$apiCalls            = 0;
$attractionsHit      = 0;
$totalNew            = 0;
$totalDup            = 0;
$totalPages          = null;
$_lastRateLimitAvail = null;

// ── Phase 1: Discovery pages ───────────────────────────────────────────────────

$discoveredAttractions = []; // attraction_id => true

for ($p = $startPage; $p < $startPage + $pages; $p++) {

    if ($totalPages !== null && $p >= $totalPages) {
        echo "Reached last discovery page ({$totalPages}).\n";
        break;
    }

    $discoveryParams = [
        'apikey'        => $TICKETMASTER_CONSUMER_KEY,
        'countryCode'   => $country,
        'size'          => $size,
        'page'          => $p,
        'sort'          => 'date,asc',
        'startDateTime' => date('Y-m-d') . 'T00:00:00Z',
    ];
    if ($segmentFilter !== '') {
        $discoveryParams['segmentName'] = $segmentFilter;
    }
    if ($genreFilter !== '') {
        $discoveryParams['classificationName'] = $genreFilter;
    }
    $url = 'https://app.ticketmaster.com/discovery/v2/events.json?' . http_build_query($discoveryParams);

    $data = tmFetch($url);
    if (isset($data['_error'])) {
        echo "Phase 1 error: {$data['_error']} — stopping discovery.\n";
        break;
    }
    $apiCalls++;
    if (isset($data['_headers']['rate-limit-available'])) {
        $_lastRateLimitAvail = (int) $data['_headers']['rate-limit-available'];
    }

    if ($totalPages === null) {
        $totalPages = max(1, intval($data['page']['totalPages']    ?? 1));
        $total      = intval($data['page']['totalElements'] ?? 0);
        echo "API reports {$total} total events, {$totalPages} pages.\n\n";
    }

    $events = $data['_embedded']['events'] ?? [];
    if (empty($events)) { echo "Page {$p}: empty.\n"; break; }

    // Collect attraction IDs from this page (skip excluded segments and no-ID events)
    $excludedCount = 0;
    foreach ($events as $event) {
        $eventSegment = $event['classifications'][0]['segment']['name'] ?? '';
        if (in_array($eventSegment, $excludedSegments, true)) {
            $excludedCount++;
            continue;
        }
        $attractionId = $event['_embedded']['attractions'][0]['id'] ?? null;
        if ($attractionId) {
            $discoveredAttractions[$attractionId] = true;
        }
    }

    echo "Page {$p}: scanned — " . count($events) . " events, "
        . count($discoveredAttractions) . " attractions found so far"
        . ($excludedCount ? ", {$excludedCount} excluded (Miscellaneous)" : "") . "\n";

    if ($p < $startPage + $pages - 1) usleep(250000);
}

echo "\nDiscovery complete. Found " . count($discoveredAttractions) . " unique attraction IDs.\n\n";
echo str_repeat('─', 72) . "\n";
echo "Phase 2: Fetching all events per attraction...\n\n";

// ── Phase 2: Targeted fetch per attraction ─────────────────────────────────────

foreach ($discoveredAttractions as $attractionId => $_) {

    if ($attractionsHit >= $maxAttractions) {
        echo "Reached attraction limit ({$maxAttractions}).\n";
        break;
    }

    // Skip if this attraction is already in staging (previously collected)
    $attEsc = $mysqli->real_escape_string($attractionId);
    $exists = $mysqli->query(
        "SELECT id FROM tm_staging WHERE attraction_id = '{$attEsc}' LIMIT 1"
    );
    if ($exists && $exists->num_rows > 0) {
        echo "SKIP [{$attractionId}] — already in staging\n";
        continue;
    }

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
            echo "WARN [{$attractionId}] — {$data['_error']} on page {$page}, skipping attraction\n";
            $allEvents = [];
            break;
        }
        $apiCalls++;
        if (isset($data['_headers']['rate-limit-available'])) {
            $_lastRateLimitAvail = (int) $data['_headers']['rate-limit-available'];
        }

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
        echo "  [{$attractionId}] — no events returned\n";
        usleep(250000);
        continue;
    }

    $r = stageEvents($mysqli, $allEvents);
    $totalNew     += $r['new'];
    $totalDup     += $r['dup'];
    $attractionsHit++;

    $venueCount = count(array_unique(array_filter(
        array_map(fn($e) => $e['_embedded']['venues'][0]['id'] ?? null, $allEvents)
    )));
    echo "OK  [{$attractionId}] {$attractionName} — " . count($allEvents)
        . " events across {$venueCount} venue(s) — +{$r['new']} new\n";

    usleep(250000);
}

// ── Summary ────────────────────────────────────────────────────────────────────

$pending = $mysqli->query("SELECT COUNT(*) c FROM tm_staging WHERE status='pending'")->fetch_assoc()['c'] ?? 0;

echo "\n" . str_repeat('─', 72) . "\n";
echo "API calls used: {$apiCalls}  |  Attractions fetched: {$attractionsHit}\n";
echo "New events staged: {$totalNew}  |  Duplicates skipped: {$totalDup}\n";
echo "Total pending in staging: {$pending}\n";
echo "\nRun tm-collate.php to process staged events into posts.\n";
echo "[API_CALLS:{$apiCalls}]\n";
if ($_lastRateLimitAvail !== null) {
    echo "[RATE_LIMIT_AVAILABLE:{$_lastRateLimitAvail}]\n";
}
if (!$_tmCronMode) echo '</pre>';
