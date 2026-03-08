<?php
// send-email.php
//
// Operates in two modes:
//
// GATEWAY MODE  — called via the gateway (FUNMAP_GATEWAY_ACTIVE defined).
//                 Handles a single HTTP POST request and sends one email.
//
// LIBRARY MODE  — included by cron.php (EMAIL_LIBRARY_MODE defined).
//                 Defines emailBootstrap() and sendEmailWithContext().
//                 No HTTP request handling runs.

if (!defined('FUNMAP_GATEWAY_ACTIVE') && !defined('EMAIL_LIBRARY_MODE')) {
  http_response_code(403);
  exit;
}

// ─── Config (shared by both modes) ───────────────────────────────────────────

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

// ─── Library mode ────────────────────────────────────────────────────────────

if (defined('EMAIL_LIBRARY_MODE')) {

  /**
   * Bootstrap the email system for CLI/cron use.
   * Returns [$mysqli, $smtpConfig, $siteSettings].
   * Call once at the top of cron.php.
   */
  function emailBootstrap(): array {
    global $mysqli, $SMTP_HOST, $SMTP_USERNAME, $SMTP_PASSWORD;

    $stmt = $mysqli->prepare(
      "SELECT setting_key, setting_value FROM admin_settings
       WHERE setting_key IN (
         'support_email','website_name','email_logo','folder_system_images',
         'website_url','storage_api_key','storage_zone_name',
         'folder_avatars','folder_post_images'
       )"
    );
    if (!$stmt) {
      throw new RuntimeException('emailBootstrap: failed to prepare settings query.');
    }
    $stmt->execute();
    $siteSettings = [];
    $res = $stmt->get_result();
    while ($row = $res->fetch_assoc()) {
      $siteSettings[$row['setting_key']] = $row['setting_value'];
    }
    $stmt->close();

    $smtpConfig = [
      'host'     => $SMTP_HOST,
      'username' => $SMTP_USERNAME,
      'password' => $SMTP_PASSWORD,
    ];

    return [$mysqli, $smtpConfig, $siteSettings];
  }

  /**
   * Send a single email using a template key.
   *
   * $params keys:
   *   message_key  (string, required)
   *   member_id    (int)
   *   member_role  (string: 'member' or 'admin')
   *   username     (string)
   *   to_email     (string, required)
   *   to_name      (string, falls back to username)
   *   placeholders (array — values are substituted as-is; caller is responsible
   *                  for htmlspecialchars on plain-text values and passing HTML
   *                  values raw)
   *
   * Returns ['success' => bool].
   * Logs result to emails_sent regardless of outcome.
   * Throws RuntimeException if template is missing.
   */
  function sendEmailWithContext(
    mysqli $db,
    array  $smtpConfig,
    array  $siteSettings,
    array  $params
  ): array {
    $messageKey   = (string)($params['message_key']  ?? '');
    $memberId     = (int)($params['member_id']        ?? 0);
    $memberRole   = (string)($params['member_role']   ?? 'member');
    $username     = (string)($params['username']      ?? '');
    $toEmail      = (string)($params['to_email']      ?? '');
    $toName       = (string)($params['to_name']       ?? $username);
    $placeholders = (array)($params['placeholders']   ?? []);

    $stmt = $db->prepare(
      "SELECT message_name, message_text, supports_html, placeholders
       FROM admin_messages
       WHERE message_key = ? AND container_key = 'msg_email' AND is_active = 1
       LIMIT 1"
    );
    if (!$stmt) {
      throw new RuntimeException('sendEmailWithContext: failed to prepare template query.');
    }
    $stmt->bind_param('s', $messageKey);
    $stmt->execute();
    $template = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$template) {
      throw new RuntimeException('Email template not found or inactive: ' . $messageKey);
    }

    $fromEmail  = $siteSettings['support_email']           ?? '';
    $fromName   = $siteSettings['website_name']            ?? '';
    $logoFolder = rtrim($siteSettings['folder_system_images'] ?? '', '/');
    $logoFile   = $siteSettings['email_logo']              ?? '';
    $logoUrl    = ($logoFolder && $logoFile)
      ? $logoFolder . '/' . rawurlencode($logoFile)
      : '';
    $logoHeader = $logoUrl
      ? '<div style="background:#fff;padding:24px;text-align:center;border-bottom:1px solid #eee;">'
        . '<img src="' . htmlspecialchars($logoUrl) . '" alt="' . htmlspecialchars($fromName) . '"'
        . ' style="max-height:60px;max-width:100%;"></div>'
      : '';

    $subject = $template['message_name'];
    $body    = $template['message_text'];

    // Substitute placeholders (values provided as-is — no additional escaping).
    foreach ($placeholders as $key => $value) {
      $body    = str_replace('{' . $key . '}', (string)$value, $body);
      $subject = str_replace('{' . $key . '}', (string)$value, $subject);
    }

    // Pluralization: {variable|singular|plural}
    $pluralCb = function (array $m) use ($placeholders): string {
      if (!array_key_exists($m[1], $placeholders)) return $m[0];
      return (int)$placeholders[$m[1]] === 1 ? $m[2] : $m[3];
    };
    $body    = preg_replace_callback('/\{(\w+)\|([^|}]+)\|([^|}]+)\}/', $pluralCb, $body);
    $subject = preg_replace_callback('/\{(\w+)\|([^|}]+)\|([^|}]+)\}/', $pluralCb, $subject);

    // PHPMailer — derive docroot from file location (CLI has no DOCUMENT_ROOT).
    $docRoot = dirname(__DIR__, 3);
    require_once $docRoot . '/libs/phpmailer/Exception.php';
    require_once $docRoot . '/libs/phpmailer/PHPMailer.php';
    require_once $docRoot . '/libs/phpmailer/SMTP.php';

    $mail   = new \PHPMailer\PHPMailer\PHPMailer(true);
    $status = 'failed';
    $notes  = '';

    try {
      $mail->isSMTP();
      $mail->Host       = $smtpConfig['host'];
      $mail->SMTPAuth   = true;
      $mail->Username   = $smtpConfig['username'];
      $mail->Password   = $smtpConfig['password'];
      $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
      $mail->Port       = 465;
      $mail->CharSet    = 'UTF-8';
      $mail->setFrom($fromEmail, $fromName);
      $mail->addAddress($toEmail, $toName);
      $mail->Subject = $subject;

      if (!empty($template['supports_html'])) {
        $mail->isHTML(true);
        $mail->Body    = $logoHeader
          ? preg_replace('/(<div[^>]*font-family[^>]*>)/i', '$1' . $logoHeader, $body, 1)
          : $body;
        $mail->AltBody = strip_tags($body);
      } else {
        $mail->isHTML(false);
        $mail->Body = strip_tags($body);
      }

      $mail->send();
      $status = 'sent';
    } catch (\PHPMailer\PHPMailer\Exception $e) {
      $notes = $e->getMessage();
    }

    $logStmt = $db->prepare(
      'INSERT INTO emails_sent
         (member_id, member_role, username, message_key, to_email, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    if ($logStmt) {
      $logStmt->bind_param(
        'issssss',
        $memberId, $memberRole, $username, $messageKey, $toEmail, $status, $notes
      );
      $logStmt->execute();
      $logStmt->close();
    }

    return ['success' => $status === 'sent'];
  }

  return; // Stop here — do not execute gateway code.
}

// ─── Gateway mode ────────────────────────────────────────────────────────────

header('Content-Type: application/json; charset=utf-8');
error_reporting(0);
ini_set('display_errors', 0);

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
$to_email    = trim($_POST['to_email']    ?? '');
$to_name     = trim($_POST['to_name']     ?? '');

if ($message_key === '') fail(400, 'message_key is required');
if ($to_email    === '') fail(400, 'to_email is required');
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
$template = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$template) fail(404, 'Email template not found: ' . $message_key);

