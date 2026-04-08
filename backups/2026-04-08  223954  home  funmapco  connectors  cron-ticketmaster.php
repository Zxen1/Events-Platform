<?php
// cron-ticketmaster.php — Ticketmaster scheduled job.
//
// Daily: Collects new attractions and imports them as posts.
// Weekly (Sundays): Refreshes existing posts with latest TM data.
//
// cPanel cron (daily, 3am):
//   /usr/local/bin/php -q /home/funmapco/public_html/home/funmapco/connectors/cron-ticketmaster.php

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}

$php = PHP_BINARY;
$dir = __DIR__;

function cronRun(string $php, string $script, array $params): void {
    $url = http_build_query($params);
    $cmd = escapeshellarg($php) . ' -q ' . escapeshellarg($script) . ' ' . escapeshellarg($url);
    echo "=== Running: " . basename($script) . " ===\n";
    passthru($cmd);
    echo "\n";
}

// ── Daily: Collect new attractions ──────────────────────────────────────────

cronRun($php, "{$dir}/tm-collect.php", ['country' => 'GB', 'limit' => '500', 'pages' => '10']);

// ── Daily: Import pending attractions ───────────────────────────────────────

cronRun($php, "{$dir}/tm-import.php", ['limit' => '200']);

// ── Weekly (Sunday): Refresh existing posts ─────────────────────────────────

if ((int) date('w') === 0) {
    cronRun($php, "{$dir}/tm-refresh.php", ['limit' => '200']);
}
