<?php
if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden']);
    exit;
}
header('Content-Type: application/json');

$configCandidates = [
    __DIR__ . '/../config/config-db.php',
    dirname(__DIR__) . '/config/config-db.php',
    dirname(__DIR__, 2) . '/config/config-db.php',
    dirname(__DIR__, 3) . '/../config/config-db.php',
    dirname(__DIR__) . '/../config/config-db.php',
    __DIR__ . '/config-db.php',
];

$configPath = null;
foreach ($configCandidates as $candidate) {
    if (is_file($candidate)) {
        $configPath = $candidate;
        break;
    }
}

if ($configPath === null) {
    echo json_encode(['success' => false, 'message' => 'Database configuration file is missing.']);
    exit;
}

require_once $configPath;

$authCandidates = [
    __DIR__ . '/../config/config-auth.php',
    dirname(__DIR__) . '/config/config-auth.php',
    dirname(__DIR__, 2) . '/config/config-auth.php',
    dirname(__DIR__, 3) . '/../config/config-auth.php',
    dirname(__DIR__) . '/../config/config-auth.php',
];
foreach ($authCandidates as $candidate) {
    if (is_file($candidate)) { require_once $candidate; break; }
}

function verify_json_fail($key) {
    echo json_encode(['success' => false, 'error_key' => $key, 'message' => $key], JSON_UNESCAPED_SLASHES);
    exit;
}