$settingsStmt = $mysqli->prepare(
  "SELECT setting_key, setting_value FROM admin_settings
   WHERE setting_key IN ('support_email', 'website_name', 'email_logo', 'folder_system_images')"
);
$settingsStmt->execute();
$siteSettings = [];
$settingsResult = $settingsStmt->get_result();
while ($row = $settingsResult->fetch_assoc()) {
  $siteSettings[$row['setting_key']] = $row['setting_value'];
}
$settingsStmt->close();

if (empty($siteSettings['support_email'])) fail(500, 'Required setting missing: support_email');
if (empty($siteSettings['website_name']))  fail(500, 'Required setting missing: website_name');

$fromEmail  = $siteSettings['support_email'];
$fromName   = $siteSettings['website_name'];
$logoFolder = rtrim($siteSettings['folder_system_images'] ?? '', '/');
$logoFile   = $siteSettings['email_logo'] ?? '';
$logoUrl    = ($logoFolder && $logoFile) ? $logoFolder . '/' . rawurlencode($logoFile) : '';
$logoHeader = $logoUrl
  ? '<div style="background:#fff;padding:24px;text-align:center;border-bottom:1px solid #eee;"><img src="' . htmlspecialchars($logoUrl) . '" alt="' . htmlspecialchars($fromName) . '" style="max-height:60px;max-width:100%;"></div>'
  : '';

