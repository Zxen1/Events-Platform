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

$authCandidates = [
    __DIR__ . '/../config/config-auth.php',
    dirname(__DIR__) . '/config/config-auth.php',
    dirname(__DIR__, 2) . '/config/config-auth.php',
    dirname(__DIR__, 3) . '/../config/config-auth.php',
    dirname(__DIR__) . '/../config/config-auth.php',
    __DIR__ . '/config-auth.php',
];
$authPath = null;
foreach ($authCandidates as $c) {
    if (is_file($c)) { $authPath = $c; break; }
}
if ($authPath) require_once $authPath;

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
// HELPER FUNCTIONS — EMAIL
// ============================================================

function format_email_amount(mysqli $mysqli, float $amount, string $currencyCode): string {
    $stmt = $mysqli->prepare(
        "SELECT option_symbol, option_symbol_position, option_decimal_separator,
                option_decimal_places, option_thousands_separator, option_filename
         FROM list_currencies WHERE option_value = ? AND is_active = 1 LIMIT 1"
    );
    if (!$stmt) return '';
    $stmt->bind_param('s', $currencyCode);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) return '';

    $decPlaces  = (int)$row['option_decimal_places'];
    $decSep     = $row['option_decimal_separator'] ?: '.';
    $thousSep   = $row['option_thousands_separator'] ?: ',';
    $symbol     = $row['option_symbol'] ?: $currencyCode;
    $position   = $row['option_symbol_position'] ?: 'left';
    $filename   = $row['option_filename'] ?: '';

    $formatted = number_format($amount, $decPlaces, $decSep, $thousSep);
    $number    = $position === 'right' ? $formatted . ' ' . $symbol : $symbol . $formatted;

    $flagHtml = '';
    if ($filename) {
        $sRes = $mysqli->query("SELECT setting_value FROM admin_settings WHERE setting_key = 'folder_currencies' LIMIT 1");
        if ($sRes) {
            $sRow = $sRes->fetch_assoc();
            $sRes->free();
            $cdnBase = rtrim($sRow['setting_value'] ?? '', '/');
            if ($cdnBase) {
                $flagHtml = '<img src="' . htmlspecialchars($cdnBase . '/' . $filename) . '" alt="" style="width:18px;height:12px;vertical-align:middle;margin-right:5px;">';
            }
        }
    }
    return $flagHtml . $number;
}

