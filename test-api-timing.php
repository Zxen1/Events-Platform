<?php
/**
 * Test actual API endpoint timing from the server's perspective
 * This simulates what happens when the browser calls the API
 */

header('Content-Type: text/plain; charset=utf-8');

echo "=== API Endpoint Timing Test ===\n\n";

// Test 1: get-admin-settings (without messages)
echo "1. Testing: /gateway.php?action=get-admin-settings\n";
$start = microtime(true);
$ch = curl_init('https://funmap.com/gateway.php?action=get-admin-settings');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 60);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$totalTime = curl_getinfo($ch, CURLINFO_TOTAL_TIME);
$connectTime = curl_getinfo($ch, CURLINFO_CONNECT_TIME);
$sizeDownload = curl_getinfo($ch, CURLINFO_SIZE_DOWNLOAD);
$error = curl_error($ch);
curl_close($ch);

$time = round((microtime(true) - $start) * 1000, 2);
echo "   Total time: {$time}ms\n";
echo "   HTTP Code: $httpCode\n";
echo "   cURL total time: " . round($totalTime * 1000, 2) . "ms\n";
echo "   Connection time: " . round($connectTime * 1000, 2) . "ms\n";
echo "   Response size: " . number_format($sizeDownload) . " bytes\n";
if ($error) {
    echo "   ERROR: $error\n";
} else {
    $data = json_decode($response, true);
    if ($data && isset($data['success'])) {
        echo "   ✓ Response valid (success: " . ($data['success'] ? 'true' : 'false') . ")\n";
    } else {
        echo "   ⚠ Response invalid or empty\n";
    }
}
echo "\n";

// Test 2: get-admin-settings (WITH messages - the slow one)
echo "2. Testing: /gateway.php?action=get-admin-settings&include_messages=true\n";
$start = microtime(true);
$ch = curl_init('https://funmap.com/gateway.php?action=get-admin-settings&include_messages=true');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 60);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$totalTime = curl_getinfo($ch, CURLINFO_TOTAL_TIME);
$connectTime = curl_getinfo($ch, CURLINFO_CONNECT_TIME);
$sizeDownload = curl_getinfo($ch, CURLINFO_SIZE_DOWNLOAD);
$error = curl_error($ch);
curl_close($ch);

$time = round((microtime(true) - $start) * 1000, 2);
echo "   Total time: {$time}ms\n";
echo "   HTTP Code: $httpCode\n";
echo "   cURL total time: " . round($totalTime * 1000, 2) . "ms\n";
echo "   Connection time: " . round($connectTime * 1000, 2) . "ms\n";
echo "   Response size: " . number_format($sizeDownload) . " bytes\n";
if ($error) {
    echo "   ERROR: $error\n";
} else {
    $data = json_decode($response, true);
    if ($data && isset($data['success'])) {
        echo "   ✓ Response valid (success: " . ($data['success'] ? 'true' : 'false') . ")\n";
        if (isset($data['messages'])) {
            echo "   Messages loaded: " . (is_array($data['messages']) ? count($data['messages']) : 0) . " containers\n";
        }
    } else {
        echo "   ⚠ Response invalid or empty\n";
    }
}
echo "\n";

// Test 3: get-form (the large one)
echo "3. Testing: /gateway.php?action=get-form\n";
echo "   (This may take a moment due to large response size...)\n";
$start = microtime(true);
$ch = curl_init('https://funmap.com/gateway.php?action=get-form');
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 120); // 2 minutes for large response
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$totalTime = curl_getinfo($ch, CURLINFO_TOTAL_TIME);
$connectTime = curl_getinfo($ch, CURLINFO_CONNECT_TIME);
$sizeDownload = curl_getinfo($ch, CURLINFO_SIZE_DOWNLOAD);
$error = curl_error($ch);
curl_close($ch);

$time = round((microtime(true) - $start) * 1000, 2);
echo "   Total time: " . round($time / 1000, 2) . " seconds\n";
echo "   HTTP Code: $httpCode\n";
echo "   cURL total time: " . round($totalTime, 2) . " seconds\n";
echo "   Connection time: " . round($connectTime * 1000, 2) . "ms\n";
echo "   Response size: " . number_format($sizeDownload) . " bytes (" . round($sizeDownload / 1024, 2) . " KB)\n";
if ($error) {
    echo "   ERROR: $error\n";
} else {
    $data = json_decode($response, true);
    if ($data && isset($data['success'])) {
        echo "   ✓ Response valid (success: " . ($data['success'] ? 'true' : 'false') . ")\n";
    } else {
        echo "   ⚠ Response invalid or empty\n";
    }
}
echo "\n";

echo "=== Analysis ===\n";
echo "If connection time is high (> 1000ms), there's a network issue.\n";
echo "If total time is high but connection is fast, the PHP script is slow.\n";
echo "If response size is very large, that could cause slow transfer.\n";

