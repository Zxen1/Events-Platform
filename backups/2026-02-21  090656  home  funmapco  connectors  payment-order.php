<?php
if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden']);
    exit;
}

$configCandidates = [
    __DIR__ . '/../config/config-db.php',
    dirname(__DIR__) . '/config/config-db.php',
    dirname(__DIR__, 2) . '/config/config-db.php',
    dirname(__DIR__, 3) . '/../config/config-db.php',
    dirname(__DIR__) . '/../config/config-db.php',
    __DIR__ . '/config-db.php',
];
$configPath = null;
foreach ($configCandidates as $c) {
    if (is_file($c)) { $configPath = $c; break; }
}
if ($configPath === null) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database configuration missing']);
    exit;
}
require_once $configPath;

$paymentConfigCandidates = [
    __DIR__ . '/../config/config-payment.php',
    dirname(__DIR__) . '/config/config-payment.php',
    dirname(__DIR__, 2) . '/config/config-payment.php',
    dirname(__DIR__, 3) . '/../config/config-payment.php',
    dirname(__DIR__) . '/../config/config-payment.php',
    __DIR__ . '/config-payment.php',
];
$paymentConfigPath = null;
foreach ($paymentConfigCandidates as $c) {
    if (is_file($c)) { $paymentConfigPath = $c; break; }
}
if ($paymentConfigPath === null) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Payment configuration missing']);
    exit;
}
$paymentConfig = require $paymentConfigPath;

header('Content-Type: application/json; charset=utf-8');

if (!isset($mysqli) || !($mysqli instanceof mysqli)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Database unavailable']);
    exit;
}

$rawInput = file_get_contents('php://input');
$data = json_decode($rawInput, true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Invalid request']);
    exit;
}

$subAction = isset($data['sub_action']) ? trim((string)$data['sub_action']) : '';

// ============================================================
// GATEWAY ROUTER — add new gateways here in future
// ============================================================

function get_active_gateway(array $paymentConfig): string {
    if (!empty($paymentConfig['paypal_client_id']) && !empty($paymentConfig['paypal_secret'])) {
        return 'paypal';
    }
    return '';
}

function paypal_get_base_url(array $paymentConfig): string {
    $mode = isset($paymentConfig['paypal_mode']) ? strtolower(trim($paymentConfig['paypal_mode'])) : 'sandbox';
    return $mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function paypal_get_access_token(array $paymentConfig, string &$error): ?string {
    $baseUrl  = paypal_get_base_url($paymentConfig);
    $clientId = $paymentConfig['paypal_client_id'];
    $secret   = $paymentConfig['paypal_secret'];

    $ch = curl_init($baseUrl . '/v1/oauth2/token');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => 'grant_type=client_credentials',
        CURLOPT_USERPWD        => $clientId . ':' . $secret,
        CURLOPT_HTTPHEADER     => ['Accept: application/json', 'Accept-Language: en_US'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $resp     = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$resp) {
        $error = 'PayPal auth failed (HTTP ' . $httpCode . ')';
        return null;
    }
    $json = json_decode($resp, true);
    if (empty($json['access_token'])) {
        $error = 'PayPal auth token missing';
        return null;
    }
    return $json['access_token'];
}

function paypal_create_order(array $paymentConfig, string $accessToken, float $amount, string $currency, string $description, string &$error): ?string {
    $baseUrl = paypal_get_base_url($paymentConfig);
    $brandName      = isset($paymentConfig['paypal_brand_name'])      ? trim((string)$paymentConfig['paypal_brand_name'])      : '';
    $softDescriptor = isset($paymentConfig['paypal_soft_descriptor']) ? trim((string)$paymentConfig['paypal_soft_descriptor']) : '';

    $purchaseUnit = [
        'amount'      => [
            'currency_code' => strtoupper($currency),
            'value'         => number_format($amount, 2, '.', ''),
        ],
        'description' => $description,
    ];
    if ($softDescriptor !== '') {
        $purchaseUnit['soft_descriptor'] = substr($softDescriptor, 0, 22);
    }

    $orderBody = [
        'intent'         => 'CAPTURE',
        'purchase_units' => [$purchaseUnit],
    ];
    if ($brandName !== '') {
        $orderBody['application_context'] = ['brand_name' => $brandName];
    }

    $body = json_encode($orderBody);

    $ch = curl_init($baseUrl . '/v2/checkout/orders');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $resp     = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 201 || !$resp) {
        $error = 'PayPal create order failed (HTTP ' . $httpCode . ')';
        return null;
    }
    $json = json_decode($resp, true);
    if (empty($json['id'])) {
        $error = 'PayPal order ID missing';
        return null;
    }
    return $json['id'];
}

function paypal_capture_order(array $paymentConfig, string $accessToken, string $orderId, string &$error): ?array {
    $baseUrl = paypal_get_base_url($paymentConfig);
    $ch      = curl_init($baseUrl . '/v2/checkout/orders/' . $orderId . '/capture');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => '{}',
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $accessToken,
        ],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $resp     = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if (($httpCode !== 200 && $httpCode !== 201) || !$resp) {
        $error = 'PayPal capture failed (HTTP ' . $httpCode . ')';
        return null;
    }
    $json = json_decode($resp, true);
    if (empty($json['status']) || $json['status'] !== 'COMPLETED') {
        $error = 'PayPal capture not completed (status: ' . ($json['status'] ?? 'unknown') . ')';
        return null;
    }
    return $json;
}

