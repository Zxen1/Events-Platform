<?php
set_exception_handler(function($e) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage(), 'file' => basename($e->getFile()), 'line' => $e->getLine()]);
    exit;
});
ob_start();
register_shutdown_function(function() {
    $err = error_get_last();
    if (!$err) return;
    $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR];
    if (!in_array($err['type'], $fatalTypes, true)) return;
    while (ob_get_level() > 0) { @ob_end_clean(); }
    if (!headers_sent()) header('Content-Type: application/json; charset=utf-8');
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $err['message'], 'file' => basename($err['file']), 'line' => $err['line']]);
});

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
// HELPER FUNCTIONS — PAYPAL
// ============================================================

function paypal_get_base_url(array $paymentConfig): string {
    $mode = isset($paymentConfig['paypal_mode']) ? strtolower(trim($paymentConfig['paypal_mode'])) : 'sandbox';
    return $mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function paypal_get_access_token(array $paymentConfig, string &$error): ?string {
    $baseUrl  = paypal_get_base_url($paymentConfig);
    $clientId = $paymentConfig['paypal_client_id'] ?? '';
    $secret   = $paymentConfig['paypal_secret'] ?? '';

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
    $baseUrl        = paypal_get_base_url($paymentConfig);
    $brandName      = isset($paymentConfig['paypal_brand_name'])       ? trim((string)$paymentConfig['paypal_brand_name'])      : '';
    $softDescriptor = isset($paymentConfig['paypal_soft_descriptor'])  ? trim((string)$paymentConfig['paypal_soft_descriptor']) : '';

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

    $ch = curl_init($baseUrl . '/v2/checkout/orders');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($orderBody),
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

function extract_paypal_payment_method(array $captureResponse): string {
    $src = $captureResponse['payment_source'] ?? [];
    if (!empty($src['card']['brand'])) return strtoupper($src['card']['brand']);
    if (!empty($src['paypal']))        return 'PAYPAL';
    if (!empty($src['apple_pay']))     return 'APPLE_PAY';
    if (!empty($src['google_pay']))    return 'GOOGLE_PAY';
    if (!empty($src['venmo']))         return 'VENMO';
    return 'UNKNOWN';
}

// ============================================================
// HELPER FUNCTIONS — STRIPE
// ============================================================

function stripe_create_payment_intent(array $paymentConfig, float $amount, string $currency, string $description, string &$error): ?array {
    $secretKey = trim($paymentConfig['stripe_secret_key'] ?? '');
    if ($secretKey === '') { $error = 'Stripe not configured'; return null; }

    $params = http_build_query([
        'amount'                     => (int)round($amount * 100),
        'currency'                   => strtolower($currency),
        'description'                => $description,
        'automatic_payment_methods'  => ['enabled' => 'true', 'allow_redirects' => 'never'],
    ]);

    $ch = curl_init('https://api.stripe.com/v1/payment_intents');
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $params,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $secretKey],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $resp     = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$resp) { $error = 'Stripe create failed (HTTP ' . $httpCode . ')'; return null; }
    $json = json_decode($resp, true);
    if (!empty($json['error'])) { $error = $json['error']['message'] ?? 'Stripe error'; return null; }
    if (empty($json['id']) || empty($json['client_secret'])) { $error = 'Stripe response missing fields'; return null; }
    return ['id' => $json['id'], 'client_secret' => $json['client_secret']];
}

function stripe_retrieve_payment_intent(array $paymentConfig, string $intentId, string &$error): ?array {
    $secretKey = trim($paymentConfig['stripe_secret_key'] ?? '');
    $ch = curl_init('https://api.stripe.com/v1/payment_intents/' . urlencode($intentId));
    curl_setopt_array($ch, [
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $secretKey],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
    ]);
    $resp     = curl_exec($ch);
    $httpCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200 || !$resp) { $error = 'Stripe retrieve failed (HTTP ' . $httpCode . ')'; return null; }
    $json = json_decode($resp, true);
    if (!empty($json['error'])) { $error = $json['error']['message'] ?? 'Stripe error'; return null; }
    return $json;
}

