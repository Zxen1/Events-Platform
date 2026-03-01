<?php
if (!defined('FUNMAP_GATEWAY_ACTIVE') || FUNMAP_GATEWAY_ACTIVE !== true) {
  http_response_code(403);
  exit;
}
// connectors/delete-post.php — Soft delete (schedule for deletion)
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
  echo json_encode(['success' => false, 'message' => 'Database configuration file is missing.']);
  exit;
}
require_once $configPath;

function fail($code, $msg) {
  http_response_code($code);
  echo json_encode(['success' => false, 'error' => $msg]);
  exit;
}

$input      = json_decode(file_get_contents('php://input'), true);
$postId     = isset($input['post_id'])    ? intval($input['post_id'])        : 0;
$memberId   = isset($input['member_id'])  ? intval($input['member_id'])       : 0;
$memberType = isset($input['member_type']) ? trim($input['member_type'])      : 'member';

if ($postId <= 0 || $memberId <= 0) fail(400, 'Missing post_id/member_id');

$memberTable = ($memberType === 'admin') ? 'admins' : 'members';

// Verify ownership
$check = $mysqli->prepare("SELECT p.id FROM posts p WHERE p.id = ? AND p.member_id = ? AND p.deleted_at IS NULL LIMIT 1");
if (!$check) fail(500, 'Prepare failed');
$check->bind_param('ii', $postId, $memberId);
$check->execute();
$check->store_result();
if ($check->num_rows === 0) { $check->close(); fail(404, 'Post not found or already deleted'); }
$check->close();

// Get post title (first map card)
$postTitle = '';
$titleStmt = $mysqli->prepare("SELECT title FROM post_map_cards WHERE post_id = ? ORDER BY id ASC LIMIT 1");
if ($titleStmt) {
  $titleStmt->bind_param('i', $postId);
  $titleStmt->execute();
  $titleStmt->bind_result($postTitle);
  $titleStmt->fetch();
  $titleStmt->close();
}

// Get member email and username for email
$memberEmail    = '';
$memberUsername = '';
$mStmt = $mysqli->prepare("SELECT account_email, username FROM `{$memberTable}` WHERE id = ? LIMIT 1");
if ($mStmt) {
  $mStmt->bind_param('i', $memberId);
  $mStmt->execute();
  $mStmt->bind_result($memberEmail, $memberUsername);
  $mStmt->fetch();
  $mStmt->close();
}

// Soft delete: set deleted_at and visibility = 'deleted'
$update = $mysqli->prepare("UPDATE posts SET deleted_at = NOW(), visibility = 'deleted' WHERE id = ?");
if (!$update) fail(500, 'Prepare failed');
$update->bind_param('i', $postId);
$update->execute();
$affected = $update->affected_rows;
$update->close();

if ($affected <= 0) fail(500, 'Delete failed');

$deletionDate = date('j F Y', strtotime('+30 days'));

// Send email
if ($memberEmail) {
  send_post_deletion_requested_email($mysqli, $memberEmail, $memberUsername, $memberId, $memberUsername, $postTitle, $deletionDate);
}

echo json_encode([
  'success'       => true,
  'message'       => 'Post scheduled for deletion',
  'deleted_at'    => date('Y-m-d H:i:s'),
  'deletion_date' => $deletionDate,
]);