function extract_payment_method(array $captureResponse): string {
    $src = $captureResponse['payment_source'] ?? [];
    if (!empty($src['card']['brand'])) return strtoupper($src['card']['brand']);
    if (!empty($src['paypal']))        return 'PAYPAL';
    if (!empty($src['apple_pay']))     return 'APPLE_PAY';
    if (!empty($src['google_pay']))    return 'GOOGLE_PAY';
    if (!empty($src['venmo']))         return 'VENMO';
    return 'UNKNOWN';
}

// ============================================================
// CREATE
// ============================================================
if ($subAction === 'create') {
    $amount          = round((float)($data['amount'] ?? 0), 2);
    $currency        = strtoupper(trim((string)($data['currency'] ?? 'USD')));
    $description     = trim((string)($data['description'] ?? 'Payment'));
    $memberId        = isset($data['member_id']) ? (int)$data['member_id'] : null;
    $postId          = isset($data['post_id']) && $data['post_id'] !== null ? (int)$data['post_id'] : null;
    $transactionType = trim((string)($data['transaction_type'] ?? 'new_post'));
    $checkoutKey     = isset($data['checkout_key']) ? trim((string)$data['checkout_key']) : null;
    $lineItems       = isset($data['line_items']) ? $data['line_items'] : null;
    $lineItemsJson   = $lineItems !== null ? json_encode($lineItems, JSON_UNESCAPED_UNICODE) : null;

    if ($amount <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid amount']);
        exit;
    }
    if (!$memberId) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'member_id required']);
        exit;
    }

    $gateway = get_active_gateway($paymentConfig);
    if ($gateway === '') {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No payment gateway configured']);
        exit;
    }

    $err = '';
    $accessToken = paypal_get_access_token($paymentConfig, $err);
    if ($accessToken === null) {
        http_response_code(502);
        echo json_encode(['success' => false, 'message' => $err]);
        exit;
    }

    $orderId = paypal_create_order($paymentConfig, $accessToken, $amount, $currency, $description, $err);
    if ($orderId === null) {
        http_response_code(502);
        echo json_encode(['success' => false, 'message' => $err]);
        exit;
    }

    // Insert pending transaction
    $stmt = $mysqli->prepare(
        "INSERT INTO transactions (member_id, post_id, transaction_type, checkout_key, payment_id, payment_gateway, amount, currency, line_items, description, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())"
    );
    if (!$stmt) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'DB prepare failed']);
        exit;
    }
    $stmt->bind_param('iissssdss', $memberId, $postId, $transactionType, $checkoutKey, $orderId, $gateway, $amount, $currency, $lineItemsJson, $description);
    if (!$stmt->execute()) {
        $stmt->close();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'DB insert failed']);
        exit;
    }
    $transactionId = (int)$stmt->insert_id;
    $stmt->close();

    echo json_encode([
        'success'        => true,
        'gateway'        => $gateway,
        'client_id'      => $paymentConfig['paypal_client_id'],
        'order_id'       => $orderId,
        'transaction_id' => $transactionId,
    ]);
    exit;
}

// ============================================================
// CAPTURE
// ============================================================
if ($subAction === 'capture') {
    $orderId       = trim((string)($data['order_id'] ?? ''));
    $transactionId = isset($data['transaction_id']) ? (int)$data['transaction_id'] : 0;
    $gateway       = trim((string)($data['gateway'] ?? ''));

    if ($orderId === '' || $transactionId <= 0 || $gateway === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing capture parameters']);
        exit;
    }

    // Verify transaction exists and is pending
    $stmtCheck = $mysqli->prepare("SELECT id, status FROM transactions WHERE id = ? AND payment_id = ? LIMIT 1");
    if (!$stmtCheck) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'DB prepare failed']);
        exit;
    }
    $stmtCheck->bind_param('is', $transactionId, $orderId);
    $stmtCheck->execute();
    $stmtCheck->bind_result($txId, $txStatus);
    $found = $stmtCheck->fetch();
    $stmtCheck->close();

    if (!$found) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Transaction not found']);
        exit;
    }
    if ($txStatus === 'paid') {
        // Already captured — idempotent success
        echo json_encode(['success' => true, 'transaction_id' => $transactionId]);
        exit;
    }

    if ($gateway === 'paypal') {
        $err = '';
        $accessToken = paypal_get_access_token($paymentConfig, $err);
        if ($accessToken === null) {
            http_response_code(502);
            echo json_encode(['success' => false, 'message' => $err]);
            exit;
        }

        $captureResponse = paypal_capture_order($paymentConfig, $accessToken, $orderId, $err);
        if ($captureResponse === null) {
            // Mark transaction as failed
            $stmtFail = $mysqli->prepare("UPDATE transactions SET status = 'failed', updated_at = NOW() WHERE id = ?");
            if ($stmtFail) { $stmtFail->bind_param('i', $transactionId); $stmtFail->execute(); $stmtFail->close(); }
            http_response_code(502);
            echo json_encode(['success' => false, 'message' => $err]);
            exit;
        }

        $paymentMethod = extract_payment_method($captureResponse);

        $stmtUpdate = $mysqli->prepare(
            "UPDATE transactions SET status = 'paid', payment_method = ?, updated_at = NOW() WHERE id = ?"
        );
        if (!$stmtUpdate) {
            http_response_code(500);
            echo json_encode(['success' => false, 'message' => 'DB update failed']);
            exit;
        }
        $stmtUpdate->bind_param('si', $paymentMethod, $transactionId);
        $stmtUpdate->execute();
        $stmtUpdate->close();

        echo json_encode(['success' => true, 'transaction_id' => $transactionId]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unknown gateway: ' . $gateway]);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'message' => 'Unknown sub_action']);
exit;
?>
