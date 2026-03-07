<?php
// cron.php
// Single scheduled entrypoint for all required email/deletion jobs.
//
// Usage (cPanel cron command):
// /usr/local/bin/php -q /home/funmapco/public_html/home/funmapco/connectors/cron.php

if (php_sapi_name() !== 'cli') {
  http_response_code(403);
  exit;
}

define('FUNMAP_SEND_EMAIL_LIBRARY_ONLY', true);
require_once __DIR__ . '/send-email.php';

[$mysqli, $smtpConfig, $siteSettings] = funmapEmailBootstrap();

if (empty($siteSettings['website_url'])) {
  throw new RuntimeException('Required admin setting missing: website_url');
}

$websiteBase = rtrim($siteSettings['website_url'], '/');
$runDeletionProcess711 = false; // SAFETY GUARD: change to true only when explicitly approved.

function cronSendEmail(
  mysqli $db,
  array $smtpConfig,
  array $siteSettings,
  string $messageKey,
  int $memberId,
  string $memberRole,
  string $username,
  string $toEmail,
  array $placeholders = []
): bool {
  $result = funmapSendEmailWithContext($db, $smtpConfig, $siteSettings, [
    'message_key' => $messageKey,
    'member_id' => $memberId,
    'member_role' => $memberRole,
    'username' => $username,
    'to_email' => $toEmail,
    'to_name' => $username,
    'placeholders' => $placeholders,
  ]);
  return (bool)($result['success'] ?? false);
}

function cronEmailAlreadySentAfter(
  mysqli $db,
  int $memberId,
  string $memberRole,
  string $messageKey,
  string $sinceDateTime
): bool {
  $stmt = $db->prepare(
    "SELECT id FROM emails_sent
     WHERE member_id = ? AND member_role = ? AND message_key = ? AND status = 'sent' AND created_at >= ?
     ORDER BY id DESC
     LIMIT 1"
  );
  if (!$stmt) {
    return false;
  }
  $stmt->bind_param('isss', $memberId, $memberRole, $messageKey, $sinceDateTime);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();
  return !empty($row);
}

function cronFmtDate(string $datetime): string {
  return date('j M Y', strtotime($datetime));
}

function cronBuildReminderReport(array $needsAttention, array $recentlyExpired): string {
  $total = count($needsAttention) + count($recentlyExpired);
  $overflow = max(0, $total - 10);
  $html = '';

  if ($needsAttention) {
    $shown = array_slice($needsAttention, 0, 10);
    $html .= '<p style="font-size:13px;font-weight:bold;color:#333;margin:0 0 10px;">Needs attention:</p>';
    foreach ($shown as $i => $p) {
      $isLast = ($i === count($shown) - 1) && empty($recentlyExpired);
      $gap = $isLast ? '0' : '12px';
      $html .= '<div style="margin:0 0 ' . $gap . ';">'
        . '<p style="font-size:14px;color:#333;margin:0 0 2px;">' . htmlspecialchars($p['status_line']) . ' · ' . htmlspecialchars(cronFmtDate($p['date'])) . '</p>'
        . '<p style="font-size:13px;color:#888;margin:0;">' . htmlspecialchars($p['title']) . '</p>'
        . '</div>';
    }
  }

  $remainingSlots = 10 - count($needsAttention);
  if ($recentlyExpired && $remainingSlots > 0) {
    $shown = array_slice($recentlyExpired, 0, $remainingSlots);
    $html .= '<p style="font-size:13px;font-weight:bold;color:#333;margin:' . ($needsAttention ? '24px' : '0') . ' 0 10px;">Recently expired:</p>';
    foreach ($shown as $i => $p) {
      $gap = ($i < count($shown) - 1) ? '12px' : '0';
      $html .= '<div style="margin:0 0 ' . $gap . ';">'
        . '<p style="font-size:14px;color:#aaa;margin:0 0 2px;">' . htmlspecialchars($p['status_line']) . ' · ' . htmlspecialchars(cronFmtDate($p['date'])) . '</p>'
        . '<p style="font-size:13px;color:#bbb;margin:0;">' . htmlspecialchars($p['title']) . '</p>'
        . '</div>';
    }
  }

  if ($overflow > 0) {
    $html .= '<p style="font-size:12px;color:#aaa;margin:12px 0 0;">+ ' . $overflow . ' more</p>';
  }

  return $html;
}

