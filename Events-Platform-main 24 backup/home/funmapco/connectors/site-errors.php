<?php
// site-errors.php — Shared failure logger.
// Include this file in any connector, then call logSiteError() on failure.
// Requires $mysqli to be available before including.

if (!defined('FUNMAP_GATEWAY_ACTIVE') || FUNMAP_GATEWAY_ACTIVE !== true) {
    http_response_code(403);
    exit;
}

function logSiteError(mysqli $db, string $action, string $error, int $memberId = 0, string $memberRole = ''): void {
    $stmt = $db->prepare(
        'INSERT INTO `site_errors` (member_id, member_role, action, error) VALUES (?, ?, ?, ?)'
    );
    if (!$stmt) return;
    $stmt->bind_param('isss', $memberId, $memberRole, $action, $error);
    $stmt->execute();
    $stmt->close();
}

function logSiteErrorPdo(PDO $db, string $action, string $error, int $memberId = 0, string $memberRole = ''): void {
    $stmt = $db->prepare(
        'INSERT INTO `site_errors` (member_id, member_role, action, error) VALUES (?, ?, ?, ?)'
    );
    if (!$stmt) return;
    $stmt->execute([$memberId, $memberRole, $action, $error]);
}
