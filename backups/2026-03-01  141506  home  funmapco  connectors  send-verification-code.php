<?php
if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
  header('Content-Type: application/json; charset=utf-8');
  http_response_code(403);
  echo json_encode(['success' => false, 'message' => 'Forbidden']);
  exit;
}

header('Content-Type: application/json; charset=utf-8');
error_reporting(0);
ini_set('display_errors', 0);

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
if ($configPath === null) throw new RuntimeException('Database configuration file is missing.');
require_once $configPath;

$authConfigCandidates = [
  __DIR__ . '/../config/config-auth.php',
  dirname(__DIR__) . '/config/config-auth.php',
  dirname(__DIR__, 2) . '/config/config-auth.php',
  dirname(__DIR__, 3) . '/../config/config-auth.php',
  dirname(__DIR__) . '/../config/config-auth.php',
  __DIR__ . '/config-auth.php',
];
$authConfigPath = null;
foreach ($authConfigCandidates as $candidate) {
  if (is_file($candidate)) { $authConfigPath = $candidate; break; }
}
if ($authConfigPath === null) throw new RuntimeException('Auth configuration file is missing.');
require_once $authConfigPath;

function svc_fail($code, $msg) {
  http_response_code($code);
  echo json_encode(['success' => false, 'message' => $msg]);
  exit;
}
function svc_ok($data = []) {
  echo json_encode(array_merge(['success' => true], $data));
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') svc_fail(405, 'Method not allowed');

$email = trim($_POST['email'] ?? '');
if ($email === '') svc_fail(400, 'Email is required');
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) svc_fail(400, 'Invalid email address');

// Clean up expired tokens for this email
$mysqli->query(
  "DELETE FROM member_tokens WHERE email = '" . $mysqli->real_escape_string($email) . "'
   AND token_type = 'email_verification' AND expires_at <= NOW()"
);

// Cooldown: reject if a valid token was issued within the last 60 seconds
$stmt = $mysqli->prepare(
  "SELECT id FROM member_tokens
   WHERE email = ? AND token_type = 'email_verification' AND used = 0 AND expires_at > NOW()
     AND created_at > DATE_SUB(NOW(), INTERVAL 60 SECOND)
   LIMIT 1"
);
if (!$stmt) svc_fail(500, 'Prepare failed');
$stmt->bind_param('s', $email);
$stmt->execute();
$stmt->store_result();
if ($stmt->num_rows > 0) {
  $stmt->close();
  svc_fail(429, 'Please wait a moment before requesting another code.');
}
$stmt->close();

// Remove any existing valid tokens for this email (only one active at a time)
$stmt = $mysqli->prepare(
  "DELETE FROM member_tokens WHERE email = ? AND token_type = 'email_verification' AND used = 0"
);
if (!$stmt) svc_fail(500, 'Prepare failed');
$stmt->bind_param('s', $email);
$stmt->execute();
$stmt->close();

// Generate 6-character code (no ambiguous chars: no 0, O, 1, I, L)
$chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
$charLen = strlen($chars);
$code = '';
for ($i = 0; $i < 6; $i++) {
  $code .= $chars[random_int(0, $charLen - 1)];
}

// Insert token
$stmt = $mysqli->prepare(
  "INSERT INTO member_tokens (member_id, member_role, email, token_type, token, expires_at)
   VALUES (0, 'unverified', ?, 'email_verification', ?, DATE_ADD(NOW(), INTERVAL 15 MINUTE))"
);
if (!$stmt) svc_fail(500, 'Prepare failed');
$stmt->bind_param('ss', $email, $code);
if (!$stmt->execute()) {
  $stmt->close();
  svc_fail(500, 'Failed to store verification token');
}
$stmt->close();

// Fetch email settings
$settingsStmt = $mysqli->prepare(
  "SELECT setting_key, setting_value FROM admin_settings
   WHERE setting_key IN ('support_email', 'website_name', 'email_logo', 'folder_system_images')"
);
if (!$settingsStmt) svc_fail(500, 'Settings query failed');
$settingsStmt->execute();
$settingsResult = $settingsStmt->get_result();
$siteSettings = [];
while ($row = $settingsResult->fetch_assoc()) {
  $siteSettings[$row['setting_key']] = $row['setting_value'];
}
$settingsStmt->close();