function send_payment_receipt_email(mysqli $mysqli, string $to_email, string $to_name, int $member_id, string $username, string $description, float $amount, string $currency, int $transaction_id): void {
    global $SMTP_HOST, $SMTP_USERNAME, $SMTP_PASSWORD;
    $msgKey = 'msg_email_donation_thanks';
    $logFailed = function($notes = null) use ($mysqli, $member_id, $username, $msgKey, $to_email) {
        $l = $mysqli->prepare('INSERT INTO `emails_sent` (member_id, username, message_key, to_email, status, notes) VALUES (?, ?, ?, ?, ?, ?)');
        if ($l) { $s = 'failed'; $l->bind_param('isssss', $member_id, $username, $msgKey, $to_email, $s, $notes); $l->execute(); $l->close(); }
    };
    $stmt = $mysqli->prepare(
        "SELECT message_name, message_text, supports_html FROM admin_messages
         WHERE message_key = 'msg_email_donation_thanks' AND container_key = 'msg_email' AND is_active = 1 LIMIT 1"
    );
    if (!$stmt) { $logFailed('DB prepare failed for template query'); return; }
    $stmt->execute();
    $template = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$template) { $logFailed('Email template not found or inactive'); return; }

    $sRes = $mysqli->query("SELECT setting_key, setting_value FROM admin_settings WHERE setting_key IN ('support_email','website_name','email_logo','folder_system_images')");
    $siteSettings = [];
    if ($sRes) { while ($r = $sRes->fetch_assoc()) $siteSettings[$r['setting_key']] = $r['setting_value']; $sRes->free(); }
    $fromEmail = $siteSettings['support_email'] ?? '';
    if (!$fromEmail) { $logFailed('support_email not configured in admin_settings'); return; }
    $fromName   = $siteSettings['website_name'] ?? '';
    $logoFolder = rtrim($siteSettings['folder_system_images'] ?? '', '/');
    $logoFile   = $siteSettings['email_logo'] ?? '';
    $logoUrl    = ($logoFolder && $logoFile) ? $logoFolder . '/' . rawurlencode($logoFile) : '';
    $logoHtml   = $logoUrl
        ? '<div style="background:#fff;padding:24px;text-align:center;border-bottom:1px solid #eee;"><img src="' . htmlspecialchars($logoUrl) . '" alt="' . htmlspecialchars($fromName) . '" style="max-height:60px;max-width:100%;"></div>'
        : '';

    $safeName    = htmlspecialchars((string)$to_name, ENT_QUOTES, 'UTF-8');
    $amountHtml  = format_email_amount($mysqli, $amount, $currency);
    $safeDesc    = htmlspecialchars($description, ENT_QUOTES, 'UTF-8');
    $subject     = str_replace('{name}', $safeName, $template['message_name']);
    $body        = str_replace(['{name}', '{logo}', '{description}', '{amount}', '{receipt_id}'],
                               [$safeName, $logoHtml, $safeDesc, $amountHtml, (string)$transaction_id],
                               $template['message_text']);

    if (empty($SMTP_HOST) || empty($SMTP_USERNAME) || empty($SMTP_PASSWORD)) { $logFailed('SMTP credentials missing'); return; }
    $docRoot = rtrim($_SERVER['DOCUMENT_ROOT'], '/\\');
    if (!file_exists($docRoot . '/libs/phpmailer/PHPMailer.php')) { $logFailed('PHPMailer not found'); return; }
    require_once $docRoot . '/libs/phpmailer/Exception.php';
    require_once $docRoot . '/libs/phpmailer/PHPMailer.php';
    require_once $docRoot . '/libs/phpmailer/SMTP.php';
    $mail   = new \PHPMailer\PHPMailer\PHPMailer(true);
    $status = 'failed';
    $errorNote = null;
    try {
        $mail->isSMTP();
        $mail->Host       = $SMTP_HOST;
        $mail->SMTPAuth   = true;
        $mail->Username   = $SMTP_USERNAME;
        $mail->Password   = $SMTP_PASSWORD;
        $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
        $mail->Port       = 465;
        $mail->CharSet    = 'UTF-8';
        $mail->setFrom($fromEmail, $fromName);
        $mail->addAddress($to_email, $to_name);
        $mail->Subject = $subject;
        if ($template['supports_html']) {
            $mail->isHTML(true);
            $mail->Body    = $body;
            $mail->AltBody = strip_tags($body);
        } else {
            $mail->isHTML(false);
            $mail->Body = strip_tags($body);
        }
        $mail->send();
        $status = 'sent';
    } catch (\PHPMailer\PHPMailer\Exception $e) {
        $status    = 'failed';
        $errorNote = $e->getMessage();
    }
    $log = $mysqli->prepare('INSERT INTO `emails_sent` (member_id, username, message_key, to_email, status, notes) VALUES (?, ?, ?, ?, ?, ?)');
    if ($log) {
        $logNotes = $status === 'failed' ? $errorNote : null;
        $log->bind_param('isssss', $member_id, $username, $msgKey, $to_email, $status, $logNotes);
        $log->execute();
        $log->close();
    }
}

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
    $ch = curl_init('https://api.stripe.com/v1/payment_intents/' . urlencode($intentId) . '?expand[]=latest_charge');
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
    $charge = $pi['latest_charge'] ?? ($pi['charges']['data'][0] ?? []);
    $wallet = $charge['payment_method_details']['card']['wallet']['type'] ?? '';
    $brand  = $charge['payment_method_details']['card']['brand'] ?? '';
    $type   = $charge['payment_method_details']['type'] ?? ($pi['payment_method_types'][0] ?? '');

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
        $memberRole      = trim((string)($data['member_role'] ?? 'member'));
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
            "INSERT INTO transactions (member_id, post_id, transaction_type, member_role, checkout_key, payment_id, payment_gateway, payment_method, amount, currency, line_items, description, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'stripe', ?, ?, ?, ?, ?, 'paid', NOW(), NOW())"
        );
        if (!$stmt) { http_response_code(500); echo json_encode(['success' => false, 'message' => 'DB insert failed']); exit; }
        $stmt->bind_param('iiisssdsss', $memberId, $postId, $transactionType, $memberRole, $checkoutKey, $paymentId, $paymentMethod, $amount, $currency, $lineItemsJson, $description);
        if (!$stmt->execute()) { $stmt->close(); http_response_code(500); echo json_encode(['success' => false, 'message' => 'DB insert failed']); exit; }
        $newTransactionId = (int)$stmt->insert_id;
        $stmt->close();

        if ($transactionType === 'donation' && $memberId !== null) {
            $mTable = $memberRole === 'admin' ? 'admins' : 'members';
            $mStmt = $mysqli->prepare("SELECT account_email, username FROM `{$mTable}` WHERE id = ? LIMIT 1");
            if ($mStmt) {
                $mStmt->bind_param('i', $memberId);
                $mStmt->execute();
                $mRow = $mStmt->get_result()->fetch_assoc();
                $mStmt->close();
                if ($mRow) {
                    send_payment_receipt_email($mysqli, $mRow['account_email'], $mRow['username'], $memberId, $mRow['username'], $description, $amount, $currency, $newTransactionId);
                }
            }
        }

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
        $memberRole      = trim((string)($data['member_role'] ?? 'member'));
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
            "INSERT INTO transactions (member_id, post_id, transaction_type, member_role, checkout_key, payment_id, payment_gateway, payment_method, amount, currency, line_items, description, status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 'paypal', ?, ?, ?, ?, ?, 'paid', NOW(), NOW())"
        );
        if (!$stmt) { http_response_code(500); echo json_encode(['success' => false, 'message' => 'DB insert failed']); exit; }
        $stmt->bind_param('iiisssdsss', $memberId, $postId, $transactionType, $memberRole, $checkoutKey, $paymentId, $paymentMethod, $amount, $currency, $lineItemsJson, $description);
        if (!$stmt->execute()) { $stmt->close(); http_response_code(500); echo json_encode(['success' => false, 'message' => 'DB insert failed']); exit; }
        $newTransactionId = (int)$stmt->insert_id;
        $stmt->close();

        if ($transactionType === 'donation' && $memberId !== null) {
            $mTable = $memberRole === 'admin' ? 'admins' : 'members';
            $mStmt = $mysqli->prepare("SELECT account_email, username FROM `{$mTable}` WHERE id = ? LIMIT 1");
            if ($mStmt) {
                $mStmt->bind_param('i', $memberId);
                $mStmt->execute();
                $mRow = $mStmt->get_result()->fetch_assoc();
                $mStmt->close();
                if ($mRow) {
                    send_payment_receipt_email($mysqli, $mRow['account_email'], $mRow['username'], $memberId, $mRow['username'], $description, $amount, $currency, $newTransactionId);
                }
            }
        }

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