try {
    $raw = file_get_contents('php://input');
    $input = json_decode($raw, true);
    if (!is_array($input)) $input = [];

    $type = isset($input['type']) ? (string)$input['type'] : '';

    // -------------------------------------------------------------------------
    // LOGIN
    // -------------------------------------------------------------------------
    if ($type === 'login') {
        $username = isset($input['username']) ? trim((string)$input['username']) : '';
        $password = isset($input['password']) ? (string)$input['password'] : '';

        if ($username === '' || $password === '') {
            verify_json_fail('Missing credentials');
        }

        $cols = 'id, account_email, username, username_key, avatar_file, password_hash, map_lighting, map_style, favorites, recent, country, preferred_currency, filters_json, filters_hash, filters_version, filters_updated_at, deleted_at, email_notifications';

        $attempt = function(mysqli $db, string $table, string $user, string $pass, string $colList) {
            $sql = "SELECT {$colList} FROM {$table} WHERE account_email = ? OR username = ? LIMIT 1";
            $stmt = $db->prepare($sql);
            if (!$stmt) return null;
            $stmt->bind_param('ss', $user, $user);
            if (!$stmt->execute()) { $stmt->close(); return null; }
            $res = $stmt->get_result();
            $row = $res ? $res->fetch_assoc() : null;
            $stmt->close();
            if (!$row) return null;
            if (!isset($row['password_hash']) || !password_verify($pass, $row['password_hash'])) return null;

            $reactivated = false;
            if (!empty($row['deleted_at'])) {
                $reactivateStmt = $db->prepare("UPDATE {$table} SET deleted_at = NULL WHERE id = ?");
                if ($reactivateStmt) {
                    $reactivateStmt->bind_param('i', $row['id']);
                    $reactivateStmt->execute();
                    $reactivateStmt->close();
                    $reactivated = true;
                }
            }

            try {
                $loginStmt = $db->prepare("UPDATE {$table} SET last_login_at = NOW() WHERE id = ?");
                if ($loginStmt) {
                    $loginStmt->bind_param('i', $row['id']);
                    $loginStmt->execute();
                    $loginStmt->close();
                }
            } catch (\Throwable $_eLLAt) {}

            return [
                'success'     => true,
                'role'        => $table === 'admins' ? 'admin' : 'member',
                'reactivated' => $reactivated,
                'user'        => [
                    'id'                 => (int)$row['id'],
                    'account_email'      => isset($row['account_email']) ? (string)$row['account_email'] : '',
                    'username'           => (string)$row['username'],
                    'username_key'       => isset($row['username_key']) ? (string)$row['username_key'] : '',
                    'avatar'             => isset($row['avatar_file']) ? (string)$row['avatar_file'] : '',
                    'language'           => null,
                    'preferred_currency' => isset($row['preferred_currency']) ? (string)$row['preferred_currency'] : null,
                    'country_code'       => isset($row['country']) ? (string)$row['country'] : null,
                    'map_lighting'       => isset($row['map_lighting']) ? (string)$row['map_lighting'] : null,
                    'map_style'          => isset($row['map_style']) ? (string)$row['map_style'] : null,
                    'timezone'           => null,
                    'favorites'          => isset($row['favorites']) ? (string)$row['favorites'] : null,
                    'recent'             => isset($row['recent']) ? (string)$row['recent'] : null,
                    'filters_json'          => isset($row['filters_json']) ? (string)$row['filters_json'] : null,
                    'filters_hash'          => isset($row['filters_hash']) ? (string)$row['filters_hash'] : null,
                    'filters_version'       => isset($row['filters_version']) ? (int)$row['filters_version'] : null,
                    'filters_updated_at'    => isset($row['filters_updated_at']) ? (string)$row['filters_updated_at'] : null,
                    'email_notifications'   => isset($row['email_notifications']) ? (int)$row['email_notifications'] : 1,
                ],
            ];
        };

        $login = $attempt($mysqli, 'admins', $username, $password, $cols);
        if (!$login) $login = $attempt($mysqli, 'members', $username, $password, $cols);

        if ($login) {
            echo json_encode($login, JSON_UNESCAPED_SLASHES);
        } else {
            verify_json_fail('Incorrect email/username or password');
        }
        exit;
    }

    // -------------------------------------------------------------------------
    // COUPON
    // -------------------------------------------------------------------------
    if ($type === 'coupon') {
        $code     = isset($input['code'])      ? strtoupper(trim((string)$input['code'])) : '';
        $memberId = isset($input['member_id']) ? (int)$input['member_id']                 : 0;

        if ($code === '') {
            verify_json_fail('missing_code');
        }

        $pdo = null;
        if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
            $pdo = $GLOBALS['pdo'];
        } elseif (defined('DB_DSN')) {
            $pdo = new PDO(DB_DSN, defined('DB_USER') ? DB_USER : null, defined('DB_PASS') ? DB_PASS : null, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        } elseif (defined('DB_HOST') && defined('DB_NAME') && defined('DB_USER')) {
            $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
            $pdo = new PDO($dsn, DB_USER, defined('DB_PASS') ? DB_PASS : null, [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ]);
        }

        if (!$pdo instanceof PDO) {
            verify_json_fail('server_error');
        }

        $stmt = $pdo->prepare('SELECT `id`, `code`, `discount_type`, `discount_value`, `valid_from`, `valid_until`, `usage_limit`, `usage_count`, `one_per_member`, `status` FROM `checkout_coupons` WHERE `code` = ? LIMIT 1');
        $stmt->execute([$code]);
        $coupon = $stmt->fetch();

        if (!$coupon) {
            echo json_encode(['success' => false, 'error_key' => 'coupon_invalid']);
            exit;
        }

        if ($coupon['status'] !== 'active') {
            $key = $coupon['status'] === 'expired' ? 'coupon_expired' : 'coupon_invalid';
            echo json_encode(['success' => false, 'error_key' => $key]);
            exit;
        }

        $today = date('Y-m-d');
        if (!empty($coupon['valid_from']) && $today < $coupon['valid_from']) {
            echo json_encode(['success' => false, 'error_key' => 'coupon_invalid']);
            exit;
        }
        if (!empty($coupon['valid_until']) && $today > $coupon['valid_until']) {
            echo json_encode(['success' => false, 'error_key' => 'coupon_expired']);
            exit;
        }

        if ($coupon['usage_limit'] > 0 && $coupon['usage_count'] >= $coupon['usage_limit']) {
            echo json_encode(['success' => false, 'error_key' => 'coupon_limit_reached']);
            exit;
        }

        if ($coupon['one_per_member'] && $memberId > 0) {
            $useStmt = $pdo->prepare('SELECT COUNT(*) FROM `transactions` WHERE `member_id` = ? AND `coupon_id` = ? LIMIT 1');
            $useStmt->execute([$memberId, $coupon['id']]);
            $useCount = (int)$useStmt->fetchColumn();
            if ($useCount > 0) {
                echo json_encode(['success' => false, 'error_key' => 'coupon_already_used']);
                exit;
            }
        }

        echo json_encode([
            'success'        => true,
            'coupon_id'      => (int)$coupon['id'],
            'code'           => $coupon['code'],
            'discount_type'  => $coupon['discount_type'],
            'discount_value' => (int)$coupon['discount_value'],
        ], JSON_UNESCAPED_SLASHES);
        exit;
    }

    // -------------------------------------------------------------------------
    // RESET TOKEN
    // -------------------------------------------------------------------------
    if ($type === 'reset-token') {
        $token = isset($input['token']) ? trim((string)$input['token']) : '';
        if ($token === '') verify_json_fail('missing_token');

        $stmt = $mysqli->prepare(
            'SELECT member_id, member_role, expires_at, used FROM member_tokens WHERE token = ? AND token_type = ? LIMIT 1'
        );
        if (!$stmt) verify_json_fail('server_error');
        $tokenType = 'password_reset';
        $stmt->bind_param('ss', $token, $tokenType);
        $stmt->execute();
        $row = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$row)              verify_json_fail('token_invalid');
        if ($row['used'])       verify_json_fail('token_used');
        if (strtotime($row['expires_at']) < time()) verify_json_fail('token_expired');

        $upd = $mysqli->prepare('UPDATE member_tokens SET used = 1 WHERE token = ?');
        if ($upd) { $upd->bind_param('s', $token); $upd->execute(); $upd->close(); }

        $table = $row['member_role'] === 'admin' ? 'admins' : 'members';
        $cols  = 'id, account_email, username, username_key, avatar_file, map_lighting, map_style, favorites, recent, country, preferred_currency, filters_json, filters_hash, filters_version, filters_updated_at, deleted_at, email_notifications';
        $mStmt = $mysqli->prepare("SELECT {$cols} FROM `{$table}` WHERE id = ? LIMIT 1");
        if (!$mStmt) verify_json_fail('server_error');
        $mStmt->bind_param('i', $row['member_id']);
        $mStmt->execute();
        $mRow = $mStmt->get_result()->fetch_assoc();
        $mStmt->close();
        if (!$mRow) verify_json_fail('member_not_found');

        $loginStmt = $mysqli->prepare("UPDATE `{$table}` SET last_login_at = NOW() WHERE id = ?");
        if ($loginStmt) { $loginStmt->bind_param('i', $row['member_id']); $loginStmt->execute(); $loginStmt->close(); }

        echo json_encode([
            'success'     => true,
            'role'        => $row['member_role'],
            'reactivated' => false,
            'user'        => [
                'id'                 => (int)$mRow['id'],
                'account_email'      => (string)$mRow['account_email'],
                'username'           => (string)$mRow['username'],
                'username_key'       => (string)($mRow['username_key'] ?? ''),
                'avatar'             => (string)($mRow['avatar_file'] ?? ''),
                'language'           => null,
                'preferred_currency' => $mRow['preferred_currency'] ?? null,
                'country_code'       => $mRow['country'] ?? null,
                'map_lighting'       => $mRow['map_lighting'] ?? null,
                'map_style'          => $mRow['map_style'] ?? null,
                'timezone'           => null,
                'favorites'          => $mRow['favorites'] ?? null,
                'recent'             => $mRow['recent'] ?? null,
                'filters_json'          => $mRow['filters_json'] ?? null,
                'filters_hash'          => $mRow['filters_hash'] ?? null,
                'filters_version'       => isset($mRow['filters_version']) ? (int)$mRow['filters_version'] : null,
                'filters_updated_at'    => $mRow['filters_updated_at'] ?? null,
                'email_notifications'   => isset($mRow['email_notifications']) ? (int)$mRow['email_notifications'] : 1,
            ],
        ], JSON_UNESCAPED_SLASHES);
        exit;
    }

    // -------------------------------------------------------------------------
    // REQUEST PASSWORD RESET
    // -------------------------------------------------------------------------
    if ($type === 'request-password-reset') {
        $email = isset($input['email']) ? trim((string)$input['email']) : '';
        // Always return success — never reveal whether the email is registered
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            echo json_encode(['success' => true], JSON_UNESCAPED_SLASHES);
            exit;
        }

        $member = null; $memberRole = null;
        foreach (['members' => 'member', 'admins' => 'admin'] as $table => $role) {
            $stmt = $mysqli->prepare("SELECT id, username, account_email FROM `{$table}` WHERE account_email = ? AND deleted_at IS NULL LIMIT 1");
            if (!$stmt) continue;
            $stmt->bind_param('s', $email);
            $stmt->execute();
            $row = $stmt->get_result()->fetch_assoc();
            $stmt->close();
            if ($row) { $member = $row; $memberRole = $role; break; }
        }

        if (!$member) { echo json_encode(['success' => true], JSON_UNESCAPED_SLASHES); exit; }

        $token     = bin2hex(random_bytes(32));
        $expiresAt = date('Y-m-d H:i:s', time() + 3600);
        $tokenType = 'password_reset';
        $ins = $mysqli->prepare('INSERT INTO member_tokens (member_id, member_role, token_type, token, expires_at, used, created_at) VALUES (?, ?, ?, ?, ?, 0, NOW())');
        if (!$ins) { echo json_encode(['success' => true], JSON_UNESCAPED_SLASHES); exit; }
        $ins->bind_param('issss', $member['id'], $memberRole, $tokenType, $token, $expiresAt);
        $ins->execute();
        $ins->close();

        $sRes = $mysqli->query("SELECT setting_key, setting_value FROM admin_settings WHERE setting_key IN ('support_email','website_name','email_logo','folder_system_images','website_url')");
        $siteSettings = [];
        if ($sRes) { while ($r = $sRes->fetch_assoc()) $siteSettings[$r['setting_key']] = $r['setting_value']; $sRes->free(); }
        $fromEmail  = $siteSettings['support_email'] ?? '';
        $fromName   = $siteSettings['website_name'] ?? '';
        $siteUrl    = rtrim($siteSettings['website_url'] ?? '', '/');
        $logoFolder = rtrim($siteSettings['folder_system_images'] ?? '', '/');
        $logoFile   = $siteSettings['email_logo'] ?? '';
        $logoUrl    = ($logoFolder && $logoFile) ? $logoFolder . '/' . rawurlencode($logoFile) : '';
        $logoHtml   = $logoUrl ? '<div style="background:#fff;padding:24px;text-align:center;border-bottom:1px solid #eee;"><img src="' . htmlspecialchars($logoUrl) . '" alt="' . htmlspecialchars($fromName) . '" style="max-height:60px;max-width:100%;"></div>' : '';

        if ($fromEmail && $siteUrl) {
            $tStmt = $mysqli->prepare("SELECT message_name, message_text, supports_html FROM admin_messages WHERE message_key = 'msg_email_password_reset' AND container_key = 'msg_email' AND is_active = 1 LIMIT 1");
            if ($tStmt) {
                $tStmt->execute();
                $template = $tStmt->get_result()->fetch_assoc();
                $tStmt->close();
                if ($template) {
                    $resetLink = $siteUrl . '/reset-password=' . $token;
                    $safeName  = htmlspecialchars((string)$member['username'], ENT_QUOTES, 'UTF-8');
                    $subject   = str_replace('{name}', $safeName, $template['message_name']);
                    $body      = str_replace(['{name}', '{logo}', '{reset_link}'], [$safeName, $logoHtml, htmlspecialchars($resetLink)], $template['message_text']);
                    $msgKey    = 'msg_email_password_reset';
                    $logEmail  = function(string $status, ?string $notes = null) use ($mysqli, $member, $memberRole, $msgKey, $email) {
                        $l = $mysqli->prepare('INSERT INTO emails_sent (member_id, member_role, username, message_key, to_email, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
                        if ($l) { $l->bind_param('issssss', $member['id'], $memberRole, $member['username'], $msgKey, $email, $status, $notes); $l->execute(); $l->close(); }
                    };
                    if (!empty($SMTP_HOST) && !empty($SMTP_USERNAME) && !empty($SMTP_PASSWORD)) {
                        $docRoot = rtrim($_SERVER['DOCUMENT_ROOT'], '/\\');
                        if (file_exists($docRoot . '/libs/phpmailer/PHPMailer.php')) {
                            require_once $docRoot . '/libs/phpmailer/Exception.php';
                            require_once $docRoot . '/libs/phpmailer/PHPMailer.php';
                            require_once $docRoot . '/libs/phpmailer/SMTP.php';
                            $mail = new \PHPMailer\PHPMailer\PHPMailer(true);
                            try {
                                $mail->isSMTP(); $mail->Host = $SMTP_HOST; $mail->SMTPAuth = true;
                                $mail->Username = $SMTP_USERNAME; $mail->Password = $SMTP_PASSWORD;
                                $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS; $mail->Port = 465; $mail->CharSet = 'UTF-8';
                                $mail->setFrom($fromEmail, $fromName); $mail->addAddress($email, $member['username']); $mail->Subject = $subject;
                                if ($template['supports_html']) { $mail->isHTML(true); $mail->Body = $body; $mail->AltBody = strip_tags($body); } else { $mail->Body = strip_tags($body); }
                                $mail->send();
                                $logEmail('sent');
                            } catch (\Exception $e) { $logEmail('failed', $e->getMessage()); }
                        } else { $logEmail('failed', 'PHPMailer not found'); }
                    } else { $logEmail('failed', 'SMTP credentials missing'); }
                }
            }
        }

        echo json_encode(['success' => true], JSON_UNESCAPED_SLASHES);
        exit;
    }

    // -------------------------------------------------------------------------
    // Unknown type
    // -------------------------------------------------------------------------
    verify_json_fail('unknown_type');

} catch (Throwable $e) {
    verify_json_fail('server_error');
}
?>