function cronBuildReminderSummary(mysqli $db, int $memberId, string $memberRole): string {
  $stmt = $db->prepare(
    "SELECT
       SUM(visibility = 'active') AS live,
       SUM(visibility = 'expired') AS expired_count
     FROM posts
     WHERE member_id = ? AND member_role = ?"
  );
  $stmt->bind_param('is', $memberId, $memberRole);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  $parts = [];
  if ((int)$row['live'] > 0) {
    $parts[] = $row['live'] . ' live';
  }
  if ((int)$row['expired_count'] > 0) {
    $parts[] = $row['expired_count'] . ' expired';
  }
  return 'Your account: ' . (count($parts) ? implode(' · ', $parts) : 'no active listings');
}

function cronGetReminderSubject(array $needsAttention, array $recentlyExpired): string {
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
    if ($p['type'] === 'deleted') {
      return 'Your FunMap listing has been permanently deleted';
    }
  }
  foreach ($recentlyExpired as $p) {
    if ($p['type'] === 'expired') {
      return 'Your FunMap listing has expired';
    }
  }
  return 'Your FunMap listing report';
}

function cronRunReminder716(
  mysqli $db,
  array $smtpConfig,
  array $siteSettings,
  string $websiteBase
): void {
  $runForTable = function(string $table, string $role) use ($db, $smtpConfig, $siteSettings, $websiteBase): void {
    $acctStmt = $db->prepare(
      "SELECT id, account_email, username
       FROM `{$table}`
       WHERE reminder_emails = 1 AND deleted_at IS NULL"
    );
    $acctStmt->execute();
    $accounts = $acctStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $acctStmt->close();

    foreach ($accounts as $account) {
      $memberId = (int)$account['id'];
      $email = (string)$account['account_email'];
      $username = (string)($account['username'] ?? '');

      $coolStmt = $db->prepare(
        "SELECT MAX(created_at) AS last_sent
         FROM emails_sent
         WHERE member_id = ? AND member_role = ? AND message_key = 'msg_email_reminder_report' AND status = 'sent'"
      );
      $coolStmt->bind_param('is', $memberId, $role);
      $coolStmt->execute();
      $coolRow = $coolStmt->get_result()->fetch_assoc();
      $coolStmt->close();
      if (!empty($coolRow['last_sent']) && strtotime($coolRow['last_sent']) > strtotime('-7 days')) {
        continue;
      }

      $trigStmt = $db->prepare(
        "SELECT COUNT(*) AS cnt
         FROM posts
         WHERE member_id = ? AND member_role = ? AND (
           (visibility = 'active' AND DATE(expires_at) = CURDATE())
           OR (visibility = 'active' AND DATE(expires_at) = DATE(DATE_ADD(NOW(), INTERVAL 7 DAY)))
           OR (visibility = 'expired' AND DATE(expires_at) = DATE(DATE_SUB(NOW(), INTERVAL 23 DAY)))
           OR (visibility = 'deleted' AND DATE(deleted_at) = CURDATE())
         )"
      );
      $trigStmt->bind_param('is', $memberId, $role);
      $trigStmt->execute();
      $trigRow = $trigStmt->get_result()->fetch_assoc();
      $trigStmt->close();
      if ((int)$trigRow['cnt'] === 0) {
        continue;
      }

      $expStmt = $db->prepare(
        "SELECT p.id, p.expires_at,
                (SELECT pmc.title FROM post_map_cards pmc WHERE pmc.post_id = p.id ORDER BY pmc.id ASC LIMIT 1) AS title
         FROM posts p
         WHERE p.member_id = ? AND p.member_role = ? AND p.visibility = 'active'
           AND p.expires_at BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 14 DAY)
         ORDER BY p.expires_at ASC"
      );
      $expStmt->bind_param('is', $memberId, $role);
      $expStmt->execute();
      $expRows = $expStmt->get_result()->fetch_all(MYSQLI_ASSOC);
      $expStmt->close();

      $needsAttention = [];
      foreach ($expRows as $row) {
        $daysRemaining = max(0, (int)ceil((strtotime($row['expires_at']) - time()) / 86400));
        $needsAttention[] = [
          'type' => 'expiring',
          'date' => $row['expires_at'],
          'days_remaining' => $daysRemaining,
          'title' => $row['title'] ?? '',
          'status_line' => 'Expires in ' . $daysRemaining . ' ' . ($daysRemaining === 1 ? 'day' : 'days'),
        ];
      }

      $warnStmt = $db->prepare(
        "SELECT p.id, p.expires_at,
                (SELECT pmc.title FROM post_map_cards pmc WHERE pmc.post_id = p.id ORDER BY pmc.id ASC LIMIT 1) AS title
         FROM posts p
         WHERE p.member_id = ? AND p.member_role = ? AND p.visibility = 'expired'
           AND p.expires_at BETWEEN DATE_SUB(NOW(), INTERVAL 30 DAY) AND DATE_SUB(NOW(), INTERVAL 16 DAY)
         ORDER BY p.expires_at ASC"
      );
      $warnStmt->bind_param('is', $memberId, $role);
      $warnStmt->execute();
      $warnRows = $warnStmt->get_result()->fetch_all(MYSQLI_ASSOC);
      $warnStmt->close();

      $warnIds = [];
      foreach ($warnRows as $row) {
        $warnIds[] = (int)$row['id'];
        $deletionTs = strtotime($row['expires_at']) + (30 * 86400);
        $daysUntilDel = max(0, (int)ceil(($deletionTs - time()) / 86400));
        $needsAttention[] = [
          'type' => 'deletion_warning',
          'date' => date('Y-m-d H:i:s', $deletionTs),
          'title' => $row['title'] ?? '',
          'status_line' => 'Scheduled for deletion in ' . $daysUntilDel . ' ' . ($daysUntilDel === 1 ? 'day' : 'days'),
        ];
      }
      usort($needsAttention, fn($a, $b) => strtotime($a['date']) <=> strtotime($b['date']));

      $recentStmt = $db->prepare(
        "SELECT p.id, p.visibility, p.expires_at, p.deleted_at,
                (SELECT pmc.title FROM post_map_cards pmc WHERE pmc.post_id = p.id ORDER BY pmc.id ASC LIMIT 1) AS title
         FROM posts p
         WHERE p.member_id = ? AND p.member_role = ? AND (
           (p.visibility = 'expired' AND p.expires_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) AND p.expires_at < NOW())
           OR (p.visibility = 'deleted' AND p.deleted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY))
         )
         ORDER BY COALESCE(p.deleted_at, p.expires_at) DESC"
      );
      $recentStmt->bind_param('is', $memberId, $role);
      $recentStmt->execute();
      $recentRows = $recentStmt->get_result()->fetch_all(MYSQLI_ASSOC);
      $recentStmt->close();

      $recentlyExpired = [];
      foreach ($recentRows as $row) {
        if (in_array((int)$row['id'], $warnIds, true)) {
          continue;
        }
        if ($row['visibility'] === 'deleted') {
          $recentlyExpired[] = [
            'type' => 'deleted',
            'date' => $row['deleted_at'],
            'title' => $row['title'] ?? '',
            'status_line' => 'Permanently deleted',
          ];
        } else {
          $recentlyExpired[] = [
            'type' => 'expired',
            'date' => $row['expires_at'],
            'title' => $row['title'] ?? '',
            'status_line' => 'Expired',
          ];
        }
      }

      if (empty($needsAttention) && empty($recentlyExpired)) {
        continue;
      }

      $reportHtml = cronBuildReminderReport($needsAttention, $recentlyExpired);
      $summaryLine = cronBuildReminderSummary($db, $memberId, $role);
      $subject = cronGetReminderSubject($needsAttention, $recentlyExpired);
      $displayName = $username !== '' ? $username : 'there';
      $unsubUrl = $websiteBase . '/unsubscribed.html?id=' . $memberId . '&email=' . rawurlencode($email);

      cronSendEmail(
        $db,
        $smtpConfig,
        $siteSettings,
        'msg_email_reminder_report',
        $memberId,
        $role,
        $username,
        $email,
        [
          'name' => $displayName,
          'trigger_subject' => $subject,
          'summary' => $summaryLine,
          'reminder_report' => $reportHtml,
          'unsubscribe_link' => $unsubUrl,
        ]
      );
    }
  };

  $runForTable('members', 'member');
  $runForTable('admins', 'admin');
}

