<?php
// cron-ticketmaster-daily.php — Full daily TM pipeline: collect → import → refresh.
//
// Phase 1: Collect — 949-item genre rotation queue. Each item = 1 discovery page.
//          Seeding mode scans pages 0-4 across passes. Maintenance scans page 0 only.
// Phase 2: Import — processes all pending staging rows into posts.
// Phase 3: Clear — NULLs event_json on imported/skipped rows to reclaim storage.
// Phase 4: Refresh — updates existing active posts from TM API.
//
// API budget: 5,000/day. Collection + refresh share the budget with ~1,000 spare.
// Global counter tracks all API calls across phases and stops when limit reached.
//
// cPanel cron (daily, 3am UTC):
//   /usr/local/bin/php -q /home/funmapco/public_html/home/funmapco/connectors/cron-ticketmaster-daily.php

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}

$php = PHP_BINARY;
$dir = __DIR__;

require __DIR__ . '/../config/config-db.php';

$DAILY_BUDGET    = 5000;
$RESERVE         = 1000;
$REFRESH_CEILING = 3000;
$COLLECT_CEILING = $DAILY_BUDGET - $RESERVE - $REFRESH_CEILING;
$globalApiCalls  = 0;

// ── Cleanup: purge expired staging rows ──────────────────────────────────────

$mysqli->query(
    "DELETE ts FROM tm_staging ts
     JOIN posts p ON p.id = ts.post_id
     WHERE ts.status IN ('imported','skipped')
     AND p.expires_at < DATE_SUB(NOW(), INTERVAL 6 MONTH)"
);
echo "=== CLEANUP ===\n";
echo $mysqli->affected_rows . " expired staging rows purged\n\n";

// ── Genre rotation queue (82 genres, interleaved Music/Sports/Arts/Film) ─────

$genreQueue = [
    ['Music', 'Alternative'],
    ['Sports', 'Aquatics'],
    ['Arts & Theatre', 'Children\'s Theatre'],
    ['Film', 'Action/Adventure'],
    ['Music', 'Ballads/Romantic'],
    ['Sports', 'Baseball'],
    ['Arts & Theatre', 'Circus & Specialty Acts'],
    ['Film', 'Animation'],
    ['Music', 'Blues'],
    ['Sports', 'Basketball'],
    ['Arts & Theatre', 'Classical'],
    ['Film', 'Comedy'],
    ['Music', 'Chanson Francaise'],
    ['Sports', 'Boxing'],
    ['Arts & Theatre', 'Comedy'],
    ['Film', 'Documentary'],
    ['Music', 'Children\'s Music'],
    ['Sports', 'Cricket'],
    ['Arts & Theatre', 'Community/Civic'],
    ['Film', 'Drama'],
    ['Music', 'Classical'],
    ['Sports', 'Cycling'],
    ['Arts & Theatre', 'Cultural'],
    ['Film', 'Family'],
    ['Music', 'Country'],
    ['Sports', 'Equestrian'],
    ['Arts & Theatre', 'Dance'],
    ['Film', 'Foreign'],
    ['Music', 'Dance/Electronic'],
    ['Sports', 'eSports'],
    ['Arts & Theatre', 'Fashion'],
    ['Film', 'Horror'],
    ['Music', 'Folk'],
    ['Sports', 'Extreme Sports'],
    ['Arts & Theatre', 'Fine Art'],
    ['Film', 'Music'],
    ['Music', 'Hip-Hop/Rap'],
    ['Sports', 'Football'],
    ['Arts & Theatre', 'Magic & Illusion'],
    ['Film', 'Sci-Fi/Fantasy'],
    ['Music', 'Holiday'],
    ['Sports', 'Golf'],
    ['Arts & Theatre', 'Music'],
    ['Film', 'Thriller'],
    ['Music', 'Jazz'],
    ['Sports', 'Gymnastics'],
    ['Arts & Theatre', 'Opera'],
    ['Film', 'Urban'],
    ['Music', 'Latin'],
    ['Sports', 'Hockey'],
    ['Arts & Theatre', 'Performance Art'],
    ['Music', 'Medieval/Renaissance'],
    ['Sports', 'Ice Skating'],
    ['Arts & Theatre', 'Puppetry'],
    ['Music', 'Metal'],
    ['Sports', 'Lacrosse'],
    ['Arts & Theatre', 'Spectacular'],
    ['Music', 'New Age'],
    ['Sports', 'Martial Arts'],
    ['Arts & Theatre', 'Theatre'],
    ['Music', 'Other'],
    ['Sports', 'Motorsports/Racing'],
    ['Arts & Theatre', 'Variety'],
    ['Music', 'Pop'],
    ['Sports', 'Netball'],
    ['Music', 'R&B'],
    ['Sports', 'Rodeo'],
    ['Music', 'Reggae'],
    ['Sports', 'Rugby'],
    ['Music', 'Religious'],
    ['Sports', 'Skiing'],
    ['Music', 'Rock'],
    ['Sports', 'Soccer'],
    ['Music', 'Soul'],
    ['Sports', 'Softball'],
    ['Music', 'World'],
    ['Sports', 'Surfing'],
    ['Sports', 'Swimming'],
    ['Sports', 'Tennis'],
    ['Sports', 'Track & Field'],
    ['Sports', 'Volleyball'],
    ['Sports', 'Wrestling'],
];

