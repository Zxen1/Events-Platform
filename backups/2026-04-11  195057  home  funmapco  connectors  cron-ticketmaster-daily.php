<?php
// cron-ticketmaster-daily.php — Full daily TM pipeline: collect → import → refresh.
//
// Includes each phase script directly (no subprocesses) to avoid
// disabled shell_exec/passthru on shared hosting (PHP 8.x).
//
// All output is logged to ../logs/tm-cron-YYYY-MM-DD.log.
// Logs auto-rotate after 30 days.
//
// Phase 1: Collect — 949-item genre rotation queue via tm-collect.php
// Phase 2: Import  — processes pending staging rows via tm-import.php
// Phase 3: Clear   — NULLs event_json on processed rows to reclaim storage
// Phase 4: Refresh — updates existing active posts via tm-refresh.php
//
// API budget: 5,000/day. Collection + refresh share the budget with ~1,000 spare.
//
// cPanel cron (daily, 3am UTC):
//   /usr/local/bin/php -q /home/funmapco/public_html/home/funmapco/connectors/cron-ticketmaster-daily.php

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}

define('TM_CRON_ORCHESTRATOR', true);

$dir = __DIR__;

// ── Logging ─────────────────────────────────────────────────────────────────

$_logDir  = __DIR__ . '/../logs';
if (!is_dir($_logDir)) @mkdir($_logDir, 0755, true);
$_logFile = $_logDir . '/tm-cron-' . date('Y-m-d') . '.log';
$_logFp   = fopen($_logFile, 'a');

function cronLog(string $msg): void {
    global $_logFp;
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . "\n";
    echo $line;
    if ($_logFp) fwrite($_logFp, $line);
}

function cronLogBlock(string $output): void {
    $clean = trim(strip_tags($output));
    if ($clean === '') return;
    foreach (explode("\n", $clean) as $line) {
        $trimmed = trim($line);
        if ($trimmed !== '') cronLog('  ' . $trimmed);
    }
}

foreach (glob($_logDir . '/tm-cron-*.log') as $_old) {
    if (filemtime($_old) < time() - 30 * 86400) @unlink($_old);
}

cronLog(str_repeat('=', 72));
cronLog('TM DAILY CRON STARTED');
cronLog(str_repeat('=', 72));

// ── Bootstrap ───────────────────────────────────────────────────────────────

$_configDbCandidates = [
    __DIR__ . '/../config/config-db.php',
    dirname(__DIR__) . '/config/config-db.php',
    dirname(__DIR__, 2) . '/config/config-db.php',
    dirname(__DIR__, 3) . '/../config/config-db.php',
    dirname(__DIR__) . '/../config/config-db.php',
];
$_configAppCandidates = [
    __DIR__ . '/../config/config-app.php',
    dirname(__DIR__) . '/config/config-app.php',
    dirname(__DIR__, 2) . '/config/config-app.php',
    dirname(__DIR__, 3) . '/../config/config-app.php',
    dirname(__DIR__) . '/../config/config-app.php',
];

$_dbLoaded = false;
foreach ($_configDbCandidates as $_p) {
    if (is_file($_p)) { require $_p; $_dbLoaded = true; break; }
}
if (!$_dbLoaded) {
    cronLog('FATAL: config-db.php not found. Candidates: ' . implode(', ', $_configDbCandidates));
    if ($_logFp) fclose($_logFp);
    exit(1);
}
foreach ($_configAppCandidates as $_p) {
    if (is_file($_p)) { require $_p; break; }
}

if (!isset($mysqli) || !($mysqli instanceof mysqli)) {
    cronLog('FATAL: No database connection.');
    if ($_logFp) fclose($_logFp);
    exit(1);
}
if (empty($TICKETMASTER_CONSUMER_KEY)) {
    cronLog('FATAL: TICKETMASTER_CONSUMER_KEY not set in config-app.php.');
    if ($_logFp) fclose($_logFp);
    exit(1);
}
$mysqli->set_charset('utf8mb4');
cronLog('Database connected. API key present.');

