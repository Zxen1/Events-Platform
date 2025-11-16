<?php
// issue-token.php — Mint an HttpOnly SameSite token for connector auth
declare(strict_types=1);

header('Content-Type: application/json');

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
		http_response_code(500);
		echo json_encode(['success' => false, 'message' => 'Auth config missing']);
		return;
	}
	require $configPath;

	// Derive token value from configured API key (do not echo the key in body)
	if (!isset($API_KEY) || !is_string($API_KEY) || $API_KEY === '') {
		http_response_code(500);
		echo json_encode(['success' => false, 'message' => 'API key unavailable']);
		return;
	}

	// Cookie parameters
	$cookieName = 'FUNMAP_TOKEN';
	$cookieValue = $API_KEY; // HttpOnly prevents JS access; sent automatically with same-origin requests
	$secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';

	// 30 minutes expiry for safety; can be renewed
	$expires = time() + 30 * 60;
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
	http_response_code(500);
	echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
?>

