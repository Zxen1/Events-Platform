<?php
// process-deletions.php — Runs daily via cron.
//
// ══════════════════════════════════════════════════════════════════
// DISABLED — NOT READY FOR USE
// This script must not run until the full deletion system has been
// tested end-to-end. To enable: remove the block below.
// Before testing: read the entire file header and todo item 26.
// ══════════════════════════════════════════════════════════════════
if (true) {
  if (php_sapi_name() !== 'cli') {
    http_response_code(403);
  }
  exit;
}
//
// Hard-deletes posts and accounts after their 30-day grace period.
//
// ══════════════════════════════════════════════════════════════════
// WARNING: THIS FILE PERFORMS PERMANENT, IRREVERSIBLE DATA DELETION.
// DO NOT MODIFY WITHOUT READING THE FULL ORDER OF OPERATIONS BELOW.
// ══════════════════════════════════════════════════════════════════
//
// POST HARD DELETE (day 30):
//   1. Collect all post_media file URLs for this post (including soft-deleted rows)
//   2. Delete CDN files
//   3. Hard DELETE posts row — cascades automatically wipe:
//      post_map_cards → post_amenities, post_item_pricing, post_sessions,
//      post_ticket_pricing, post_links, post_media, post_revisions,
//      commissions, moderation_log
//   transactions: never touched — financial records retained
//
// ACCOUNT HARD DELETE (day 30):
//   1. Send email 711 (account deleted) — MUST fire BEFORE any data is touched
//   2. Collect all post image URLs + avatar filename
//   3. Delete CDN files (posts images + avatar)
//   4. UPDATE emails_sent: set username = "Deleted Member" — keeps audit trail
//   5. Hard DELETE member_tokens
//   6. Hard DELETE member_settings
//   7. Hard DELETE all posts WHERE member_id = this member — cascades handle children
//   8. Wipe personal columns on members/admins row (TOMBSTONE — see below)
//   transactions: never touched — financial records retained
//
// TOMBSTONE (step 8 above):
//   The members/admins row is NOT hard deleted. Personal columns are wiped.
//   Retained: id, account_email, deleted_at, hidden = 1.
//   Reason: (a) dispute resolution — if a member contacts us after deletion,
//   we can confirm their account existed and when it was deleted.
//   (b) re-registration — the same email address can be used to create a new
//   account. The registration duplicate-email check in add-member.php MUST
//   exclude tombstone rows (WHERE deleted_at IS NULL) for this to work.
//
// CDN DELETION:
//   Uses Bunny Storage API (DELETE method). Credentials from admin_settings:
//   storage_api_key, storage_zone_name. Path extracted from file_url by
//   stripping scheme + host. A CDN delete failure is logged but does not
//   abort the database deletion — data privacy takes priority.

// ─── Bootstrap ───────────────────────────────────────────────────────────────

