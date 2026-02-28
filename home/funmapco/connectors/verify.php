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

        $cols = 'id, account_email, username, username_key, avatar_file, password_hash, map_lighting, map_style, favorites, recent, country, preferred_currency, filters_json, filters_hash, filters_version, filters_updated_at, deleted_at';

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

            $storageTable = ($table === 'admins') ? 'funmapco_system.admins' : 'funmapco_content.members';

            $reactivated = false;
            if (!empty($row['deleted_at'])) {
                $reactivateStmt = $db->prepare("UPDATE {$storageTable} SET deleted_at = NULL WHERE id = ?");
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
                    'filters_json'       => isset($row['filters_json']) ? (string)$row['filters_json'] : null,
                    'filters_hash'       => isset($row['filters_hash']) ? (string)$row['filters_hash'] : null,
                    'filters_version'    => isset($row['filters_version']) ? (int)$row['filters_version'] : null,
                    'filters_updated_at' => isset($row['filters_updated_at']) ? (string)$row['filters_updated_at'] : null,
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
    // Unknown type
    // -------------------------------------------------------------------------
    verify_json_fail('unknown_type');

} catch (Throwable $e) {
    verify_json_fail('server_error');
}
?>
