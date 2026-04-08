<?php
// cron-ticketmaster-daily.php — Collects new attractions, then imports them as posts.
//
// cPanel cron (daily, 3am):
//   /usr/local/bin/php -q /home/funmapco/public_html/home/funmapco/connectors/cron-ticketmaster-daily.php

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}

$php = PHP_BINARY;
$dir = __DIR__;

echo "=== TM COLLECT ===\n";
passthru(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-collect.php") . ' ' . escapeshellarg('country=GB&limit=500&pages=10'));

echo "\n=== TM IMPORT ===\n";
passthru(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-import.php") . ' ' . escapeshellarg('limit=200'));