function cronRunAccountDeletionWarning710(
  mysqli $db,
  array $smtpConfig,
  array $siteSettings
): void {
  foreach (['members' => 'member', 'admins' => 'admin'] as $table => $role) {
    $stmt = $db->prepare(
      "SELECT id, account_email, username, deleted_at
       FROM `{$table}`
       WHERE deleted_at IS NOT NULL
         AND password_hash <> 'DELETED'
         AND deleted_at >= DATE_SUB(NOW(), INTERVAL 24 DAY)
         AND deleted_at < DATE_SUB(NOW(), INTERVAL 23 DAY)"
    );
    $stmt->execute();
    $accounts = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    foreach ($accounts as $account) {
      $memberId = (int)$account['id'];
      $email = (string)$account['account_email'];
      $username = (string)($account['username'] ?? '');
      $deletedAt = (string)$account['deleted_at'];

      if (cronEmailAlreadySentAfter($db, $memberId, $role, 'msg_email_account_deletion_warning', $deletedAt)) {
        continue;
      }

      $deletionDate = date('j F Y', strtotime($deletedAt . ' +30 days'));

      cronSendEmail(
        $db,
        $smtpConfig,
        $siteSettings,
        'msg_email_account_deletion_warning',
        $memberId,
        $role,
        $username,
        $email,
        [
          'name' => $username !== '' ? $username : 'there',
          'date' => $deletionDate,
        ]
      );
    }
  }
}