// ── Phase runner ────────────────────────────────────────────────────────────
// Includes a pipeline script inside a function scope so its local variables
// don't collide with the cron's own variables. The included script accesses
// $mysqli and $TICKETMASTER_CONSUMER_KEY via the global keyword.

function runPhase(string $scriptPath): string {
    try {
        ob_start();
        include $scriptPath;
        return ob_get_clean() ?: '';
    } catch (\Throwable $e) {
        $partial = ob_get_clean() ?: '';
        return $partial . "\nEXCEPTION: " . $e->getMessage() . "\n";
    }
}

// ── Budget ───────────────────────────────────────────────────────────────────

$DAILY_BUDGET    = 5000;
$RESERVE         = 1000;
$REFRESH_CEILING = 3000;
$COLLECT_CEILING = $DAILY_BUDGET - $RESERVE - $REFRESH_CEILING;
$globalApiCalls  = 0;

// ── Cleanup: purge expired staging rows ─────────────────────────────────────

$mysqli->query(
    "DELETE ts FROM tm_staging ts
     JOIN posts p ON p.id = ts.post_id
     WHERE ts.status IN ('imported','skipped')
     AND p.expires_at < DATE_SUB(NOW(), INTERVAL 6 MONTH)"
);
cronLog("CLEANUP: {$mysqli->affected_rows} expired staging rows purged");

// ── Genre rotation queue (82 genres, interleaved Music/Sports/Arts/Film) ────

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

$segItems = [];
foreach ($genreQueue as [$segment, $genre]) {
    foreach ($segmented as $cc) {
        $segItems[] = ['country' => $cc, 'segment' => $segment, 'genre' => $genre];
    }
}

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

// ── Read cursor ─────────────────────────────────────────────────────────────

$cursor = $mysqli->query("SELECT skip_reason FROM tm_staging WHERE tm_event_id = '_cursor' LIMIT 1");
if (!$cursor || $cursor->num_rows === 0) {
    cronLog('FATAL: Cursor marker row missing from tm_staging. Insert it first.');
    if ($_logFp) fclose($_logFp);
    exit(1);
}
$curData         = json_decode($cursor->fetch_assoc()['skip_reason'], true) ?: [];
$position        = (int) ($curData['position'] ?? 0);
$pass            = (int) ($curData['pass'] ?? 0);
$seedingComplete = (int) ($curData['seeded'] ?? 0);

$page = $seedingComplete ? 0 : $pass;

cronLog('COLLECT PHASE — pass ' . $pass . ', position ' . $position . '/' . $queueSize
    . ', ' . ($seedingComplete ? 'MAINTENANCE' : 'SEEDING'));

// ── Phase 1: Collection ─────────────────────────────────────────────────────

$_collectStart  = microtime(true);
$itemsProcessed = 0;
$rateLimited    = false;

while ($globalApiCalls < $COLLECT_CEILING) {
    if ($position >= $queueSize) {
        if ($seedingComplete) {
            $position = 0;
            cronLog('Maintenance cycle complete, wrapping to start.');
            break;
        }
        $pass++;
        $position = 0;
        if ($pass >= 5) {
            $seedingComplete = 1;
            $pass = 0;
            cronLog('SEEDING COMPLETE — switching to maintenance mode');
            break;
        }
        $page = $pass;
        cronLog("Pass {$pass} starting (page {$page})");
    }

    $item = $fullQueue[$position];
    $cc   = $item['country'];
    $label = $item['genre'] ? "{$cc}/{$item['genre']}" : "{$cc} (unsegmented)";

    $_GET = [
        'country'    => $cc,
        'limit'      => '200',
        'pages'      => '1',
        'start_page' => (string) $page,
    ];
    if ($item['segment'] !== null) $_GET['segment'] = $item['segment'];
    if ($item['genre'] !== null)   $_GET['genre']   = $item['genre'];

    $output = runPhase("{$dir}/tm-collect.php");

    if (preg_match('/\[API_CALLS:(\d+)\]/', $output, $m)) {
        $calls = (int) $m[1];
        $globalApiCalls += $calls;
    }

    if (preg_match('/New events staged:\s*(\d+)/', $output, $mNew)) {
        $newEvents = (int) $mNew[1];
        if ($newEvents > 0) cronLog("[{$position}] {$label} — +{$newEvents} new events");
    } else {
        cronLog("[{$position}] {$label} — 0 new");
    }

    if (strpos($output, 'EXCEPTION:') !== false) {
        cronLog("  ERROR in tm-collect.php:");
        cronLogBlock($output);
    }

    if (strpos($output, 'RATE LIMIT') !== false) {
        cronLog('Rate limited — stopping collection.');
        $rateLimited = true;
        break;
    }

    $position++;
    $itemsProcessed++;
}

