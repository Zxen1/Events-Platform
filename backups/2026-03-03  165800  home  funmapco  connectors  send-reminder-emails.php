<?php
// Runs daily via cron. Sends the weekly reminder report to members and admins.

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

$docRoot = !empty($_SERVER['DOCUMENT_ROOT'])
  ? rtrim($_SERVER['DOCUMENT_ROOT'], '/\\')
  : dirname(__DIR__, 2);
require_once $docRoot . '/libs/phpmailer/Exception.php';
require_once $docRoot . '/libs/phpmailer/PHPMailer.php';
require_once $docRoot . '/libs/phpmailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

// Admin settings
$settingsStmt = $mysqli->prepare(
  "SELECT setting_key, setting_value FROM admin_settings
   WHERE setting_key IN ('support_email','website_name','email_logo','folder_system_images','website_url')"
);
$settingsStmt->execute();
$siteSettings = [];
$settingsResult = $settingsStmt->get_result();
while ($row = $settingsResult->fetch_assoc()) {
  $siteSettings[$row['setting_key']] = $row['setting_value'];
}
$settingsStmt->close();

foreach (['support_email', 'website_name', 'website_url'] as $required) {
  if (empty($siteSettings[$required])) {
    throw new RuntimeException('Required admin setting missing: ' . $required);
  }
}

$fromEmail   = $siteSettings['support_email'];
$fromName    = $siteSettings['website_name'];
$websiteBase = rtrim($siteSettings['website_url'], '/');
$logoFolder  = rtrim($siteSettings['folder_system_images'] ?? '', '/');
$logoFile    = $siteSettings['email_logo'] ?? '';
$logoUrl     = ($logoFolder && $logoFile) ? $logoFolder . '/' . rawurlencode($logoFile) : '';
$logoHtml    = $logoUrl
  ? '<div style="background:#fff;padding:24px;text-align:center;border-bottom:1px solid #eee;"><img src="' . htmlspecialchars($logoUrl) . '" alt="' . htmlspecialchars($fromName) . '" style="max-height:60px;max-width:100%;"></div>'
  : '';

// Template
$tplStmt = $mysqli->prepare(
  "SELECT message_name, message_text FROM admin_messages
   WHERE message_key = 'msg_email_reminder_report' AND container_key = 'msg_email' AND is_active = 1 LIMIT 1"
);
$tplStmt->execute();
$template = $tplStmt->get_result()->fetch_assoc();
$tplStmt->close();

if (!$template) throw new RuntimeException('Template msg_email_reminder_report not found or inactive.');

