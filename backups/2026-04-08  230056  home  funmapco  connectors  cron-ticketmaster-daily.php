<?php
// cron-ticketmaster-daily.php — Collects new attractions, then imports them as posts.
//
// Collects from multiple countries sequentially, then imports all pending.
// API budget: ~5,000 calls/day. As attractions are collected, daily usage drops.
//
// cPanel cron (daily, 3am):
//   /usr/local/bin/php -q /home/funmapco/public_html/home/funmapco/connectors/cron-ticketmaster-daily.php

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit;
}

$php = PHP_BINARY;
$dir = __DIR__;

$countries = [
    'GB' => ['limit' => 200, 'pages' => 5],
    'US' => ['limit' => 200, 'pages' => 5],
    'IE' => ['limit' => 100, 'pages' => 3],
    'AU' => ['limit' => 100, 'pages' => 3],
    'CA' => ['limit' => 100, 'pages' => 3],
    'NZ' => ['limit' => 50,  'pages' => 2],
];

foreach ($countries as $code => $params) {
    echo "=== TM COLLECT — {$code} ===\n";
    $qs = "country={$code}&limit={$params['limit']}&pages={$params['pages']}";
    passthru(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-collect.php") . ' ' . escapeshellarg($qs));
    echo "\n";
}

echo "=== TM IMPORT ===\n";
passthru(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-import.php") . ' ' . escapeshellarg('limit=200'));
