<?php
/**
 * tm-budget.php — Check remaining Ticketmaster API budget
 *
 * Makes one minimal API call and reads the rate limit headers.
 * Costs 1 API call.
 */

declare(strict_types=1);

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

foreach ($configDbCandidates  as $p) { if (is_file($p)) { require_once $p; break; } }
foreach ($configAppCandidates as $p) { if (is_file($p)) { require_once $p; break; } }

if (empty($TICKETMASTER_CONSUMER_KEY)) die('ERROR: TICKETMASTER_CONSUMER_KEY missing.');

$url = 'https://app.ticketmaster.com/discovery/v2/events.json?' . http_build_query([
    'apikey' => $TICKETMASTER_CONSUMER_KEY,
    'size'   => 1,
    'page'   => 0,
]);

$ch = curl_init($url);
$headers = [];
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_HEADERFUNCTION => function ($ch, $header) use (&$headers) {
        $len   = strlen($header);
        $parts = explode(':', $header, 2);
        if (count($parts) === 2) {
            $headers[strtolower(trim($parts[0]))] = trim($parts[1]);
        }
        return $len;
    },
]);
$resp     = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

header('Content-Type: text/html; charset=utf-8');
echo '<pre>';
echo "Ticketmaster API Budget Check (cost: 1 API call)\n";
echo str_repeat('─', 50) . "\n\n";

if ($httpCode === 429) {
    echo "STATUS: RATE LIMITED (429)\n\n";
} else {
    echo "STATUS: OK ({$httpCode})\n\n";
}

$limit     = $headers['rate-limit']           ?? 'unknown';
$available = $headers['rate-limit-available']  ?? 'unknown';
$reset     = $headers['rate-limit-reset']      ?? 'unknown';

echo "Rate-Limit:           {$limit}\n";
echo "Rate-Limit-Available: {$available}\n";
echo "Rate-Limit-Reset:     {$reset}\n";

if (is_numeric($reset)) {
    $resetSec  = (int) ((int) $reset / 1000);
    $resetTime = date('Y-m-d H:i:s', $resetSec);
    $secsLeft  = $resetSec - time();
    $hoursLeft = round($secsLeft / 3600, 1);
    $minsLeft  = round($secsLeft / 60);
    echo "\nReset at: {$resetTime} UTC ({$hoursLeft} hours / {$minsLeft} minutes from now)\n";
}

echo '</pre>';