function extract_stripe_payment_method(array $pi): string {
    $wallet = $pi['charges']['data'][0]['payment_method_details']['card']['wallet']['type'] ?? '';
    $brand  = $pi['charges']['data'][0]['payment_method_details']['card']['brand'] ?? '';
    $type   = $pi['charges']['data'][0]['payment_method_details']['type'] ?? ($pi['payment_method_types'][0] ?? '');

    $walletMap = [
        'apple_pay'  => 'APPLE_PAY',
        'google_pay' => 'GOOGLE_PAY',
        'link'       => 'LINK',
    ];
    if ($wallet !== '' && isset($walletMap[$wallet])) return $walletMap[$wallet];

    $brandMap = [
        'visa'       => 'VISA',
        'mastercard' => 'MASTERCARD',
        'amex'       => 'AMEX',
        'discover'   => 'DISCOVER',
        'diners'     => 'DINERS',
        'jcb'        => 'JCB',
        'unionpay'   => 'UNIONPAY',
    ];
    if ($brand !== '' && isset($brandMap[$brand])) return $brandMap[$brand];
    if ($brand !== '') return strtoupper($brand);

    $typeMap = [
        'card'              => 'CARD',
        'afterpay_clearpay' => 'AFTERPAY',
        'klarna'            => 'KLARNA',
        'affirm'            => 'AFFIRM',
    ];
    return $typeMap[$type] ?? (strtoupper($type) ?: 'UNKNOWN');
}

// ============================================================
// CONFIG — return publishable credentials only (no DB writes)
// ============================================================
if ($subAction === 'config') {
    echo json_encode([
        'success'                => true,
        'stripe_publishable_key' => trim($paymentConfig['stripe_publishable_key'] ?? ''),
        'paypal_client_id'       => trim($paymentConfig['paypal_client_id'] ?? ''),
    ]);
    exit;
}

