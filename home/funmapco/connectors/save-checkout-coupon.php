<?php
declare(strict_types=1);

if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Forbidden']);
    exit;
}

header('Content-Type: application/json');

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        http_response_code(405);
        echo json_encode(['success' => false, 'message' => 'Method not allowed']);
        return;
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
    foreach ($configCandidates as $candidate) {
        if (is_file($candidate)) { $configPath = $candidate; break; }
    }

    if ($configPath === null) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database configuration file is missing.']);
        return;
    }
    require_once $configPath;

    $pdo = null;
    if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
        $pdo = $GLOBALS['pdo'];
    } elseif (defined('DB_DSN')) {
        $pdo = new PDO(DB_DSN, defined('DB_USER') ? DB_USER : null, defined('DB_PASS') ? DB_PASS : null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    } elseif (defined('DB_HOST') && defined('DB_NAME') && defined('DB_USER')) {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=utf8mb4', DB_HOST, DB_NAME);
        $pdo = new PDO($dsn, DB_USER, defined('DB_PASS') ? DB_PASS : null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }

    if (!$pdo instanceof PDO) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Database connection not configured.']);
        return;
    }

    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!is_array($data)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Invalid request data']);
        return;
    }

    $id = isset($data['id']) && is_numeric($data['id']) ? (int)$data['id'] : null;
    $allowedCols = ['code', 'description', 'discount_type', 'discount_value', 'valid_from', 'valid_until', 'usage_limit', 'usage_count', 'status'];

    if ($id !== null) {
        // Update — only fields present in the payload
        $fields = [];
        $params = [':id' => $id];

        foreach ($allowedCols as $col) {
            if (array_key_exists($col, $data)) {
                $fields[] = '`' . $col . '` = :' . $col;
                $params[':' . $col] = $data[$col] === '' ? null : $data[$col];
            }
        }

        if (empty($fields)) {
            echo json_encode(['success' => true, 'message' => 'Nothing to update']);
            return;
        }

        $stmt = $pdo->prepare(
            'UPDATE `checkout_coupons` SET ' . implode(', ', $fields) . ', `updated_at` = CURRENT_TIMESTAMP WHERE `id` = :id'
        );
        $stmt->execute($params);

        echo json_encode(['success' => true, 'message' => 'Coupon updated']);

    } else {
        // Insert new
        $code = isset($data['code']) ? strtoupper(trim((string)$data['code'])) : '';
        if ($code === '') {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => 'Code is required']);
            return;
        }

        $discountType = in_array($data['discount_type'] ?? '', ['percent', 'fixed']) ? $data['discount_type'] : 'percent';
        $discountValue = isset($data['discount_value']) ? round((float)$data['discount_value'], 2) : 0;
        $status = in_array($data['status'] ?? '', ['active', 'expired', 'disabled']) ? $data['status'] : 'active';

        $stmt = $pdo->prepare('
            INSERT INTO `checkout_coupons`
                (`code`, `description`, `discount_type`, `discount_value`, `valid_from`, `valid_until`, `usage_limit`, `status`)
            VALUES
                (:code, :description, :discount_type, :discount_value, :valid_from, :valid_until, :usage_limit, :status)
        ');
        $stmt->execute([
            ':code'           => $code,
            ':description'    => isset($data['description']) && $data['description'] !== '' ? trim((string)$data['description']) : null,
            ':discount_type'  => $discountType,
            ':discount_value' => $discountValue,
            ':valid_from'     => !empty($data['valid_from']) ? (string)$data['valid_from'] : null,
            ':valid_until'    => !empty($data['valid_until']) ? (string)$data['valid_until'] : null,
            ':usage_limit'    => isset($data['usage_limit']) ? (int)$data['usage_limit'] : 0,
            ':status'         => $status,
        ]);

        echo json_encode(['success' => true, 'message' => 'Coupon created', 'id' => (int)$pdo->lastInsertId()]);
    }

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
