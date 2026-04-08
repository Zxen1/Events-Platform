<?php
// cron-ticketmaster-daily.php — Full daily TM pipeline: collect → import → refresh.
//
// Phase 1: Collect new attractions across all countries, split by segment.
//           Each segment (Music, Sports, Arts & Theatre, Film) gets its own
//           full page window per country, bypassing the API's 5-page pagination cap.
// Phase 2: Import all pending staging rows into posts (loops until empty).
// Phase 3: Refresh existing active posts (least-recently updated first).
// API budget: ~5,000 calls/day split between collect (~3,000) and refresh (~2,000).
//
// cPanel cron (daily, 3am):
//   /usr/local/bin/php -q /home/funmapco/public_html/home/funmapco/connectors/cron-ticketmaster-daily.php

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}

$php = PHP_BINARY;
$dir = __DIR__;

// ── Cleanup: purge expired staging rows ──────────────────────────────────────

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

// ── Segments — each gets its own full page window per country ─────────────────
// Miscellaneous is excluded (venue admissions, not events).

$segments = ['Music', 'Sports', 'Arts & Theatre', 'Film'];

// Limits are per-segment (total attraction limit for the country ÷ 4 segments).
// Pages = max useful depth per segment (API caps at page 5).
//
// Budget breakdown (discovery calls only):
//   Large:  4 seg × 5 pages × 2 countries =  40
//   Medium: 4 seg × 3 pages × 8 countries =  96
//   Small:  4 seg × 2 pages × 18 countries = 144
//   Tiny:   4 seg × 1 page  × 30 countries = 120
//   Total discovery: ~400 calls + attraction detail fetches (~2,600 budget)

$countries = [
    // Large — 50 attractions/segment, 5 pages/segment
    'GB' => ['limit' => 50, 'pages' => 5],
    'US' => ['limit' => 50, 'pages' => 5],

    // Medium — 25 attractions/segment, 3 pages/segment
    'CA' => ['limit' => 25, 'pages' => 3],
    'AU' => ['limit' => 25, 'pages' => 3],
    'DE' => ['limit' => 25, 'pages' => 3],
    'FR' => ['limit' => 25, 'pages' => 3],
    'ES' => ['limit' => 25, 'pages' => 3],
    'IT' => ['limit' => 25, 'pages' => 3],
    'MX' => ['limit' => 25, 'pages' => 3],
    'NL' => ['limit' => 25, 'pages' => 3],

    // Small — 12 attractions/segment, 2 pages/segment
    'IE' => ['limit' => 12, 'pages' => 2],
    'NZ' => ['limit' => 12, 'pages' => 2],
    'SE' => ['limit' => 12, 'pages' => 2],
    'DK' => ['limit' => 12, 'pages' => 2],
    'NO' => ['limit' => 12, 'pages' => 2],
    'FI' => ['limit' => 12, 'pages' => 2],
    'PL' => ['limit' => 12, 'pages' => 2],
    'AT' => ['limit' => 12, 'pages' => 2],
    'CH' => ['limit' => 12, 'pages' => 2],
    'CZ' => ['limit' => 12, 'pages' => 2],
    'TR' => ['limit' => 12, 'pages' => 2],
    'BE' => ['limit' => 12, 'pages' => 2],
    'BR' => ['limit' => 12, 'pages' => 2],
    'ZA' => ['limit' => 12, 'pages' => 2],
    'AE' => ['limit' => 12, 'pages' => 2],
    'JP' => ['limit' => 12, 'pages' => 2],
    'KR' => ['limit' => 12, 'pages' => 2],
    'IN' => ['limit' => 12, 'pages' => 2],

    // Tiny — 5 attractions/segment, 1 page/segment
    'HK' => ['limit' => 5, 'pages' => 1],
    'MY' => ['limit' => 5, 'pages' => 1],
    'IL' => ['limit' => 5, 'pages' => 1],
    'AR' => ['limit' => 5, 'pages' => 1],
    'CL' => ['limit' => 5, 'pages' => 1],
    'PE' => ['limit' => 5, 'pages' => 1],
    'GR' => ['limit' => 5, 'pages' => 1],
    'HU' => ['limit' => 5, 'pages' => 1],
    'BG' => ['limit' => 5, 'pages' => 1],
    'IS' => ['limit' => 5, 'pages' => 1],
    'EE' => ['limit' => 5, 'pages' => 1],
    'LV' => ['limit' => 5, 'pages' => 1],
    'LT' => ['limit' => 5, 'pages' => 1],
    'LU' => ['limit' => 5, 'pages' => 1],
    'MT' => ['limit' => 5, 'pages' => 1],
    'AD' => ['limit' => 5, 'pages' => 1],
    'GI' => ['limit' => 5, 'pages' => 1],
    'FO' => ['limit' => 5, 'pages' => 1],
    'BH' => ['limit' => 5, 'pages' => 1],
    'GE' => ['limit' => 5, 'pages' => 1],
    'AZ' => ['limit' => 5, 'pages' => 1],
    'GH' => ['limit' => 5, 'pages' => 1],
    'DO' => ['limit' => 5, 'pages' => 1],
    'EC' => ['limit' => 5, 'pages' => 1],
    'JM' => ['limit' => 5, 'pages' => 1],
    'BB' => ['limit' => 5, 'pages' => 1],
    'BM' => ['limit' => 5, 'pages' => 1],
    'BS' => ['limit' => 5, 'pages' => 1],
    'AI' => ['limit' => 5, 'pages' => 1],
    'LB' => ['limit' => 5, 'pages' => 1],
];

foreach ($countries as $code => $params) {
    foreach ($segments as $seg) {
        $segLabel = urlencode($seg);
        echo "=== TM COLLECT — {$code} / {$seg} (pages 0-" . ($params['pages'] - 1) . ") ===\n";
        $qs = "country={$code}&limit={$params['limit']}&pages={$params['pages']}&start_page=0&segment={$segLabel}";
        passthru(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-collect.php") . ' ' . escapeshellarg($qs));
        echo "\n";
    }
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

// ── Phase 3: Clear event_json from processed rows (no longer needed) ─────────

$clearCmd = escapeshellarg($php) . ' -r ' . escapeshellarg(
    'require "' . addslashes("{$dir}/../config/config-db.php") . '";'
    . '$r = $mysqli->query("UPDATE tm_staging SET event_json = \'\' '
    . 'WHERE status IN (\'imported\',\'skipped\') AND event_json != \'\'");'
    . 'echo $mysqli->affected_rows . \" event_json blobs cleared\";'
);
echo "\n=== CLEAR JSON ===\n";
echo trim(shell_exec($clearCmd)) . "\n\n";

// ── Phase 4: Refresh existing posts (least-recently updated first) ───────────

echo "=== TM REFRESH ===\n";
passthru(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-refresh.php") . ' ' . escapeshellarg('limit=200&max_api=3000'));