function send_post_deletion_requested_email($mysqli, $to_email, $to_name, $member_id, $username, $post_title, $deletion_date) {
  global $SMTP_HOST, $SMTP_USERNAME, $SMTP_PASSWORD;
  $msgKey = 'msg_email_post_deletion_requested';
  $logFailed = function($notes = null) use ($mysqli, $member_id, $username, $msgKey, $to_email) {
    $l = $mysqli->prepare('INSERT INTO `emails_sent` (member_id, username, message_key, to_email, status, notes) VALUES (?, ?, ?, ?, ?, ?)');
    if ($l) { $s = 'failed'; $l->bind_param('isssss', $member_id, $username, $msgKey, $to_email, $s, $notes); $l->execute(); $l->close(); }
  };
  $stmt = $mysqli->prepare(
    "SELECT message_name, message_text, supports_html FROM admin_messages
     WHERE message_key = 'msg_email_post_deletion_requested' AND container_key = 'msg_email' AND is_active = 1 LIMIT 1"
  );
  if (!$stmt) { $logFailed('DB prepare failed for template query'); return; }
  $stmt->execute();
  $template = $stmt->get_result()->fetch_assoc();
  $stmt->close();
  if (!$template) { $logFailed('Email template not found or inactive'); return; }
  $sRes = $mysqli->query("SELECT setting_key, setting_value FROM admin_settings WHERE setting_key IN ('support_email','website_name','email_logo','folder_system_images')");
  $siteSettings = [];
  if ($sRes) { while ($r = $sRes->fetch_assoc()) $siteSettings[$r['setting_key']] = $r['setting_value']; $sRes->free(); }
  $fromEmail = $siteSettings['support_email'] ?? '';
  if (!$fromEmail) { $logFailed('support_email not configured in admin_settings'); return; }
  $fromName   = $siteSettings['website_name'] ?? '';
  $logoFolder = rtrim($siteSettings['folder_system_images'] ?? '', '/');
  $logoFile   = $siteSettings['email_logo'] ?? '';
  $logoUrl    = ($logoFolder && $logoFile) ? $logoFolder . '/' . rawurlencode($logoFile) : '';
  $logoHtml   = $logoUrl
    ? '<div style="background:#fff;padding:24px;text-align:center;border-bottom:1px solid #eee;"><img src="' . htmlspecialchars($logoUrl) . '" alt="' . htmlspecialchars($fromName) . '" style="max-height:60px;max-width:100%;"></div>'
    : '';
  $safeName  = htmlspecialchars((string)$to_name,    ENT_QUOTES, 'UTF-8');
  $safeTitle = htmlspecialchars((string)$post_title, ENT_QUOTES, 'UTF-8');
  $safeDate  = htmlspecialchars((string)$deletion_date, ENT_QUOTES, 'UTF-8');
  $subject   = str_replace(['{name}', '{title}', '{date}'], [$safeName, $safeTitle, $safeDate], $template['message_name']);
  $body      = str_replace(['{name}', '{title}', '{date}', '{logo}'], [$safeName, $safeTitle, $safeDate, $logoHtml], $template['message_text']);
  if (empty($SMTP_HOST) || empty($SMTP_USERNAME) || empty($SMTP_PASSWORD)) { $logFailed('SMTP credentials missing'); return; }
  $docRoot = rtrim($_SERVER['DOCUMENT_ROOT'], '/\\');
  if (!file_exists($docRoot . '/libs/phpmailer/PHPMailer.php')) { $logFailed('PHPMailer not found'); return; }
  require_once $docRoot . '/libs/phpmailer/Exception.php';
  require_once $docRoot . '/libs/phpmailer/PHPMailer.php';
  require_once $docRoot . '/libs/phpmailer/SMTP.php';
  $mail   = new \PHPMailer\PHPMailer\PHPMailer(true);
  $status = 'failed';
  $errorNote = null;
  try {
    $mail->isSMTP();
    $mail->Host       = $SMTP_HOST;
    $mail->SMTPAuth   = true;
    $mail->Username   = $SMTP_USERNAME;
    $mail->Password   = $SMTP_PASSWORD;
    $mail->SMTPSecure = \PHPMailer\PHPMailer\PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;
    $mail->CharSet    = 'UTF-8';
    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($to_email, $to_name);
    $mail->Subject = $subject;
    if ($template['supports_html']) {
      $mail->isHTML(true);
      $mail->Body    = $body;
      $mail->AltBody = strip_tags($body);
    } else {
      $mail->isHTML(false);
      $mail->Body = strip_tags($body);
    }
    $mail->send();
    $status = 'sent';
  } catch (\PHPMailer\PHPMailer\Exception $e) {
    $errorNote = $e->getMessage();
  }
  $log = $mysqli->prepare('INSERT INTO `emails_sent` (member_id, username, message_key, to_email, status, notes) VALUES (?, ?, ?, ?, ?, ?)');
  if ($log) {
    $logNotes = $status === 'failed' ? $errorNote : null;
    $log->bind_param('isssss', $member_id, $username, $msgKey, $to_email, $status, $logNotes);
    $log->execute();
    $log->close();
  }
}
?>