$configCandidates = [
  __DIR__ . '/../config/config-db.php',
  dirname(__DIR__) . '/config/config-db.php',
  dirname(__DIR__, 2) . '/config/config-db.php',
  dirname(__DIR__, 3) . '/../config/config-db.php',
  dirname(__DIR__) . '/../config/config-auth.php',
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

$docRoot = !empty($_SERVER['DOCUMENT_ROOT'])
  ? rtrim($_SERVER['DOCUMENT_ROOT'], '/\\')
  : dirname(__DIR__, 2);
require_once $docRoot . '/libs/phpmailer/Exception.php';
require_once $docRoot . '/libs/phpmailer/PHPMailer.php';
require_once $docRoot . '/libs/phpmailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// ─── Admin settings ──────────────────────────────────────────────────────────

$settingsStmt = $mysqli->prepare(
  "SELECT setting_key, setting_value FROM admin_settings
   WHERE setting_key IN (
     'support_email','website_name','email_logo','folder_system_images',
     'storage_api_key','storage_zone_name','folder_post_images','folder_avatars'
   )"
);
$settingsStmt->execute();
$siteSettings = [];
$settingsResult = $settingsStmt->get_result();
while ($row = $settingsResult->fetch_assoc()) {
  $siteSettings[$row['setting_key']] = $row['setting_value'];
}
$settingsStmt->close();

foreach (['support_email','website_name','storage_api_key','storage_zone_name'] as $required) {
  if (empty($siteSettings[$required])) {
    throw new RuntimeException('Required admin setting missing: ' . $required);
  }
}

$storageApiKey   = $siteSettings['storage_api_key'];
$storageZoneName = $siteSettings['storage_zone_name'];
$fromEmail       = $siteSettings['support_email'];
$fromName        = $siteSettings['website_name'];
$logoFolder      = rtrim($siteSettings['folder_system_images'] ?? '', '/');
$logoFile        = $siteSettings['email_logo'] ?? '';
$logoUrl         = ($logoFolder && $logoFile) ? $logoFolder . '/' . rawurlencode($logoFile) : '';
$logoHtml        = $logoUrl
  ? '<div style="background:#fff;padding:24px;text-align:center;border-bottom:1px solid #eee;"><img src="' . htmlspecialchars($logoUrl) . '" alt="' . htmlspecialchars($fromName) . '" style="max-height:60px;max-width:100%;"></div>'
  : '';

$smtpConfig = [
  'host'     => $SMTP_HOST,
  'username' => $SMTP_USERNAME,
  'password' => $SMTP_PASSWORD,
];

// ─── Email 711 template ──────────────────────────────────────────────────────

$tplStmt = $mysqli->prepare(
  "SELECT message_name, message_text FROM admin_messages
   WHERE message_key = 'msg_email_account_deleted' AND container_key = 'msg_email' AND is_active = 1 LIMIT 1"
);
$tplStmt->execute();
$accountDeletedTemplate = $tplStmt->get_result()->fetch_assoc();
$tplStmt->close();

if (!$accountDeletedTemplate) {
  throw new RuntimeException('Template msg_email_account_deleted not found or inactive.');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Delete a single file from Bunny CDN.
// $fileUrl: the public CDN URL stored in the database (e.g. https://cdn.funmap.com/post-images/2026-01/file.jpg)
// Returns true on success, false on failure (caller logs the outcome).
function deletionCdnDelete(string $fileUrl, string $storageZoneName, string $storageApiKey): bool {
  if (empty($fileUrl)) return true;
  // Strip scheme + host to get the path (e.g. post-images/2026-01/file.jpg)
  $path    = preg_replace('#^https?://[^/]+/#', '', $fileUrl);
  $apiUrl  = 'https://storage.bunnycdn.com/' . $storageZoneName . '/' . $path;
  $ch      = curl_init($apiUrl);
  curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST  => 'DELETE',
    CURLOPT_HTTPHEADER     => ['AccessKey: ' . $storageApiKey],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
  ]);
  curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  // 200 = deleted, 404 = already gone — both are acceptable
  return $httpCode === 200 || $httpCode === 404;
}

