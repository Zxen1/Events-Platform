<?php
/**
 * Test HTTP request timing from server-side
 * This will show if the issue is network or PHP execution
 */

header('Content-Type: text/plain; charset=utf-8');

echo "=== HTTP Request Timing Test ===\n\n";

// Test the actual endpoint that's slow
echo "Testing: /gateway.php?action=get-admin-settings&include_messages=true\n";
echo "This simulates what your browser does...\n\n";

$start = microtime(true);

// Use file_get_contents with context for better control
$context = stream_context_create([
    'http' => [
        'method' => 'GET',
        'timeout' => 60,
        'ignore_errors' => true,
        'header' => "Accept: application/json\r\n"
    ]
]);

$url = 'https://funmap.com/gateway.php?action=get-admin-settings&include_messages=true';
$response = @file_get_contents($url, false, $context);

$time = round((microtime(true) - $start) * 1000, 2);

echo "Total time: {$time}ms (" . round($time / 1000, 2) . " seconds)\n";

if ($response === false) {
    echo "ERROR: Request failed\n";
    $error = error_get_last();
    if ($error) {
        echo "Error: " . $error['message'] . "\n";
    }
} else {
    echo "Response received: " . strlen($response) . " bytes\n";
    $data = json_decode($response, true);
    if ($data && isset($data['success'])) {
        echo "✓ Valid JSON response (success: " . ($data['success'] ? 'true' : 'false') . ")\n";
    } else {
        echo "⚠ Invalid JSON or empty response\n";
        echo "First 200 chars: " . substr($response, 0, 200) . "\n";
    }
}

echo "\n";

// Test without messages (should be faster)
echo "Testing: /gateway.php?action=get-admin-settings (without messages)\n";
$start = microtime(true);
$url2 = 'https://funmap.com/gateway.php?action=get-admin-settings';
$response2 = @file_get_contents($url2, false, $context);
$time2 = round((microtime(true) - $start) * 1000, 2);
echo "Total time: {$time2}ms (" . round($time2 / 1000, 2) . " seconds)\n";
if ($response2 !== false) {
    echo "Response size: " . strlen($response2) . " bytes\n";
}
echo "\n";

echo "=== Analysis ===\n";
if ($time > 10000) {
    echo "⚠ WARNING: Request took more than 10 seconds!\n";
    echo "This indicates a network or server issue, not database.\n";
} elseif ($time > 1000) {
    echo "⚠ Request is slow (> 1 second) - likely network or output buffering\n";
} else {
    echo "✓ Request is fast - if browser shows 20 minutes, it's a browser/network issue\n";
}

