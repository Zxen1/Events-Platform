<?php
declare(strict_types=1);

header('Content-Type: application/json');

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
        http_response_code(405);
        echo json_encode([
            'success' => false,
            'message' => 'Method not allowed',
        ]);
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
        if (is_file($candidate)) {
            $configPath = $candidate;
            break;
        }
    }

    if ($configPath === null) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Database configuration file is missing.',
        ]);
        return;
    }
    require_once $configPath;

    $pdo = null;
    if (isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
        $pdo = $GLOBALS['pdo'];
    } elseif (defined('DB_DSN')) {
        $user = defined('DB_USER') ? DB_USER : null;
        $pass = defined('DB_PASS') ? DB_PASS : null;
        $pdo = new PDO(DB_DSN, $user, $pass, [
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
        echo json_encode([
            'success' => false,
            'message' => 'Database connection not configured.',
        ]);
        return;
    }

    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    // Check if admin_settings table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'admin_settings'");
    if ($stmt->rowCount() === 0) {
        // Table doesn't exist, return defaults
        echo json_encode([
            'success' => true,
            'settings' => [
                'spin_on_load' => false,
                'spin_load_type' => 'everyone',
                'spin_on_logo' => true,
                'site_currency' => 'USD',
            ],
        ]);
        return;
    }

    // Fetch all settings
    $stmt = $pdo->query('SELECT `setting_key`, `setting_value`, `setting_type` FROM `admin_settings`');
    $rows = $stmt->fetchAll();

    $settings = [];
    foreach ($rows as $row) {
        $key = $row['setting_key'];
        $value = $row['setting_value'];
        $type = $row['setting_type'] ?? 'string';

        // Convert value based on type
        switch ($type) {
            case 'boolean':
                $settings[$key] = ($value === 'true' || $value === '1' || $value === 1);
                break;
            case 'number':
                $settings[$key] = is_numeric($value) ? (float)$value : 0;
                break;
            case 'json':
                $settings[$key] = json_decode($value, true) ?? [];
                break;
            default:
                $settings[$key] = $value;
        }
    }

    echo json_encode([
        'success' => true,
        'settings' => $settings,
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}

