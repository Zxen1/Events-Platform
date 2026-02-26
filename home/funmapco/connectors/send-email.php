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
if ($configPath === null) {
  throw new RuntimeException('Database configuration file is missing.');
}
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
if ($authConfigPath === null) {
  throw new RuntimeException('Auth configuration file is missing.');
}
require_once $authConfigPath;

function fail($code, $msg) {
  http_response_code($code);
  echo json_encode(['success' => false, 'message' => $msg]);
  exit;
}
function ok($data = []) {
  echo json_encode(array_merge(['success' => true], $data));
  exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') fail(405, 'Method not allowed');

$message_key = trim($_POST['message_key'] ?? '');
$to_email    = trim($_POST['to_email'] ?? '');
$to_name     = trim($_POST['to_name'] ?? '');

if ($message_key === '') fail(400, 'message_key is required');
if ($to_email === '')    fail(400, 'to_email is required');
if (!filter_var($to_email, FILTER_VALIDATE_EMAIL)) fail(400, 'to_email is invalid');

$stmt = $mysqli->prepare(
  "SELECT message_name, message_text, supports_html, placeholders
   FROM admin_messages
   WHERE message_key = ? AND container_key = 'msg_email' AND is_active = 1
   LIMIT 1"
);
if (!$stmt) fail(500, 'Prepare failed');
$stmt->bind_param('s', $message_key);
$stmt->execute();
$result = $stmt->get_result();
$template = $result->fetch_assoc();
$stmt->close();

if (!$template) fail(404, 'Email template not found: ' . $message_key);

$settingsStmt = $mysqli->prepare(
  "SELECT setting_key, setting_value FROM admin_settings
   WHERE setting_key IN ('support_email', 'website_name', 'email_logo', 'folder_system_images')"
);
$settingsStmt->execute();
$settingsResult = $settingsStmt->get_result();
$siteSettings = [];
while ($row = $settingsResult->fetch_assoc()) {
  $siteSettings[$row['setting_key']] = $row['setting_value'];
}
$settingsStmt->close();
$fromEmail   = !empty($siteSettings['support_email'])      ? $siteSettings['support_email']      : 'support@funmap.com';
$fromName    = !empty($siteSettings['website_name'])       ? $siteSettings['website_name']       : 'FunMap';
$logoFolder  = rtrim($siteSettings['folder_system_images'] ?? '', '/');
$logoFile    = $siteSettings['email_logo'] ?? '';
$logoUrl     = ($logoFolder && $logoFile) ? $logoFolder . '/' . rawurlencode($logoFile) : '';
$logoHeader  = $logoUrl
  ? '<div style="background:#fff;padding:24px;text-align:center;border-bottom:1px solid #eee;"><img src="' . htmlspecialchars($logoUrl) . '" alt="' . htmlspecialchars($fromName) . '" style="max-height:60px;max-width:100%;"></div>'
  : '';

$subject = $template['message_name'];
$body    = $template['message_text'];

$allowed = $template['placeholders'] ? json_decode($template['placeholders'], true) : [];
if (is_array($allowed)) {
  foreach ($allowed as $key) {
    $value = $_POST[$key] ?? '';
    $body    = str_replace('{' . $key . '}', htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8'), $body);
    $subject = str_replace('{' . $key . '}', htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8'), $subject);
  }
}

$docRoot = rtrim($_SERVER['DOCUMENT_ROOT'], '/\\');
require_once $docRoot . '/libs/phpmailer/Exception.php';
require_once $docRoot . '/libs/phpmailer/PHPMailer.php';
require_once $docRoot . '/libs/phpmailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

$mail = new PHPMailer(true);
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
  $mail->addAddress($to_email, $to_name);
  $mail->Subject = $subject;

  if ($template['supports_html']) {
    $mail->isHTML(true);
    $mail->Body    = $logoHeader ? preg_replace('/(<div[^>]*font-family[^>]*>)/i', '$1' . $logoHeader, $body, 1) : $body;
    $mail->AltBody = strip_tags($body);
  } else {
    $mail->isHTML(false);
    $mail->Body = strip_tags($body);
  }

  $mail->send();

  $status      = 'sent';
  $member_id   = isset($_POST['member_id']) ? (int)$_POST['member_id'] : 0;
  $username_log = trim($_POST['username'] ?? '');
  $stmt = $mysqli->prepare('INSERT INTO `emails_sent` (member_id, username, message_key, to_email, status) VALUES (?, ?, ?, ?, ?)');
  if ($stmt) {
    $stmt->bind_param('issss', $member_id, $username_log, $message_key, $to_email, $status);
    $stmt->execute();
    $stmt->close();
  }

  ok(['to' => $to_email]);
} catch (Exception $e) {
  $status      = 'failed';
  $member_id   = isset($_POST['member_id']) ? (int)$_POST['member_id'] : 0;
  $username_log = trim($_POST['username'] ?? '');
  $stmt = $mysqli->prepare('INSERT INTO `emails_sent` (member_id, username, message_key, to_email, status) VALUES (?, ?, ?, ?, ?)');
  if ($stmt) {
    $stmt->bind_param('issss', $member_id, $username_log, $message_key, $to_email, $status);
    $stmt->execute();
    $stmt->close();
  }
  fail(500, 'Email failed: ' . $mail->ErrorInfo);
}
?>