$subject = $template['message_name'];
$body    = $template['message_text'];

$allowed = $template['placeholders'] ? json_decode($template['placeholders'], true) : [];
$placeholderValues = [];
if (is_array($allowed)) {
  foreach ($allowed as $key) {
    $value = $_POST[$key] ?? '';
    $placeholderValues[$key] = $value;
    $body    = str_replace('{' . $key . '}', htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8'), $body);
    $subject = str_replace('{' . $key . '}', htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8'), $subject);
  }
}

// Pluralization: {variable|singular|plural}
$pluralizeCallback = function ($m) use ($placeholderValues) {
  if (!isset($placeholderValues[$m[1]])) return $m[0];
  return (int)$placeholderValues[$m[1]] === 1 ? $m[2] : $m[3];
};
$body    = preg_replace_callback('/\{(\w+)\|([^|}]+)\|([^|}]+)\}/', $pluralizeCallback, $body);
$subject = preg_replace_callback('/\{(\w+)\|([^|}]+)\|([^|}]+)\}/', $pluralizeCallback, $subject);

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
    $mail->Body    = $logoHeader
      ? preg_replace('/(<div[^>]*font-family[^>]*>)/i', '$1' . $logoHeader, $body, 1)
      : $body;
    $mail->AltBody = strip_tags($body);
  } else {
    $mail->isHTML(false);
    $mail->Body = strip_tags($body);
  }

  $mail->send();

  $status          = 'sent';
  $member_id       = isset($_POST['member_id']) ? (int)$_POST['member_id'] : 0;
  $member_role_log = ($member_id > 0 && $member_id < 100) ? 'admin' : 'member';
  $username_log    = trim($_POST['username'] ?? '');
  $stmt = $mysqli->prepare(
    'INSERT INTO emails_sent (member_id, member_role, username, message_key, to_email, status)
     VALUES (?, ?, ?, ?, ?, ?)'
  );
  if ($stmt) {
    $stmt->bind_param('isssss', $member_id, $member_role_log, $username_log, $message_key, $to_email, $status);
    $stmt->execute();
    $stmt->close();
  }

  ok(['to' => $to_email]);
} catch (Exception $e) {
  $status          = 'failed';
  $member_id       = isset($_POST['member_id']) ? (int)$_POST['member_id'] : 0;
  $member_role_log = ($member_id > 0 && $member_id < 100) ? 'admin' : 'member';
  $username_log    = trim($_POST['username'] ?? '');
  $stmt = $mysqli->prepare(
    'INSERT INTO emails_sent (member_id, member_role, username, message_key, to_email, status)
     VALUES (?, ?, ?, ?, ?, ?)'
  );
  if ($stmt) {
    $stmt->bind_param('isssss', $member_id, $member_role_log, $username_log, $message_key, $to_email, $status);
    $stmt->execute();
    $stmt->close();
  }
  fail(500, 'Email failed: ' . $mail->ErrorInfo);
}