$smtpConfig = [
  'host'     => $SMTP_HOST,
  'username' => $SMTP_USERNAME,
  'password' => $SMTP_PASSWORD,
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function reminderFmtDate(string $datetime): string {
  return date('j M Y', strtotime($datetime));
}

function reminderBuildReport(array $needsAttention, array $recentlyExpired): string {
  $total    = count($needsAttention) + count($recentlyExpired);
  $overflow = max(0, $total - 10);
  $html     = '';

  if ($needsAttention) {
    $shown = array_slice($needsAttention, 0, 10);
    $html .= '<p style="font-size:13px;font-weight:bold;color:#333;margin:0 0 10px;">Needs attention:</p>';
    foreach ($shown as $i => $p) {
      $isLast = ($i === count($shown) - 1) && empty($recentlyExpired);
      $gap    = $isLast ? '0' : '12px';
      $html  .= '<div style="margin:0 0 ' . $gap . ';">'
              . '<p style="font-size:14px;color:#333;margin:0 0 2px;">' . htmlspecialchars($p['status_line']) . ' · ' . htmlspecialchars(reminderFmtDate($p['date'])) . '</p>'
              . '<p style="font-size:13px;color:#888;margin:0;">' . htmlspecialchars($p['title']) . '</p>'
              . '</div>';
    }
  }

  $remainingSlots = 10 - count($needsAttention);
  if ($recentlyExpired && $remainingSlots > 0) {
    $shown = array_slice($recentlyExpired, 0, $remainingSlots);
    $html .= '<p style="font-size:13px;font-weight:bold;color:#333;margin:' . ($needsAttention ? '24px' : '0') . ' 0 10px;">Recently expired:</p>';
    foreach ($shown as $i => $p) {
      $gap   = ($i < count($shown) - 1) ? '12px' : '0';
      $html .= '<div style="margin:0 0 ' . $gap . ';">'
             . '<p style="font-size:14px;color:#aaa;margin:0 0 2px;">' . htmlspecialchars($p['status_line']) . ' · ' . htmlspecialchars(reminderFmtDate($p['date'])) . '</p>'
             . '<p style="font-size:13px;color:#bbb;margin:0;">' . htmlspecialchars($p['title']) . '</p>'
             . '</div>';
    }
  }

  if ($overflow > 0) {
    $html .= '<p style="font-size:12px;color:#aaa;margin:12px 0 0;">+ ' . $overflow . ' more</p>';
  }

  return $html;
}

function reminderBuildSummary(mysqli $db, int $memberId, string $memberRole): string {
  $stmt = $db->prepare(
    "SELECT
       SUM(visibility = 'active')  AS live,
       SUM(visibility = 'expired') AS expired_count
     FROM posts WHERE member_id = ? AND member_role = ?"
  );
  $stmt->bind_param('is', $memberId, $memberRole);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  $parts = [];
  if ((int)$row['live'] > 0)          $parts[] = $row['live'] . ' live';
  if ((int)$row['expired_count'] > 0) $parts[] = $row['expired_count'] . ' expired';
  return 'Your account: ' . (count($parts) ? implode(' · ', $parts) : 'no active listings');
}

function reminderGetSubject(array $needsAttention, array $recentlyExpired): string {
  foreach ($needsAttention as $p) {
    if ($p['type'] === 'deletion_warning') {
      return 'Your FunMap listing will be permanently deleted soon';
    }
  }
  foreach ($needsAttention as $p) {
    if ($p['type'] === 'expiring') {
      $days = (int)$p['days_remaining'];
      return 'Your FunMap listing expires in ' . $days . ' ' . ($days === 1 ? 'day' : 'days');
    }
  }
  foreach ($recentlyExpired as $p) {
    if ($p['type'] === 'deleted') return 'Your FunMap listing has been permanently deleted';
  }
  foreach ($recentlyExpired as $p) {
    if ($p['type'] === 'expired') return 'Your FunMap listing has expired';
  }
  return 'Your FunMap listing report';
}

// ─── Per-account report ──────────────────────────────────────────────────────

function reminderSendReport(
  mysqli $db,
  int    $memberId,
  string $memberRole,
  string $accountEmail,
  string $username,
  array  $template,
  string $fromEmail,
  string $fromName,
  string $websiteBase,
  string $logoHtml,
  array  $smtpConfig
): void {

  // 7-day cooldown
  $coolStmt = $db->prepare(
    "SELECT MAX(created_at) AS last_sent FROM emails_sent
     WHERE member_id = ? AND message_key = 'msg_email_reminder_report' AND status = 'sent'"
  );
  $coolStmt->bind_param('i', $memberId);
  $coolStmt->execute();
  $coolRow = $coolStmt->get_result()->fetch_assoc();
  $coolStmt->close();
  if (!empty($coolRow['last_sent']) && strtotime($coolRow['last_sent']) > strtotime('-7 days')) return;

  // Trigger check — one of 4 events must have occurred today
  $trigStmt = $db->prepare(
    "SELECT COUNT(*) AS cnt FROM posts
     WHERE member_id = ? AND member_role = ? AND (
       (visibility = 'active'  AND DATE(expires_at) = CURDATE())
       OR (visibility = 'active'  AND DATE(expires_at) = DATE(DATE_ADD(NOW(), INTERVAL 7 DAY)))
       OR (visibility = 'expired' AND DATE(expires_at) = DATE(DATE_SUB(NOW(), INTERVAL 23 DAY)))
       OR (visibility = 'deleted' AND DATE(deleted_at) = CURDATE())
     )"
  );
  $trigStmt->bind_param('is', $memberId, $memberRole);
  $trigStmt->execute();
  $trigRow = $trigStmt->get_result()->fetch_assoc();
  $trigStmt->close();
  if ((int)$trigRow['cnt'] === 0) return;

  // Needs attention: active posts expiring within 14 days
  $expStmt = $db->prepare(
    "SELECT p.id, p.expires_at,
            (SELECT pmc.title FROM post_map_cards pmc WHERE pmc.post_id = p.id ORDER BY pmc.id ASC LIMIT 1) AS title
     FROM posts p
     WHERE p.member_id = ? AND p.member_role = ? AND p.visibility = 'active'
       AND p.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 14 DAY)
     ORDER BY p.expires_at ASC"
  );
  $expStmt->bind_param('is', $memberId, $memberRole);
  $expStmt->execute();
  $expRows = $expStmt->get_result()->fetch_all(MYSQLI_ASSOC);
  $expStmt->close();

  $needsAttention = [];
  foreach ($expRows as $row) {
    $daysRemaining  = max(0, (int)ceil((strtotime($row['expires_at']) - time()) / 86400));
    $needsAttention[] = [
      'type'          => 'expiring',
      'date'          => $row['expires_at'],
      'days_remaining'=> $daysRemaining,
      'title'         => $row['title'] ?? '',
      'status_line'   => 'Expires in ' . $daysRemaining . ' ' . ($daysRemaining === 1 ? 'day' : 'days'),
    ];
  }

  // Needs attention: expired posts within 14 days of permanent deletion (expired 16–30 days ago)
  $delWarnStmt = $db->prepare(
    "SELECT p.id, p.expires_at,
            (SELECT pmc.title FROM post_map_cards pmc WHERE pmc.post_id = p.id ORDER BY pmc.id ASC LIMIT 1) AS title
     FROM posts p
     WHERE p.member_id = ? AND p.member_role = ? AND p.visibility = 'expired'
       AND p.expires_at BETWEEN DATE_SUB(NOW(), INTERVAL 30 DAY) AND DATE_SUB(NOW(), INTERVAL 16 DAY)
     ORDER BY p.expires_at ASC"
  );
  $delWarnStmt->bind_param('is', $memberId, $memberRole);
  $delWarnStmt->execute();
  $delWarnRows = $delWarnStmt->get_result()->fetch_all(MYSQLI_ASSOC);
  $delWarnStmt->close();

  $delWarnIds = [];
  foreach ($delWarnRows as $row) {
    $delWarnIds[]   = $row['id'];
    $deletionTs     = strtotime($row['expires_at']) + (30 * 86400);
    $daysUntilDel   = max(0, (int)ceil(($deletionTs - time()) / 86400));
    $needsAttention[] = [
      'type'        => 'deletion_warning',
      'date'        => date('Y-m-d H:i:s', $deletionTs),
      'title'       => $row['title'] ?? '',
      'status_line' => 'Scheduled for deletion in ' . $daysUntilDel . ' ' . ($daysUntilDel === 1 ? 'day' : 'days'),
    ];
  }

  usort($needsAttention, fn($a, $b) => strtotime($a['date']) <=> strtotime($b['date']));

  // Recently expired/deleted within 30 days
  $recentStmt = $db->prepare(
    "SELECT p.id, p.visibility, p.expires_at, p.deleted_at,
            (SELECT pmc.title FROM post_map_cards pmc WHERE pmc.post_id = p.id ORDER BY pmc.id ASC LIMIT 1) AS title
     FROM posts p
     WHERE p.member_id = ? AND p.member_role = ? AND (
       (p.visibility = 'expired' AND p.expires_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND p.expires_at < NOW())
       OR
       (p.visibility = 'deleted' AND p.deleted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))
     )
     ORDER BY COALESCE(p.deleted_at, p.expires_at) DESC"
  );
  $recentStmt->bind_param('is', $memberId, $memberRole);
  $recentStmt->execute();
  $recentRows = $recentStmt->get_result()->fetch_all(MYSQLI_ASSOC);
  $recentStmt->close();

  $recentlyExpired = [];
  foreach ($recentRows as $row) {
    if (in_array($row['id'], $delWarnIds)) continue;
    if ($row['visibility'] === 'deleted') {
      $recentlyExpired[] = [
        'type'        => 'deleted',
        'date'        => $row['deleted_at'],
        'title'       => $row['title'] ?? '',
        'status_line' => 'Permanently deleted',
      ];
    } else {
      $recentlyExpired[] = [
        'type'        => 'expired',
        'date'        => $row['expires_at'],
        'title'       => $row['title'] ?? '',
        'status_line' => 'Expired',
      ];
    }
  }

  if (empty($needsAttention) && empty($recentlyExpired)) return;

  $reportHtml  = reminderBuildReport($needsAttention, $recentlyExpired);
  $summaryLine = reminderBuildSummary($db, $memberId, $memberRole);
  $subject     = reminderGetSubject($needsAttention, $recentlyExpired);
  $displayName = $username ?: 'there';
  $unsubUrl    = $websiteBase . '/unsubscribed.html?id=' . $memberId . '&email=' . rawurlencode($accountEmail);

  $body = $template['message_text'];
  $body = str_replace('{logo}',             $logoHtml,                                                    $body);
  $body = str_replace('{reminder_report}',   $reportHtml,                                                  $body);
  $body = str_replace('{name}',             htmlspecialchars($displayName,  ENT_QUOTES, 'UTF-8'),         $body);
  $body = str_replace('{trigger_subject}',  htmlspecialchars($subject,      ENT_QUOTES, 'UTF-8'),         $body);
  $body = str_replace('{summary}',          htmlspecialchars($summaryLine,  ENT_QUOTES, 'UTF-8'),         $body);
  $body = str_replace('{unsubscribe_link}', htmlspecialchars($unsubUrl,     ENT_QUOTES, 'UTF-8'),         $body);

  // Pluralization: {variable|singular|plural}
  $reminderPlaceholders = ['name' => $displayName, 'trigger_subject' => $subject, 'summary' => $summaryLine];
  $body = preg_replace_callback('/\{(\w+)\|([^|}]+)\|([^|}]+)\}/', function($m) use ($reminderPlaceholders) {
    if (!isset($reminderPlaceholders[$m[1]])) return $m[0];
    return (int)$reminderPlaceholders[$m[1]] === 1 ? $m[2] : $m[3];
  }, $body);

  $emailSubject = str_replace('{trigger_subject}', htmlspecialchars($subject, ENT_QUOTES, 'UTF-8'), $template['message_name']);

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
    $mail->addAddress($accountEmail, $displayName);
    $mail->Subject = $emailSubject;
    $mail->isHTML(true);
    $mail->Body    = $body;
    $mail->AltBody = strip_tags($body);
    $mail->send();
    $status = 'sent';
  } catch (Exception $e) {
    $status = 'failed';
  }

  $messageKey = 'msg_email_reminder_report';
  $logStmt    = $db->prepare(
    'INSERT INTO emails_sent (member_id, member_role, username, message_key, to_email, status) VALUES (?, ?, ?, ?, ?, ?)'
  );
  if ($logStmt) {
    $logStmt->bind_param('isssss', $memberId, $memberRole, $username, $messageKey, $accountEmail, $status);
    $logStmt->execute();
    $logStmt->close();
  }
}

// ─── Main loops ──────────────────────────────────────────────────────────────

$mStmt = $mysqli->prepare(
  "SELECT id, account_email, username FROM members WHERE reminder_emails = 1 AND deleted_at IS NULL"
);
$mStmt->execute();
$membersList = $mStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$mStmt->close();

foreach ($membersList as $m) {
  reminderSendReport(
    $mysqli, (int)$m['id'], 'member',
    $m['account_email'], $m['username'] ?? '',
    $template, $fromEmail, $fromName, $websiteBase, $logoHtml, $smtpConfig
  );
}

$aStmt = $mysqli->prepare(
  "SELECT id, account_email, username FROM admins WHERE reminder_emails = 1 AND deleted_at IS NULL"
);
$aStmt->execute();
$adminsList = $aStmt->get_result()->fetch_all(MYSQLI_ASSOC);
$aStmt->close();

foreach ($adminsList as $a) {
  reminderSendReport(
    $mysqli, (int)$a['id'], 'admin',
    $a['account_email'], $a['username'] ?? '',
    $template, $fromEmail, $fromName, $websiteBase, $logoHtml, $smtpConfig
  );
}