// ============================================================
// CREATE — create a gateway order/intent + pending transaction
// ============================================================
if ($subAction === 'create') {
    $gateway         = trim((string)($data['gateway'] ?? 'paypal'));
    $amount          = round((float)($data['amount'] ?? 0), 2);
    $currency        = strtoupper(trim((string)($data['currency'] ?? 'USD')));
    $description     = trim((string)($data['description'] ?? 'Payment'));
    $memberId        = isset($data['member_id']) && $data['member_id'] !== null ? (int)$data['member_id'] : null;
    $postId          = isset($data['post_id'])   && $data['post_id']   !== null ? (int)$data['post_id']   : null;
    $transactionType = trim((string)($data['transaction_type'] ?? 'new_post'));
    $checkoutKey     = isset($data['checkout_key']) ? trim((string)$data['checkout_key']) : null;
    $lineItems       = $data['line_items'] ?? null;
    $lineItemsJson   = $lineItems !== null ? json_encode($lineItems, JSON_UNESCAPED_UNICODE) : null;

    if ($amount <= 0) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid amount']);
        exit;
    }

    // ---- Stripe ----
    if ($gateway === 'stripe') {
        $err      = '';
        $piResult = stripe_create_payment_intent($paymentConfig, $amount, $currency, $description, $err);
        if ($piResult === null) {
            http_response_code(502);
            echo json_encode(['success' => false, 'message' => $err]);
            exit;
        }

        // No DB row written here — inserted only on successful capture
        echo json_encode(['success' => true, 'gateway' => 'stripe', 'client_secret' => $piResult['client_secret'], 'payment_intent_id' => $piResult['id']]);
        exit;
    }

    // ---- PayPal ----
    if ($gateway === 'paypal') {
        $err         = '';
        $accessToken = paypal_get_access_token($paymentConfig, $err);
        if ($accessToken === null) { http_response_code(502); echo json_encode(['success' => false, 'message' => $err]); exit; }

        $orderId = paypal_create_order($paymentConfig, $accessToken, $amount, $currency, $description, $err);
        if ($orderId === null) { http_response_code(502); echo json_encode(['success' => false, 'message' => $err]); exit; }

        // No DB row written here — inserted only on successful capture
        echo json_encode([
            'success'   => true,
            'gateway'   => 'paypal',
            'client_id' => $paymentConfig['paypal_client_id'],
            'order_id'  => $orderId,
        ]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Unknown gateway: ' . $gateway]);
    exit;
}

// ============================================================
// CAPTURE — verify payment and mark transaction paid
// ============================================================
if ($subAction === 'capture') {
    $paymentId = trim((string)($data['order_id'] ?? ''));
    $gateway   = trim((string)($data['gateway'] ?? ''));

    if ($paymentId === '' || $gateway === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Missing capture parameters']);
        exit;
    }

    // ---- Stripe capture — inserts row only on success ----
    if ($gateway === 'stripe') {
        $amount          = round((float)($data['amount'] ?? 0), 2);
        $currency        = strtoupper(trim((string)($data['currency'] ?? 'USD')));
        $description     = trim((string)($data['description'] ?? 'Payment'));
        $memberId        = isset($data['member_id'])  && $data['member_id']  !== null ? (int)$data['member_id']  : null;
        $postId          = isset($data['post_id'])    && $data['post_id']    !== null ? (int)$data['post_id']    : null;
        $transactionType = trim((string)($data['transaction_type'] ?? 'new_post'));
        $checkoutKey     = isset($data['checkout_key']) ? trim((string)$data['checkout_key']) : null;
        $lineItems       = $data['line_items'] ?? null;
        $lineItemsJson   = $lineItems !== null ? json_encode($lineItems, JSON_UNESCAPED_UNICODE) : null;

        $err = '';
        $pi  = stripe_retrieve_payment_intent($paymentConfig, $paymentId, $err);
        if ($pi === null) { http_response_code(502); echo json_encode(['success' => false, 'message' => $err]); exit; }
        if (($pi['status'] ?? '') !== 'succeeded') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Payment not completed (status: ' . ($pi['status'] ?? 'unknown') . ')']);
            exit;
        }
        $paymentMethod = extract_stripe_payment_method($pi);

        $stmt = $mysqli->prepare(
            "INSERT INTO transactions (member_id, post_id, transaction_type, checkout_key, payment_id, payment_gateway, payment_method, amount, currency, line_items, description, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'stripe', ?, ?, ?, ?, ?, 'paid', NOW(), NOW())"
        );
        if (!$stmt) { http_response_code(500); echo json_encode(['success' => false, 'message' => 'DB insert failed']); exit; }
        $stmt->bind_param('iissssdsss', $memberId, $postId, $transactionType, $checkoutKey, $paymentId, $paymentMethod, $amount, $currency, $lineItemsJson, $description);
        if (!$stmt->execute()) { $stmt->close(); http_response_code(500); echo json_encode(['success' => false, 'message' => 'DB insert failed']); exit; }
        $newTransactionId = (int)$stmt->insert_id;
        $stmt->close();

        echo json_encode(['success' => true, 'transaction_id' => $newTransactionId]);
        exit;
    }

    // ---- PayPal capture — inserts row only on success ----
    if ($gateway === 'paypal') {
        $amount          = round((float)($data['amount'] ?? 0), 2);
        $currency        = strtoupper(trim((string)($data['currency'] ?? 'USD')));
        $description     = trim((string)($data['description'] ?? 'Payment'));
        $memberId        = isset($data['member_id'])  && $data['member_id']  !== null ? (int)$data['member_id']  : null;
        $postId          = isset($data['post_id'])    && $data['post_id']    !== null ? (int)$data['post_id']    : null;
        $transactionType = trim((string)($data['transaction_type'] ?? 'new_post'));
        $checkoutKey     = isset($data['checkout_key']) ? trim((string)$data['checkout_key']) : null;
        $lineItems       = $data['line_items'] ?? null;
        $lineItemsJson   = $lineItems !== null ? json_encode($lineItems, JSON_UNESCAPED_UNICODE) : null;

        $err         = '';
        $accessToken = paypal_get_access_token($paymentConfig, $err);
        if ($accessToken === null) { http_response_code(502); echo json_encode(['success' => false, 'message' => $err]); exit; }

        $captureResponse = paypal_capture_order($paymentConfig, $accessToken, $paymentId, $err);
        if ($captureResponse === null) {
            http_response_code(502);
            echo json_encode(['success' => false, 'message' => $err]);
            exit;
        }
        $paymentMethod = extract_paypal_payment_method($captureResponse);

        $stmt = $mysqli->prepare(
            "INSERT INTO transactions (member_id, post_id, transaction_type, checkout_key, payment_id, payment_gateway, payment_method, amount, currency, line_items, description, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, 'paypal', ?, ?, ?, ?, ?, 'paid', NOW(), NOW())"
        );
        if (!$stmt) { http_response_code(500); echo json_encode(['success' => false, 'message' => 'DB insert failed']); exit; }
        $stmt->bind_param('iissssdsss', $memberId, $postId, $transactionType, $checkoutKey, $paymentId, $paymentMethod, $amount, $currency, $lineItemsJson, $description);
        if (!$stmt->execute()) { $stmt->close(); http_response_code(500); echo json_encode(['success' => false, 'message' => 'DB insert failed']); exit; }
        $newTransactionId = (int)$stmt->insert_id;
        $stmt->close();

        echo json_encode(['success' => true, 'transaction_id' => $newTransactionId]);
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
