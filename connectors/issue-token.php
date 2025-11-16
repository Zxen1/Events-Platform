<?php
// issue-token.php — Mint an HttpOnly SameSite token for connector auth (top-level connectors alias)
declare(strict_types=1);

header('Content-Type: application/json');

try {
	$configCandidates = [
		__DIR__ . '/../config/config-auth.php',
		dirname(__DIR__) . '/config/config-auth.php',
		dirname(__DIR__, 2) . '/config/config-auth.php',
	];
	$configPath = null;
	foreach ($configCandidates as $candidate) {
		if (is_file($candidate)) { $configPath = $candidate; break; }
	}
	if ($configPath === null) {
		http_response_code(500);
		echo json_encode(['success' => false, 'message' => 'Auth config missing']);
		return;
	}
	require $configPath;

	if (!isset($API_KEY) || !is_string($API_KEY) || $API_KEY === '') {
		http_response_code(500);
		echo json_encode(['success' => false, 'message' => 'API key unavailable']);
		return;
	}

	$cookieName = 'FUNMAP_TOKEN';
	$cookieValue = $API_KEY;
	$secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
	$expires = time() + 30 * 60;

	@setcookie($cookieName, $cookieValue, [
		'expires' => $expires,
		'path' => '/',
		'secure' => $secure,
		'httponly' => true,
		'samesite' => 'Lax',
	]);

	echo json_encode(['success' => true, 'expires' => $expires]);
} catch (Throwable $e) {
	http_response_code(500);
	echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>