function cronGetInactivityCandidates(mysqli $db, string $table, string $role): array {
  $stmt = $db->prepare(
    "SELECT
       a.id,
       a.account_email,
       a.username,
       a.deleted_at,
       a.hidden,
       a.reminder_emails,
       GREATEST(
         COALESCE(a.last_login_at, '1970-01-01 00:00:00'),
         COALESCE((SELECT MAX(p.created_at) FROM posts p WHERE p.member_id = a.id AND p.member_role = ?), '1970-01-01 00:00:00'),
         COALESCE((SELECT MAX(t.created_at) FROM transactions t WHERE t.member_id = a.id AND t.member_role = ?), '1970-01-01 00:00:00'),
         COALESCE((SELECT MAX(p2.expires_at) FROM posts p2 WHERE p2.member_id = a.id AND p2.member_role = ?), '1970-01-01 00:00:00'),
         COALESCE(a.created_at, '1970-01-01 00:00:00')
       ) AS last_activity
     FROM `{$table}` a
     WHERE a.password_hash <> 'DELETED'"
  );
  $stmt->bind_param('sss', $role, $role, $role);
  $stmt->execute();
  $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
  $stmt->close();
  return $rows;
}

function cronRunInactivityWarning714(
  mysqli $db,
  array $smtpConfig,
  array $siteSettings,
  string $websiteBase
): void {
  foreach (['members' => 'member', 'admins' => 'admin'] as $table => $role) {
    $rows = cronGetInactivityCandidates($db, $table, $role);
    foreach ($rows as $row) {
      if (!empty($row['deleted_at']) || (int)$row['hidden'] === 1 || (int)$row['reminder_emails'] !== 1) {
        continue;
      }

      $lastActivity = (string)$row['last_activity'];
      $inactiveDays = (int)floor((time() - strtotime($lastActivity)) / 86400);
      if ($inactiveDays !== 335) {
        continue;
      }

      $memberId = (int)$row['id'];
      if (cronEmailAlreadySentAfter($db, $memberId, $role, 'msg_email_inactivity_warning', date('Y-m-d 00:00:00'))) {
        continue;
      }

      $email = (string)$row['account_email'];
      $username = (string)($row['username'] ?? '');
      $unsubUrl = $websiteBase . '/unsubscribed.html?id=' . $memberId . '&email=' . rawurlencode($email);

      cronSendEmail(
        $db,
        $smtpConfig,
        $siteSettings,
        'msg_email_inactivity_warning',
        $memberId,
        $role,
        $username,
        $email,
        [
          'name' => $username !== '' ? $username : 'there',
          'unsubscribe_link' => $unsubUrl,
        ]
      );
    }
  }
}