$_collectTime = round(microtime(true) - $_collectStart, 1);
cronLog("Collection done: {$itemsProcessed} items, {$globalApiCalls} API calls, {$_collectTime}s");

// ── Save cursor ─────────────────────────────────────────────────────────────

$curJson = json_encode(['position' => $position, 'pass' => $pass, 'seeded' => $seedingComplete]);
$stmt = $mysqli->prepare("UPDATE tm_staging SET skip_reason = ? WHERE tm_event_id = '_cursor'");
$stmt->bind_param('s', $curJson);
$stmt->execute();
$stmt->close();
cronLog("Cursor saved: {$curJson}");

// ── Phase 2: Import ─────────────────────────────────────────────────────────

cronLog('IMPORT PHASE');
$_importStart = microtime(true);
$importRound  = 0;

$r = $mysqli->query("SELECT COUNT(*) c FROM tm_staging WHERE status = 'pending'");
$pending = (int) $r->fetch_assoc()['c'];

if ($pending === 0) {
    cronLog('No pending events to import, skipping.');
} else {
    while ($pending > 0 && $importRound < 10) {
        $importRound++;
        cronLog("Import round {$importRound} ({$pending} pending)");

        $_GET = ['limit' => '200'];
        $output = runPhase("{$dir}/tm-import.php");
        cronLogBlock($output);

        $r = $mysqli->query("SELECT COUNT(*) c FROM tm_staging WHERE status = 'pending'");
        $pending = (int) $r->fetch_assoc()['c'];
    }
}

$_importTime = round(microtime(true) - $_importStart, 1);
cronLog("Import done: {$importRound} round(s), {$_importTime}s");

// ── Phase 3: Clear event_json from processed rows ───────────────────────────

$mysqli->query(
    "UPDATE tm_staging SET event_json = '' WHERE status IN ('imported','skipped') AND event_json != ''"
);
cronLog("CLEAR JSON: {$mysqli->affected_rows} blobs cleared");

// ── Phase 4: Refresh existing posts ─────────────────────────────────────────

$refreshBudget = min($REFRESH_CEILING, $DAILY_BUDGET - $RESERVE - $globalApiCalls);
if ($refreshBudget < 100) {
    cronLog("REFRESH SKIPPED (only {$refreshBudget} calls remaining)");
} else {
    cronLog("REFRESH PHASE (max_api={$refreshBudget})");
    $_refreshStart = microtime(true);

    $_GET = ['limit' => '200', 'max_api' => (string) $refreshBudget];
    $output = runPhase("{$dir}/tm-refresh.php");
    cronLogBlock($output);

    $_refreshTime = round(microtime(true) - $_refreshStart, 1);
    cronLog("Refresh done: {$_refreshTime}s");
}

// ── Summary ─────────────────────────────────────────────────────────────────

$r = $mysqli->query("SELECT status, COUNT(*) c FROM tm_staging WHERE tm_event_id != '_cursor' GROUP BY status");
$statusCounts = [];
while ($row = $r->fetch_assoc()) $statusCounts[$row['status']] = $row['c'];
cronLog('Staging status: ' . json_encode($statusCounts));

cronLog(str_repeat('=', 72));
cronLog("TM DAILY CRON COMPLETE — Total API calls: {$globalApiCalls}");
cronLog(str_repeat('=', 72));

if ($_logFp) fclose($_logFp);