$fromEmail  = !empty($siteSettings['support_email'])      ? $siteSettings['support_email']      : 'support@funmap.com';
$fromName   = !empty($siteSettings['website_name'])       ? $siteSettings['website_name']       : 'FunMap';
$logoFolder = rtrim($siteSettings['folder_system_images'] ?? '', '/');
$logoFile   = $siteSettings['email_logo'] ?? '';
$logoUrl    = ($logoFolder && $logoFile) ? $logoFolder . '/' . rawurlencode($logoFile) : '';
$logoHeader = $logoUrl
  ? '<div style="background:#fff;padding:24px;text-align:center;border-bottom:1px solid #eee;"><img src="' . htmlspecialchars($logoUrl) . '" alt="' . htmlspecialchars($fromName) . '" style="max-height:60px;max-width:100%;"></div>'
  : '';

// Fetch template
$tplStmt = $mysqli->prepare(
  "SELECT message_name, message_text, supports_html FROM admin_messages
   WHERE message_key = 'msg_email_verification_code' AND container_key = 'msg_email' AND is_active = 1 LIMIT 1"
);
if (!$tplStmt) svc_fail(500, 'Template query failed');
$tplStmt->execute();
$tpl = $tplStmt->get_result()->fetch_assoc();
$tplStmt->close();
if (!$tpl) svc_fail(500, 'Verification email template not found');

$subject = $tpl['message_name'];
$body    = $tpl['message_text'];
$body    = str_replace('{code}', htmlspecialchars($code, ENT_QUOTES, 'UTF-8'), $body);
$body    = str_replace('{logo}', $logoHeader, $body);

$docRoot = rtrim($_SERVER['DOCUMENT_ROOT'], '/\\');
require_once $docRoot . '/libs/phpmailer/Exception.php';
require_once $docRoot . '/libs/phpmailer/PHPMailer.php';
require_once $docRoot . '/libs/phpmailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$mail = new PHPMailer(true);
$status = 'failed';
try {
  $mail->isSMTP();
  $mail->Host       = $SMTP_HOST;
  $mail->SMTPAuth   = true;
  $mail->Username   = $SMTP_USERNAME;
  $mail->Password   = $SMTP_PASSWORD;
  $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
  $mail->Port       = 465;
  $mail->CharSet    = 'UTF-8';
  $mail->setFrom($fromEmail, $fromName);
  $mail->addAddress($email);
  $mail->Subject = $subject;
  if ($tpl['supports_html']) {
    $mail->isHTML(true);
    $mail->Body    = preg_replace('/(<div[^>]*font-family[^>]*>)/i', '$1' . $logoHeader, $body, 1);
    $mail->AltBody = strip_tags($body);
  } else {
    $mail->isHTML(false);
    $mail->Body = strip_tags($body);
  }
  $mail->send();
  $status = 'sent';

  $logStmt = $mysqli->prepare(
    'INSERT INTO emails_sent (member_id, member_role, message_key, to_email, status) VALUES (0, ?, ?, ?, ?)'
  );
  if ($logStmt) {
    $role = 'unverified';
    $key  = 'msg_email_verification_code';
    $logStmt->bind_param('ssss', $role, $key, $email, $status);
    $logStmt->execute();
    $logStmt->close();
  }

  svc_ok();
} catch (Exception $e) {
  $logStmt = $mysqli->prepare(
    'INSERT INTO emails_sent (member_id, member_role, message_key, to_email, status, notes) VALUES (0, ?, ?, ?, ?, ?)'
  );
  if ($logStmt) {
    $role  = 'unverified';
    $key   = 'msg_email_verification_code';
    $notes = $mail->ErrorInfo;
    $logStmt->bind_param('sssss', $role, $key, $email, $status, $notes);
    $logStmt->execute();
    $logStmt->close();
  }
  svc_fail(500, 'Failed to send verification email');
}
?>