function cronRunInactivityClosure715(
  mysqli $db,
  array $smtpConfig,
  array $siteSettings
): void {
  foreach (['members' => 'member', 'admins' => 'admin'] as $table => $role) {
    $rows = cronGetInactivityCandidates($db, $table, $role);
    foreach ($rows as $row) {
      if (!empty($row['deleted_at']) || (int)$row['hidden'] === 1) {
        continue;
      }

      $lastActivity = (string)$row['last_activity'];
      $inactiveDays = (int)floor((time() - strtotime($lastActivity)) / 86400);
      if ($inactiveDays < 365) {
        continue;
      }

      $memberId = (int)$row['id'];
      $email = (string)$row['account_email'];
      $username = (string)($row['username'] ?? '');

      cronSendEmail(
        $db,
        $smtpConfig,
        $siteSettings,
        'msg_email_inactivity_closed',
        $memberId,
        $role,
        $username,
        $email,
        [
          'name' => $username !== '' ? $username : 'there',
        ]
      );

      $closeStmt = $db->prepare(
        "UPDATE `{$table}`
         SET deleted_at = NOW(), hidden = 1, reminder_emails = 0
         WHERE id = ? AND deleted_at IS NULL"
      );
      $closeStmt->bind_param('i', $memberId);
      $closeStmt->execute();
      $closeStmt->close();

      $hidePostsStmt = $db->prepare(
        "UPDATE posts
         SET visibility = 'hidden'
         WHERE member_id = ? AND member_role = ? AND visibility IN ('active','expired','hidden')"
      );
      $hidePostsStmt->bind_param('is', $memberId, $role);
      $hidePostsStmt->execute();
      $hidePostsStmt->close();
    }
  }
}

function cronCdnDelete(string $fileUrl, string $storageZoneName, string $storageApiKey): bool {
  if ($fileUrl === '') {
    return true;
  }
  $path = preg_replace('#^https?://[^/]+/#', '', $fileUrl);
  $apiUrl = 'https://storage.bunnycdn.com/' . $storageZoneName . '/' . $path;
  $ch = curl_init($apiUrl);
  curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST => 'DELETE',
    CURLOPT_HTTPHEADER => ['AccessKey: ' . $storageApiKey],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 30,
  ]);
  curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return $httpCode === 200 || $httpCode === 404;
}