// Send email 711 (account deleted) to the member before data is wiped.
function deletionSendAccountDeletedEmail(
  mysqli $db,
  int    $memberId,
  string $memberRole,
  string $username,
  string $toEmail,
  array  $template,
  string $fromEmail,
  string $fromName,
  string $logoHtml,
  array  $smtpConfig
): void {
  $displayName = $username ?: 'there';
  $body        = str_replace(
    ['{logo}', '{name}'],
    [$logoHtml, htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8')],
    $template['message_text']
  );
  $subject = $template['message_name'];

  $mail   = new PHPMailer(true);
  $status = 'failed';
  try {
    $mail->isSMTP();
    $mail->Host       = $smtpConfig['host'];
    $mail->SMTPAuth   = true;
    $mail->Username   = $smtpConfig['username'];
    $mail->Password   = $smtpConfig['password'];
    $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
    $mail->Port       = 465;
    $mail->CharSet    = 'UTF-8';
    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($toEmail, $displayName);
    $mail->Subject = $subject;
    $mail->isHTML(true);
    $mail->Body    = $body;
    $mail->AltBody = strip_tags($body);
    $mail->send();
    $status = 'sent';
  } catch (Exception $e) {
    // Log and continue — deletion proceeds regardless
  }

  $msgKey  = 'msg_email_account_deleted';
  $logStmt = $db->prepare(
    'INSERT INTO emails_sent (member_id, member_role, username, message_key, to_email, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  if ($logStmt) {
    $logStmt->bind_param('isssss', $memberId, $memberRole, $username, $msgKey, $toEmail, $status);
    $logStmt->execute();
    $logStmt->close();
  }
}

// ─── Post hard delete ─────────────────────────────────────────────────────────
// Find posts where visibility = 'deleted' and deleted_at >= 30 days ago.

$postStmt = $mysqli->prepare(
  "SELECT id FROM posts
   WHERE visibility = 'deleted'
     AND deleted_at IS NOT NULL
     AND deleted_at <= DATE_SUB(NOW(), INTERVAL 30 DAY)"
);
$postStmt->execute();
$postsToDelete = $postStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$postStmt->close();

foreach ($postsToDelete as $post) {
  $postId = (int)$post['id'];

  // Step 1: Collect all CDN file URLs for this post (including soft-deleted rows)
  $mediaStmt = $mysqli->prepare(
    'SELECT file_url FROM post_media WHERE post_id = ?'
  );
  $mediaStmt->bind_param('i', $postId);
  $mediaStmt->execute();
  $mediaRows = $mediaStmt->get_result()->fetch_all(MYSQLI_ASSOC);
  $mediaStmt->close();

  // Step 2: Delete CDN files
  foreach ($mediaRows as $media) {
    deletionCdnDelete($media['file_url'], $storageZoneName, $storageApiKey);
  }

  // Step 3: Hard DELETE the post row — cascades handle all child tables
  $delStmt = $mysqli->prepare('DELETE FROM posts WHERE id = ?');
  $delStmt->bind_param('i', $postId);
  $delStmt->execute();
  $delStmt->close();
}

// ─── Account hard delete ──────────────────────────────────────────────────────
// Process both members and admins tables identically.

foreach (['members', 'admins'] as $table) {
  $memberRole = ($table === 'admins') ? 'admin' : 'member';

  $acctStmt = $mysqli->prepare(
    "SELECT id, account_email, username, avatar_file
     FROM `{$table}`
     WHERE deleted_at IS NOT NULL
       AND deleted_at <= DATE_SUB(NOW(), INTERVAL 30 DAY)
       AND hidden = 1"
  );
  $acctStmt->execute();
  $accounts = $acctStmt->get_result()->fetch_all(MYSQLI_ASSOC);
  $acctStmt->close();

  foreach ($accounts as $account) {
    $memberId    = (int)$account['id'];
    $accountEmail = $account['account_email'];
    $username    = $account['username'] ?? '';
    $avatarFile  = $account['avatar_file'] ?? '';

    // Step 1: Send email 711 BEFORE touching any data
    deletionSendAccountDeletedEmail(
      $mysqli, $memberId, $memberRole, $username, $accountEmail,
      $accountDeletedTemplate, $fromEmail, $fromName, $logoHtml, $smtpConfig
    );

    // Step 2+3: Collect and delete all post image CDN files for this member
    $allMediaStmt = $mysqli->prepare(
      'SELECT pm.file_url FROM post_media pm
       INNER JOIN posts p ON p.id = pm.post_id
       WHERE p.member_id = ? AND p.member_role = ?'
    );
    $allMediaStmt->bind_param('is', $memberId, $memberRole);
    $allMediaStmt->execute();
    $allMediaRows = $allMediaStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $allMediaStmt->close();

    foreach ($allMediaRows as $media) {
      deletionCdnDelete($media['file_url'], $storageZoneName, $storageApiKey);
    }

    // Step 3b: Delete avatar from CDN
    if (!empty($avatarFile)) {
      $avatarFolder = rtrim($siteSettings['folder_avatars'] ?? '', '/');
      if ($avatarFolder) {
        $avatarUrl = $avatarFolder . '/' . $avatarFile;
        deletionCdnDelete($avatarUrl, $storageZoneName, $storageApiKey);
      }
    }

    // Step 4: Update emails_sent — replace username with "Deleted Member"
    $emailsStmt = $mysqli->prepare(
      "UPDATE emails_sent SET username = 'Deleted Member' WHERE member_id = ?"
    );
    $emailsStmt->bind_param('i', $memberId);
    $emailsStmt->execute();
    $emailsStmt->close();

    // Step 5: Hard DELETE member_tokens
    $tokensStmt = $mysqli->prepare('DELETE FROM member_tokens WHERE member_id = ?');
    $tokensStmt->bind_param('i', $memberId);
    $tokensStmt->execute();
    $tokensStmt->close();

    // Step 6: Hard DELETE member_settings
    $settStmt = $mysqli->prepare('DELETE FROM member_settings WHERE member_id = ?');
    $settStmt->bind_param('i', $memberId);
    $settStmt->execute();
    $settStmt->close();

    // Step 7: Hard DELETE all posts for this member — cascades wipe all child tables
    $postsStmt = $mysqli->prepare(
      "DELETE FROM posts WHERE member_id = ? AND member_role = ?"
    );
    $postsStmt->bind_param('is', $memberId, $memberRole);
    $postsStmt->execute();
    $postsStmt->close();

    // Step 8: TOMBSTONE — wipe personal columns, keep id + account_email + deleted_at + hidden
    // Do NOT hard DELETE this row. See file header for explanation.
    $wipeStmt = $mysqli->prepare(
      "UPDATE `{$table}` SET
         username             = NULL,
         username_key         = NULL,
         password_hash        = 'DELETED',
         avatar_file          = NULL,
         map_lighting         = 'day',
         map_style            = 'standard',
         animation_preference = 'full',
         favorites            = NULL,
         recent               = NULL,
         country              = NULL,
         preferred_currency   = NULL,
         backup_json          = NULL,
         filters_json         = NULL,
         filters_hash         = NULL,
         filters_version      = 1,
         filters_updated_at   = NULL,
         reminder_emails      = 0,
         last_login_at        = NULL
       WHERE id = ?"
    );
    $wipeStmt->bind_param('i', $memberId);
    $wipeStmt->execute();
    $wipeStmt->close();
  }
}