$segmented   = ['GB','US','CA','AU','DE','MX','FR','ES','IT','NL','JP'];
$unsegmented = [
    'IE','NZ','SE','DK','NO','FI','PL','AT','CH','CZ','TR','BE','BR','ZA','AE','KR','IN',
    'HK','MY','IL','AR','CL','PE','GR','HU','BG','IS','EE','LV','LT','LU','MT','AD','GI','FO',
    'BH','GE','AZ','GH','DO','EC','JM','BB','BM','BS','AI','LB',
];

// Build segmented items: each genre × each country
$segItems = [];
foreach ($genreQueue as [$segment, $genre]) {
    foreach ($segmented as $cc) {
        $segItems[] = ['country' => $cc, 'segment' => $segment, 'genre' => $genre];
    }
}

// Interleave unsegmented countries evenly through the queue
$interval  = (int) floor(count($segItems) / max(1, count($unsegmented)));
$fullQueue = [];
$unsegIdx  = 0;
foreach ($segItems as $i => $item) {
    $fullQueue[] = $item;
    if (($i + 1) % $interval === 0 && $unsegIdx < count($unsegmented)) {
        $fullQueue[] = ['country' => $unsegmented[$unsegIdx++], 'segment' => null, 'genre' => null];
    }
}
while ($unsegIdx < count($unsegmented)) {
    $fullQueue[] = ['country' => $unsegmented[$unsegIdx++], 'segment' => null, 'genre' => null];
}

$queueSize = count($fullQueue);

// ── Read cursor (marker row in tm_staging with tm_event_id = '_cursor') ──────

$cursor = $mysqli->query("SELECT skip_reason FROM tm_staging WHERE tm_event_id = '_cursor' LIMIT 1");
if (!$cursor || $cursor->num_rows === 0) {
    die("ERROR: cursor marker row missing from tm_staging. Insert it first.\n");
}
$curData         = json_decode($cursor->fetch_assoc()['skip_reason'], true) ?: [];
$position        = (int) ($curData['position'] ?? 0);
$pass            = (int) ($curData['pass'] ?? 0);
$seedingComplete = (int) ($curData['seeded'] ?? 0);

$page = $seedingComplete ? 0 : $pass;

echo "=== TM COLLECT (pass {$pass}, position {$position}/{$queueSize}, "
    . ($seedingComplete ? 'MAINTENANCE' : 'SEEDING') . ") ===\n\n";

