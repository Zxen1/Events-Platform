<?php
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

if (!function_exists('funmapEmailBootstrap')) {
  function funmapEmailBootstrap(): array {
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
      if (is_file($candidate)) {
        $authConfigPath = $candidate;
        break;
      }
    }
    if ($authConfigPath === null) {
      throw new RuntimeException('Auth configuration file is missing.');
    }
    require_once $authConfigPath;

    if (!isset($mysqli) || !($mysqli instanceof mysqli)) {
      throw new RuntimeException('Database connection not available.');
    }
    if (empty($SMTP_HOST) || empty($SMTP_USERNAME) || empty($SMTP_PASSWORD)) {
      throw new RuntimeException('SMTP configuration is missing.');
    }

    $settingsStmt = $mysqli->prepare(
      "SELECT setting_key, setting_value FROM admin_settings
       WHERE setting_key IN (
         'support_email',
         'website_name',
         'email_logo',
         'folder_system_images',
         'website_url',
         'storage_api_key',
         'storage_zone_name',
         'folder_avatars',
         'folder_post_images'
       )"
    );
    if (!$settingsStmt) {
      throw new RuntimeException('Failed to query admin settings.');
    }
    $settingsStmt->execute();
    $settingsResult = $settingsStmt->get_result();
    $siteSettings = [];
    while ($row = $settingsResult->fetch_assoc()) {
      $siteSettings[$row['setting_key']] = $row['setting_value'];
    }
    $settingsStmt->close();

    if (empty($siteSettings['support_email']) || empty($siteSettings['website_name'])) {
      throw new RuntimeException('Required admin email settings are missing.');
    }

    $smtpConfig = [
      'host' => $SMTP_HOST,
      'username' => $SMTP_USERNAME,
      'password' => $SMTP_PASSWORD,
    ];

    return [$mysqli, $smtpConfig, $siteSettings];
  }

  function funmapEmailLogoHtml(array $siteSettings): string {
    $fromName = $siteSettings['website_name'] ?? 'FunMap';
    $logoFolder = rtrim($siteSettings['folder_system_images'] ?? '', '/');
    $logoFile = $siteSettings['email_logo'] ?? '';
    $logoUrl = ($logoFolder !== '' && $logoFile !== '')
      ? $logoFolder . '/' . rawurlencode($logoFile)
      : '';

    if ($logoUrl === '') {
      return '';
    }

    return '<div style="background:#fff;padding:24px;text-align:center;border-bottom:1px solid #eee;"><img src="'
      . htmlspecialchars($logoUrl, ENT_QUOTES, 'UTF-8')
      . '" alt="'
      . htmlspecialchars($fromName, ENT_QUOTES, 'UTF-8')
      . '" style="max-height:60px;max-width:100%;"></div>';
  }

  function funmapEmailRequirePhpMailer(): void {
    $docRoot = !empty($_SERVER['DOCUMENT_ROOT'])
      ? rtrim($_SERVER['DOCUMENT_ROOT'], '/\\')
      : dirname(__DIR__, 2);

    require_once $docRoot . '/libs/phpmailer/Exception.php';
    require_once $docRoot . '/libs/phpmailer/PHPMailer.php';
    require_once $docRoot . '/libs/phpmailer/SMTP.php';
  }

  function funmapEmailLog(
    mysqli $db,
    int $memberId,
    ?string $memberRole,
    ?string $username,
    string $messageKey,
    string $toEmail,
    string $status,
    ?string $notes = null
  ): void {
    $stmt = $db->prepare(
      'INSERT INTO emails_sent (member_id, member_role, username, message_key, to_email, status, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    if (!$stmt) {
      return;
    }
    $stmt->bind_param(
      'issssss',
      $memberId,
      $memberRole,
      $username,
      $messageKey,
      $toEmail,
      $status,
      $notes
    );
    $stmt->execute();
    $stmt->close();
  }

  function funmapSendEmailWithContext(
    mysqli $db,
    array $smtpConfig,
    array $siteSettings,
    array $payload
  ): array {
    $messageKey = trim((string)($payload['message_key'] ?? ''));
    $toEmail = trim((string)($payload['to_email'] ?? ''));
    $toName = trim((string)($payload['to_name'] ?? ''));
    $memberId = isset($payload['member_id']) ? (int)$payload['member_id'] : 0;
    $memberRole = trim((string)($payload['member_role'] ?? ''));
    $username = trim((string)($payload['username'] ?? ''));

    if ($messageKey === '') {
      return ['success' => false, 'http_code' => 400, 'message' => 'message_key is required'];
    }
    if ($toEmail === '') {
      return ['success' => false, 'http_code' => 400, 'message' => 'to_email is required'];
    }
    if (!filter_var($toEmail, FILTER_VALIDATE_EMAIL)) {
      return ['success' => false, 'http_code' => 400, 'message' => 'to_email is invalid'];
    }

    if ($memberRole === '') {
      $memberRole = ($memberId > 0 && $memberId < 100) ? 'admin' : 'member';
    }

    $templateStmt = $db->prepare(
      "SELECT message_name, message_text, supports_html, placeholders
       FROM admin_messages
       WHERE message_key = ? AND container_key = 'msg_email' AND is_active = 1
       LIMIT 1"
    );
    if (!$templateStmt) {
      return ['success' => false, 'http_code' => 500, 'message' => 'Prepare failed'];
    }
    $templateStmt->bind_param('s', $messageKey);
    $templateStmt->execute();
    $template = $templateStmt->get_result()->fetch_assoc();
    $templateStmt->close();

    if (!$template) {
      return ['success' => false, 'http_code' => 404, 'message' => 'Email template not found: ' . $messageKey];
    }

    $subject = (string)$template['message_name'];
    $body = (string)$template['message_text'];
    $allowed = $template['placeholders'] ? json_decode((string)$template['placeholders'], true) : [];
    if (!is_array($allowed)) {
      $allowed = [];
    }

    $placeholderValues = [];
    foreach ($allowed as $key) {
      if (!is_string($key) || $key === '') {
        continue;
      }

      $value = '';
      if (isset($payload['placeholders']) && is_array($payload['placeholders']) && array_key_exists($key, $payload['placeholders'])) {
        $value = $payload['placeholders'][$key];
      } elseif (array_key_exists($key, $payload)) {
        $value = $payload[$key];
      }
      $value = (string)$value;
      $placeholderValues[$key] = $value;
      $safeValue = htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
      $subject = str_replace('{' . $key . '}', $safeValue, $subject);
      $body = str_replace('{' . $key . '}', $safeValue, $body);
    }

    $pluralize = function($matches) use ($placeholderValues) {
      if (!isset($placeholderValues[$matches[1]])) {
        return $matches[0];
      }
      return (int)$placeholderValues[$matches[1]] === 1 ? $matches[2] : $matches[3];
    };
    $subject = preg_replace_callback('/\{(\w+)\|([^|}]+)\|([^|}]+)\}/', $pluralize, $subject);
    $body = preg_replace_callback('/\{(\w+)\|([^|}]+)\|([^|}]+)\}/', $pluralize, $body);

    funmapEmailRequirePhpMailer();

    $fromEmail = $siteSettings['support_email'];
    $fromName = $siteSettings['website_name'];
    $logoHtml = funmapEmailLogoHtml($siteSettings);

    $mail = new PHPMailer(true);
    $status = 'failed';
    $error = null;

    try {
      $mail->isSMTP();
      $mail->Host = $smtpConfig['host'];
      $mail->SMTPAuth = true;
      $mail->Username = $smtpConfig['username'];
      $mail->Password = $smtpConfig['password'];
      $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
      $mail->Port = 465;
      $mail->CharSet = 'UTF-8';
      $mail->setFrom($fromEmail, $fromName);
      $mail->addAddress($toEmail, $toName);
      $mail->Subject = $subject;

      if (!empty($template['supports_html'])) {
        $mail->isHTML(true);
        $htmlBody = $logoHtml !== '' ? $logoHtml . $body : $body;
        $mail->Body = $htmlBody;
        $mail->AltBody = strip_tags($htmlBody);
      } else {
        $mail->isHTML(false);
        $mail->Body = strip_tags($body);
      }

      $mail->send();
      $status = 'sent';
    } catch (Exception $e) {
      $error = $mail->ErrorInfo ?: $e->getMessage();
    }

    funmapEmailLog($db, $memberId, $memberRole, $username, $messageKey, $toEmail, $status, $error);

    if ($status !== 'sent') {
      return ['success' => false, 'http_code' => 500, 'message' => 'Email failed: ' . (string)$error];
    }

    return ['success' => true, 'to' => $toEmail];
  }

  function funmapSendEmail(array $payload): array {
    [$db, $smtpConfig, $siteSettings] = funmapEmailBootstrap();
    return funmapSendEmailWithContext($db, $smtpConfig, $siteSettings, $payload);
  }
}

if (defined('FUNMAP_SEND_EMAIL_LIBRARY_ONLY') && FUNMAP_SEND_EMAIL_LIBRARY_ONLY === true) {
  return;
}

if (!defined('FUNMAP_GATEWAY_ACTIVE')) {
  header('Content-Type: application/json; charset=utf-8');
  http_response_code(403);
  echo json_encode(['success' => false, 'message' => 'Forbidden']);
  exit;
}

header('Content-Type: application/json; charset=utf-8');
error_reporting(0);
ini_set('display_errors', 0);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  http_response_code(405);
  echo json_encode(['success' => false, 'message' => 'Method not allowed']);
  exit;
}

try {
  [$db, $smtpConfig, $siteSettings] = funmapEmailBootstrap();
  $result = funmapSendEmailWithContext($db, $smtpConfig, $siteSettings, $_POST);
  if (!($result['success'] ?? false)) {
    http_response_code((int)($result['http_code'] ?? 500));
  }
  echo json_encode($result);
} catch (Throwable $e) {
  http_response_code(500);
  echo json_encode(['success' => false, 'message' => $e->getMessage()]);
}