function cronRunDeletionProcess711(
  mysqli $db,
  array $smtpConfig,
  array $siteSettings
): void {
  if (empty($siteSettings['storage_api_key']) || empty($siteSettings['storage_zone_name'])) {
    throw new RuntimeException('Required storage settings are missing for deletion process.');
  }

  $storageApiKey = $siteSettings['storage_api_key'];
  $storageZoneName = $siteSettings['storage_zone_name'];

  $postStmt = $db->prepare(
    "SELECT id
     FROM posts
     WHERE visibility = 'deleted'
       AND deleted_at IS NOT NULL
       AND deleted_at <= DATE_SUB(NOW(), INTERVAL 30 DAY)"
  );
  $postStmt->execute();
  $postsToDelete = $postStmt->get_result()->fetch_all(MYSQLI_ASSOC);
  $postStmt->close();

  foreach ($postsToDelete as $post) {
    $postId = (int)$post['id'];

    $mediaStmt = $db->prepare('SELECT file_url FROM post_media WHERE post_id = ?');
    $mediaStmt->bind_param('i', $postId);
    $mediaStmt->execute();
    $mediaRows = $mediaStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $mediaStmt->close();

    foreach ($mediaRows as $media) {
      cronCdnDelete((string)$media['file_url'], $storageZoneName, $storageApiKey);
    }

    $delStmt = $db->prepare('DELETE FROM posts WHERE id = ?');
    $delStmt->bind_param('i', $postId);
    $delStmt->execute();
    $delStmt->close();
  }

  foreach (['members' => 'member', 'admins' => 'admin'] as $table => $role) {
    $acctStmt = $db->prepare(
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
      $memberId = (int)$account['id'];
      $email = (string)$account['account_email'];
      $username = (string)($account['username'] ?? '');
      $avatarFile = (string)($account['avatar_file'] ?? '');

      cronSendEmail(
        $db,
        $smtpConfig,
        $siteSettings,
        'msg_email_account_deleted',
        $memberId,
        $role,
        $username,
        $email,
        [
          'name' => $username !== '' ? $username : 'there',
        ]
      );

      $allMediaStmt = $db->prepare(
        'SELECT pm.file_url
         FROM post_media pm
         INNER JOIN posts p ON p.id = pm.post_id
         WHERE p.member_id = ? AND p.member_role = ?'
      );
      $allMediaStmt->bind_param('is', $memberId, $role);
      $allMediaStmt->execute();
      $allMediaRows = $allMediaStmt->get_result()->fetch_all(MYSQLI_ASSOC);
      $allMediaStmt->close();

      foreach ($allMediaRows as $media) {
        cronCdnDelete((string)$media['file_url'], $storageZoneName, $storageApiKey);
      }

      if ($avatarFile !== '' && !empty($siteSettings['folder_avatars'])) {
        $avatarUrl = rtrim($siteSettings['folder_avatars'], '/') . '/' . $avatarFile;
        cronCdnDelete($avatarUrl, $storageZoneName, $storageApiKey);
      }

      $emailsStmt = $db->prepare("UPDATE emails_sent SET username = 'Deleted Member' WHERE member_id = ?");
      $emailsStmt->bind_param('i', $memberId);
      $emailsStmt->execute();
      $emailsStmt->close();

      $tokensStmt = $db->prepare('DELETE FROM member_tokens WHERE member_id = ?');
      $tokensStmt->bind_param('i', $memberId);
      $tokensStmt->execute();
      $tokensStmt->close();

      $settingsStmt = $db->prepare('DELETE FROM member_settings WHERE member_id = ?');
      $settingsStmt->bind_param('i', $memberId);
      $settingsStmt->execute();
      $settingsStmt->close();

      $postsStmt = $db->prepare('DELETE FROM posts WHERE member_id = ? AND member_role = ?');
      $postsStmt->bind_param('is', $memberId, $role);
      $postsStmt->execute();
      $postsStmt->close();

      $wipeStmt = $db->prepare(
        "UPDATE `{$table}` SET
           username = NULL,
           username_key = NULL,
           password_hash = 'DELETED',
           avatar_file = NULL,
           map_lighting = 'day',
           map_style = 'standard',
           animation_preference = 'full',
           favorites = NULL,
           recent = NULL,
           country = NULL,
           preferred_currency = NULL,
           backup_json = NULL,
           filters_json = NULL,
           filters_hash = NULL,
           filters_version = 1,
           filters_updated_at = NULL,
           reminder_emails = 0,
           last_login_at = NULL
         WHERE id = ?"
      );
      $wipeStmt->bind_param('i', $memberId);
      $wipeStmt->execute();
      $wipeStmt->close();
    }
  }
}

cronRunReminder716($mysqli, $smtpConfig, $siteSettings, $websiteBase);
cronRunAccountDeletionWarning710($mysqli, $smtpConfig, $siteSettings);
cronRunInactivityWarning714($mysqli, $smtpConfig, $siteSettings, $websiteBase);
cronRunInactivityClosure715($mysqli, $smtpConfig, $siteSettings);

if ($runDeletionProcess711 === true) {
  cronRunDeletionProcess711($mysqli, $smtpConfig, $siteSettings);
}