// ── Phase 1: Collection ─────────────────────────────────────────────────────

$itemsProcessed = 0;
$rateLimited    = false;

while ($globalApiCalls < $COLLECT_CEILING) {
    if ($position >= $queueSize) {
        if ($seedingComplete) {
            $position = 0;
            echo "Maintenance cycle complete, wrapping to start.\n";
            break;
        }
        $pass++;
        $position = 0;
        if ($pass >= 5) {
            $seedingComplete = 1;
            $pass = 0;
            echo "=== SEEDING COMPLETE — switching to maintenance mode ===\n";
            break;
        }
        $page = $pass;
        echo "=== Pass {$pass} starting (page {$page}) ===\n";
    }

    $item = $fullQueue[$position];
    $cc   = $item['country'];

    $qs = "country={$cc}&limit=200&pages=1&start_page={$page}";
    if ($item['segment'] !== null) {
        $qs .= '&segment=' . urlencode($item['segment']);
    }
    if ($item['genre'] !== null) {
        $qs .= '&genre=' . urlencode($item['genre']);
    }

    $label = $item['genre'] ? "{$cc}/{$item['genre']}" : "{$cc} (unsegmented)";
    echo "--- [{$position}] {$label}, page {$page} ---\n";

    $output = shell_exec(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-collect.php") . ' ' . escapeshellarg($qs));
    echo $output;

    if (preg_match('/\[API_CALLS:(\d+)\]/', $output ?? '', $m)) {
        $globalApiCalls += (int) $m[1];
    }

    if ($output && strpos($output, 'RATE LIMIT') !== false) {
        echo "Rate limited — stopping collection.\n";
        $rateLimited = true;
        break;
    }

    $position++;
    $itemsProcessed++;
}

echo "\nCollection done. Items processed: {$itemsProcessed}, API calls: {$globalApiCalls}\n";

// ── Save cursor ──────────────────────────────────────────────────────────────

$curJson = json_encode(['position' => $position, 'pass' => $pass, 'seeded' => $seedingComplete]);
$stmt = $mysqli->prepare("UPDATE tm_staging SET skip_reason = ? WHERE tm_event_id = '_cursor'");
$stmt->bind_param('s', $curJson);
$stmt->execute();
$stmt->close();

// ── Phase 2: Import all pending (loop until none remain) ─────────────────────

echo "\n=== TM IMPORT ===\n";
$importRound = 0;
while (true) {
    $importRound++;
    echo "--- Import round {$importRound} ---\n";
    passthru(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-import.php") . ' ' . escapeshellarg('limit=200'));

    $r = $mysqli->query("SELECT COUNT(*) c FROM tm_staging WHERE status = 'pending'");
    $pending = (int) $r->fetch_assoc()['c'];
    if ($pending === 0 || $importRound >= 10) break;
    echo "{$pending} still pending, importing more...\n\n";
}

// ── Phase 3: Clear event_json from processed rows ───────────────────────────

$mysqli->query(
    "UPDATE tm_staging SET event_json = '' WHERE status IN ('imported','skipped') AND event_json != ''"
);
echo "\n=== CLEAR JSON ===\n";
echo $mysqli->affected_rows . " event_json blobs cleared\n";

// ── Phase 4: Refresh existing posts ─────────────────────────────────────────

$refreshBudget = min($REFRESH_CEILING, $DAILY_BUDGET - $RESERVE - $globalApiCalls);
if ($refreshBudget < 100) {
    echo "\n=== TM REFRESH SKIPPED (only {$refreshBudget} calls remaining) ===\n";
} else {
    echo "\n=== TM REFRESH (max_api={$refreshBudget}) ===\n";
    passthru(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-refresh.php") . ' ' . escapeshellarg("limit=200&max_api={$refreshBudget}"));
}

echo "\n=== DAILY CRON COMPLETE ===\n";
echo "Total collection API calls: {$globalApiCalls}\n";
