<?php
// cron-ticketmaster-weekly.php — Refreshes existing TM-imported posts with latest data.
//
// cPanel cron (Sunday, midnight):
//   /usr/local/bin/php -q /home/funmapco/public_html/home/funmapco/connectors/cron-ticketmaster-weekly.php

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}

$php = PHP_BINARY;
$dir = __DIR__;

echo "=== TM REFRESH ===\n";
passthru(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-refresh.php") . ' ' . escapeshellarg('limit=200'));
