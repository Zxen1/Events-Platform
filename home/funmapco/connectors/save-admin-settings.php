<?php
declare(strict_types=1);

header('Content-Type: application/json');

try {
    if (($_SERVER['REQUEST_METHOD'] ?? 'POST') !== 'POST') {
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

    // Get POST data
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (!is_array($data) || empty($data)) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'message' => 'Invalid request data',
        ]);
        return;
    }

    // Check if admin_settings table exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'admin_settings'");
    if ($stmt->rowCount() === 0) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Admin settings table does not exist. Please run migrations.',
        ]);
        return;
    }

    // Separate messages from settings
    $messages = null;
    $settings = $data;
    if (isset($data['messages']) && is_array($data['messages'])) {
        $messages = $data['messages'];
        unset($settings['messages']);
    }

    // Save settings
    if (!empty($settings)) {
        $stmt = $pdo->prepare('
            INSERT INTO `admin_settings` (`setting_key`, `setting_value`, `setting_type`)
            VALUES (:key, :value, :type)
            ON DUPLICATE KEY UPDATE
                `setting_value` = VALUES(`setting_value`),
                `setting_type` = VALUES(`setting_type`)
        ');

        foreach ($settings as $key => $value) {
            // Determine type
            $type = 'string';
            $stringValue = null;

            if (is_bool($value)) {
                $type = 'boolean';
                $stringValue = $value ? 'true' : 'false';
            } elseif (is_int($value)) {
                $type = 'integer';
                $stringValue = (string)$value;
            } elseif (is_numeric($value)) {
                $type = 'decimal';
                $stringValue = (string)$value;
            } elseif (is_array($value) || is_object($value)) {
                $type = 'json';
                $stringValue = json_encode($value);
            } else {
                $stringValue = (string)$value;
            }

            $stmt->execute([
                ':key' => $key,
                ':value' => $stringValue,
                ':type' => $type,
            ]);
        }
    }

    // Save messages if provided
    $messagesUpdated = 0;
    if ($messages !== null && is_array($messages) && !empty($messages)) {
        // Check if admin_messages table exists
        $stmt = $pdo->query("SHOW TABLES LIKE 'admin_messages'");
        if ($stmt->rowCount() > 0) {
            $stmt = $pdo->prepare('
                UPDATE `admin_messages`
                SET `message_text` = :message_text,
                    `updated_at` = CURRENT_TIMESTAMP
                WHERE `id` = :id
            ');

            foreach ($messages as $message) {
                if (!isset($message['id']) || !isset($message['message_text'])) {
                    continue;
                }
                $stmt->execute([
                    ':id' => (int)$message['id'],
                    ':message_text' => (string)$message['message_text'],
                ]);
                if ($stmt->rowCount() > 0) {
                    $messagesUpdated++;
                }
            }
        }
    }


    $response = [
        'success' => true,
        'message' => 'Settings saved successfully',
    ];

    if ($messagesUpdated > 0) {
        $response['messages_updated'] = $messagesUpdated;
    }

    echo json_encode($response);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}

