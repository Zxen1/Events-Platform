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

foreach ($countries as $code => $params) {
    echo "=== TM COLLECT — {$code} ===\n";
    $qs = "country={$code}&limit={$params['limit']}&pages={$params['pages']}";
    passthru(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-collect.php") . ' ' . escapeshellarg($qs));
    echo "\n";
}

echo "=== TM IMPORT ===\n";
passthru(escapeshellarg($php) . ' -q ' . escapeshellarg("{$dir}/tm-import.php") . ' ' . escapeshellarg('limit=200'));
