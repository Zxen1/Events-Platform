<?php
declare(strict_types=1);

/**
 * Compatibility DB Guard
 *
 * This project intentionally keeps ALL application code pointing at exactly ONE schema:
 *   - funmapco_db
 *
 * funmapco_db is a compatibility layer (views) into:
 *   - funmapco_system
 *   - funmapco_content
 *
 * To prevent future agent drift/mistakes, backend connectors MUST refuse to run
 * unless the configured connection points to funmapco_db.
 */

if (!function_exists('funmap_assert_db_compat')) {
    function funmap_assert_db_compat(string $expectedDb = 'funmapco_db'): void
    {
        // Try to infer DB name from DSN (preferred)
        $dbName = null;

        if (defined('DB_DSN') && is_string(DB_DSN)) {
            if (preg_match('/\bdbname=([^;]+)/i', DB_DSN, $m)) {
                $dbName = $m[1];
            }
        }

        // Fallback: ask MySQL what database is selected
        if ($dbName === null && isset($GLOBALS['pdo']) && $GLOBALS['pdo'] instanceof PDO) {
            try {
                $stmt = $GLOBALS['pdo']->query('SELECT DATABASE()');
                $dbName = $stmt ? (string)$stmt->fetchColumn() : null;
            } catch (Throwable $e) {
                // ignore
            }
        }

        if ($dbName !== $expectedDb) {
            if (!headers_sent()) {
                header('Content-Type: application/json; charset=utf-8');
            }
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'message' => 'Database misconfiguration: connectors must use ' . $expectedDb . ' (compat schema).',
            ]);
            exit;
        }
    }
}


