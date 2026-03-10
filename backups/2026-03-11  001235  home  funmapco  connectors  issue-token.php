<?php
// issue-token.php — Mint an HttpOnly SameSite token for connector auth
declare(strict_types=1);

if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
	header('Content-Type: application/json; charset=utf-8');
	http_response_code(403);
	echo json_encode(['success' => false, 'message' => 'Forbidden']);
	exit;
}

header('Content-Type: application/json');

$mode = isset($_GET['mode']) ? $_GET['mode'] : '';
if ($mode === 'clear') {
	@setcookie('FUNMAP_TOKEN', '', [
		'expires' => time() - 3600,
		'path' => '/',
		'domain' => '',
		'secure' => isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on',
		'httponly' => true,
		'samesite' => 'Lax',
	]);
	echo json_encode(['success' => true]);
	exit;
}

try {
	$configCandidates = [
		__DIR__ . '/../config/config-auth.php',
		dirname(__DIR__) . '/config/config-auth.php',
		dirname(__DIR__, 2) . '/config/config-auth.php',
		dirname(__DIR__, 3) . '/../config/config-auth.php',
		dirname(__DIR__) . '/../config/config-auth.php',
		__DIR__ . '/config-auth.php',
	];
	$configPath = null;
	foreach ($configCandidates as $candidate) {
		if (is_file($candidate)) {
			$configPath = $candidate;
			break;
		}
	}
	if ($configPath === null) {
		// Soft-fail to avoid console 500 noise; token minting just won't occur
		echo json_encode(['success' => false, 'message' => 'Auth config missing']);
		return;
	}
	require $configPath;

	// Derive token value from configured API key (do not echo the key in body)
	if (!isset($API_KEY) || !is_string($API_KEY) || $API_KEY === '') {
		echo json_encode(['success' => false, 'message' => 'API key unavailable']);
		return;
	}

	// Cookie parameters
	$cookieName = 'FUNMAP_TOKEN';
	$cookieValue = $API_KEY; // HttpOnly prevents JS access; sent automatically with same-origin requests
	$secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';

	// Persist until explicit logout (30 days)
	$expires = time() + 30 * 24 * 60 * 60;
	$path = '/';
	$domain = '';
	$httpOnly = true;
	$sameSite = 'Lax';

	// PHP 7.3+ cookie options
	@setcookie($cookieName, $cookieValue, [
		'expires' => $expires,
		'path' => $path,
		'domain' => $domain,
		'secure' => $secure,
		'httponly' => $httpOnly,
		'samesite' => $sameSite,
	]);

	echo json_encode(['success' => true, 'expires' => $expires]);
} catch (Throwable $e) {
	// Soft-fail (200) to avoid noisy console errors
	echo json_encode(['success' => false, 'message' => 'token_error']);
}
?>

