<?php
// cron-ticketmaster-daily.php — Full daily TM pipeline: collect → import → refresh.
//
// Phase 1: Collect new attractions across all countries (rotating pages).
// Phase 2: Import all pending staging rows into posts (loops until empty).
// Phase 3: Refresh existing active posts (least-recently updated first).
// API budget: ~5,000 calls/day split between collect (~2,000) and refresh (~2,000).
//
// cPanel cron (daily, 3am):
//   /usr/local/bin/php -q /home/funmapco/public_html/home/funmapco/connectors/cron-ticketmaster-daily.php

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}

$php = PHP_BINARY;
$dir = __DIR__;

// ── Cleanup: purge staging rows for expired posts (older than 6 months past expiry) ──

$cleanupCmd = escapeshellarg($php) . ' -r ' . escapeshellarg(
    'require "' . addslashes("{$dir}/../config/config-db.php") . '";'
    . '$r = $mysqli->query("DELETE ts FROM tm_staging ts '
    . 'JOIN posts p ON p.id = ts.post_id '
    . 'WHERE ts.status IN (\'imported\',\'skipped\') '
    . 'AND p.expires_at < DATE_SUB(NOW(), INTERVAL 6 MONTH)");'
    . 'echo $mysqli->affected_rows . \" expired staging rows purged\";'
);
echo "=== CLEANUP ===\n";
echo trim(shell_exec($cleanupCmd)) . "\n\n";

$countries = [
    // Large (~210 calls each)
    'GB' => ['limit' => 200, 'pages' => 5],
    'US' => ['limit' => 200, 'pages' => 5],

    // Medium (~103 calls each)
    'CA' => ['limit' => 100, 'pages' => 3],
    'AU' => ['limit' => 100, 'pages' => 3],
    'DE' => ['limit' => 100, 'pages' => 3],
    'FR' => ['limit' => 100, 'pages' => 3],
    'ES' => ['limit' => 100, 'pages' => 3],
    'IT' => ['limit' => 100, 'pages' => 3],
    'MX' => ['limit' => 100, 'pages' => 3],
    'NL' => ['limit' => 100, 'pages' => 3],

    // Small (~52 calls each)
    'IE' => ['limit' => 50, 'pages' => 2],
    'NZ' => ['limit' => 50, 'pages' => 2],
    'SE' => ['limit' => 50, 'pages' => 2],
    'DK' => ['limit' => 50, 'pages' => 2],
    'NO' => ['limit' => 50, 'pages' => 2],
    'FI' => ['limit' => 50, 'pages' => 2],
    'PL' => ['limit' => 50, 'pages' => 2],
    'AT' => ['limit' => 50, 'pages' => 2],
    'CH' => ['limit' => 50, 'pages' => 2],
    'CZ' => ['limit' => 50, 'pages' => 2],
    'TR' => ['limit' => 50, 'pages' => 2],
    'BE' => ['limit' => 50, 'pages' => 2],
    'BR' => ['limit' => 50, 'pages' => 2],
    'ZA' => ['limit' => 50, 'pages' => 2],
    'AE' => ['limit' => 50, 'pages' => 2],
    'JP' => ['limit' => 50, 'pages' => 2],
    'KR' => ['limit' => 50, 'pages' => 2],
    'IN' => ['limit' => 50, 'pages' => 2],

    // Tiny (~21 calls each)
    'HK' => ['limit' => 20, 'pages' => 1],
    'MY' => ['limit' => 20, 'pages' => 1],
    'IL' => ['limit' => 20, 'pages' => 1],
    'AR' => ['limit' => 20, 'pages' => 1],
    'CL' => ['limit' => 20, 'pages' => 1],
    'PE' => ['limit' => 20, 'pages' => 1],
    'GR' => ['limit' => 20, 'pages' => 1],
    'HU' => ['limit' => 20, 'pages' => 1],
    'BG' => ['limit' => 20, 'pages' => 1],
    'IS' => ['limit' => 20, 'pages' => 1],
    'EE' => ['limit' => 20, 'pages' => 1],
    'LV' => ['limit' => 20, 'pages' => 1],
    'LT' => ['limit' => 20, 'pages' => 1],
    'LU' => ['limit' => 20, 'pages' => 1],
    'MT' => ['limit' => 20, 'pages' => 1],
    'AD' => ['limit' => 20, 'pages' => 1],
    'GI' => ['limit' => 20, 'pages' => 1],
    'FO' => ['limit' => 20, 'pages' => 1],
    'BH' => ['limit' => 20, 'pages' => 1],
    'GE' => ['limit' => 20, 'pages' => 1],
    'AZ' => ['limit' => 20, 'pages' => 1],
    'GH' => ['limit' => 20, 'pages' => 1],
    'DO' => ['limit' => 20, 'pages' => 1],
    'EC' => ['limit' => 20, 'pages' => 1],
    'JM' => ['limit' => 20, 'pages' => 1],
    'BB' => ['limit' => 20, 'pages' => 1],
    'BM' => ['limit' => 20, 'pages' => 1],
    'BS' => ['limit' => 20, 'pages' => 1],
    'AI' => ['limit' => 20, 'pages' => 1],
    'LB' => ['limit' => 20, 'pages' => 1],
];

$dayIndex = (int) date('z'); // 0-365

foreach ($countries as $code => $params) {
    $pages = $params['pages'];

    // Always scan page 0, plus rotate through deeper pages.
    // Rotation pages advance daily based on day-of-year.
    $rotatePages = max(1, $pages - 1);
    $startPage   = ($dayIndex * $rotatePages) + 1;

    echo "=== TM COLLECT — {$code} (page 0 + {$rotatePages} from page {$startPage}) ===\n";

    // Page 0 scan
    $qs0 = "country={$code}&limit={$params['limit']}&pages=1&start_page=0";
    passthru(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-collect.php") . ' ' . escapeshellarg($qs0));

    // Rotating deep scan
    $qsR = "country={$code}&limit={$params['limit']}&pages={$rotatePages}&start_page={$startPage}";
    passthru(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-collect.php") . ' ' . escapeshellarg($qsR));

    echo "\n";
}

// ── Phase 2: Import all pending (loop until none remain) ─────────────────────

echo "=== TM IMPORT ===\n";
$importRound = 0;
while (true) {
    $importRound++;
    echo "--- Import round {$importRound} ---\n";
    passthru(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-import.php") . ' ' . escapeshellarg('limit=200'));

    $checkCmd = escapeshellarg($php) . ' -r ' . escapeshellarg(
        'require "' . addslashes("{$dir}/../config/config-db.php") . '";'
        . '$r = $mysqli->query("SELECT COUNT(*) c FROM tm_staging WHERE status=\'pending\'");'
        . 'echo $r->fetch_assoc()["c"];'
    );
    $pending = (int) trim(shell_exec($checkCmd));
    if ($pending === 0 || $importRound >= 10) break;
    echo "{$pending} still pending, importing more...\n\n";
}

// ── Phase 3: Refresh existing posts (least-recently updated first) ───────────

echo "\n=== TM REFRESH ===\n";
passthru(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-refresh.php") . ' ' . escapeshellarg('limit=200&max_api=2000'));
