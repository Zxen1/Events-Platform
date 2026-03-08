<?php
// cron.php — Daily scheduled job orchestrator.
//
// Runs once per day via cPanel cron:
//   /usr/local/bin/php -q /home/funmapco/public_html/home/funmapco/connectors/cron.php
//
// Execution order:
//   1. Reminder report        (template 716)
//   2. Account deletion warning (template 710)
//   3. Inactivity warning     (template 714)
//   4. Inactivity closure     (template 715)
//   5. Deletion process       (template 711) — GUARDED, disabled until approved

if (php_sapi_name() !== 'cli') {
  http_response_code(403);
  exit;
}

define('EMAIL_LIBRARY_MODE', true);
require_once __DIR__ . '/send-email.php';

[$mysqli, $smtpConfig, $siteSettings] = emailBootstrap();

if (empty($siteSettings['website_url'])) {
  throw new RuntimeException('Required admin setting missing: website_url');
}
if (empty($siteSettings['website_name'])) {
  throw new RuntimeException('Required admin setting missing: website_name');
}

$websiteBase       = rtrim($siteSettings['website_url'], '/');
$siteName          = $siteSettings['website_name'];
$runDeletionProcess = false; // SAFETY GUARD — change to true only when explicitly approved and tested.

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cronSendEmail(
  mysqli $db,
  array  $smtpConfig,
  array  $siteSettings,
  string $messageKey,
  int    $memberId,
  string $memberRole,
  string $username,
  string $toEmail,
  array  $placeholders = []
): bool {
  $result = sendEmailWithContext($db, $smtpConfig, $siteSettings, [
    'message_key'  => $messageKey,
    'member_id'    => $memberId,
    'member_role'  => $memberRole,
    'username'     => $username,
    'to_email'     => $toEmail,
    'to_name'      => $username,
    'placeholders' => $placeholders,
  ]);
  return (bool)($result['success'] ?? false);
}

function cronEmailAlreadySentAfter(
  mysqli $db,
  int    $memberId,
  string $memberRole,
  string $messageKey,
  string $sinceDateTime
): bool {
  $stmt = $db->prepare(
    "SELECT id FROM emails_sent
     WHERE member_id = ? AND member_role = ? AND message_key = ?
       AND status = 'sent' AND created_at >= ?
     ORDER BY id DESC LIMIT 1"
  );
  if (!$stmt) return false;
  $stmt->bind_param('isss', $memberId, $memberRole, $messageKey, $sinceDateTime);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();
  return !empty($row);
}

function cronFmtDate(string $datetime): string {
  return date('j M Y', strtotime($datetime));
}

// ─── Section 716 — Reminder report ───────────────────────────────────────────
//
// Batches all post-related reminders into one email per member per 7 days.
// Triggers: post expiring in 7 days, post expired today, post deletion warning
// at day 23 of grace period, post permanently deleted today.

function cronBuildReminderReport(array $needsAttention, array $recentlyExpired): string {
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
              . '<p style="font-size:14px;color:#333;margin:0 0 2px;">'
              . htmlspecialchars($p['status_line']) . ' · ' . htmlspecialchars(cronFmtDate($p['date']))
              . '</p>'
              . '<p style="font-size:13px;color:#888;margin:0;">' . htmlspecialchars($p['title']) . '</p>'
              . '</div>';
    }
  }

  $remainingSlots = 10 - count($needsAttention);
  if ($recentlyExpired && $remainingSlots > 0) {
    $shown = array_slice($recentlyExpired, 0, $remainingSlots);
    $html .= '<p style="font-size:13px;font-weight:bold;color:#333;margin:'
           . ($needsAttention ? '24px' : '0') . ' 0 10px;">Recently expired:</p>';
    foreach ($shown as $i => $p) {
      $gap   = ($i < count($shown) - 1) ? '12px' : '0';
      $html .= '<div style="margin:0 0 ' . $gap . ';">'
             . '<p style="font-size:14px;color:#aaa;margin:0 0 2px;">'
             . htmlspecialchars($p['status_line']) . ' · ' . htmlspecialchars(cronFmtDate($p['date']))
             . '</p>'
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
       SUM(visibility = 'active')  AS live,
       SUM(visibility = 'expired') AS expired_count
     FROM posts
     WHERE member_id = ? AND member_role = ?"
  );
  $stmt->bind_param('is', $memberId, $memberRole);
  $stmt->execute();
  $row = $stmt->get_result()->fetch_assoc();
  $stmt->close();

  $parts = [];
  if ((int)$row['live']          > 0) $parts[] = $row['live'] . ' live';
  if ((int)$row['expired_count'] > 0) $parts[] = $row['expired_count'] . ' expired';
  return 'Your account: ' . (count($parts) ? implode(' · ', $parts) : 'no active listings');
}

function cronGetReminderSubject(array $needsAttention, array $recentlyExpired, string $siteName): string {
  foreach ($needsAttention as $p) {
    if ($p['type'] === 'deletion_warning') {
      return 'Your ' . $siteName . ' listing will be permanently deleted soon';
    }
  }
  foreach ($needsAttention as $p) {
    if ($p['type'] === 'expiring') {
      $days = (int)$p['days_remaining'];
      return 'Your ' . $siteName . ' listing expires in ' . $days . ' ' . ($days === 1 ? 'day' : 'days');
    }
  }
  foreach ($recentlyExpired as $p) {
    if ($p['type'] === 'deleted') {
      return 'Your ' . $siteName . ' listing has been permanently deleted';
    }
  }
  foreach ($recentlyExpired as $p) {
    if ($p['type'] === 'expired') {
      return 'Your ' . $siteName . ' listing has expired';
    }
  }
  return 'Your ' . $siteName . ' listing report';
}

function cronRunReminderReport(
  mysqli $db,
  array  $smtpConfig,
  array  $siteSettings,
  string $websiteBase,
  string $siteName
): void {
  $runForTable = function (string $table, string $role) use ($db, $smtpConfig, $siteSettings, $websiteBase, $siteName): void {
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
      $email    = (string)$account['account_email'];
      $username = (string)($account['username'] ?? '');

      // 7-day cooldown
      $coolStmt = $db->prepare(
        "SELECT MAX(created_at) AS last_sent
         FROM emails_sent
         WHERE member_id = ? AND member_role = ?
           AND message_key = 'msg_email_reminder_report' AND status = 'sent'"
      );
      $coolStmt->bind_param('is', $memberId, $role);
      $coolStmt->execute();
      $coolRow = $coolStmt->get_result()->fetch_assoc();
      $coolStmt->close();
      if (!empty($coolRow['last_sent']) && strtotime($coolRow['last_sent']) > strtotime('-7 days')) {
        continue;
      }

      // Trigger check — one of four events must have occurred today
      $trigStmt = $db->prepare(
        "SELECT COUNT(*) AS cnt FROM posts
         WHERE member_id = ? AND member_role = ? AND (
           (visibility = 'active'  AND DATE(expires_at) = CURDATE())
           OR (visibility = 'active'  AND DATE(expires_at) = DATE(DATE_ADD(NOW(), INTERVAL 7 DAY)))
           OR (visibility = 'expired' AND DATE(expires_at) = DATE(DATE_SUB(NOW(), INTERVAL 23 DAY)))
           OR (visibility = 'deleted' AND DATE(deleted_at) = CURDATE())
         )"
      );
      $trigStmt->bind_param('is', $memberId, $role);
      $trigStmt->execute();
      $trigRow = $trigStmt->get_result()->fetch_assoc();
      $trigStmt->close();
      if ((int)$trigRow['cnt'] === 0) continue;

      // Needs attention: active posts expiring within 14 days
      $expStmt = $db->prepare(
        "SELECT p.id, p.expires_at,
                (SELECT pmc.title FROM post_map_cards pmc
                 WHERE pmc.post_id = p.id ORDER BY pmc.id ASC LIMIT 1) AS title
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
        $daysRemaining    = max(0, (int)ceil((strtotime($row['expires_at']) - time()) / 86400));
        $needsAttention[] = [
          'type'          => 'expiring',
          'date'          => $row['expires_at'],
          'days_remaining'=> $daysRemaining,
          'title'         => $row['title'] ?? '',
          'status_line'   => 'Expires in ' . $daysRemaining . ' ' . ($daysRemaining === 1 ? 'day' : 'days'),
        ];
      }

      // Needs attention: expired posts within 14 days of permanent deletion (expired 16–30 days ago)
      $warnStmt = $db->prepare(
        "SELECT p.id, p.expires_at,
                (SELECT pmc.title FROM post_map_cards pmc
                 WHERE pmc.post_id = p.id ORDER BY pmc.id ASC LIMIT 1) AS title
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
        $warnIds[]        = (int)$row['id'];
        $deletionTs       = strtotime($row['expires_at']) + (30 * 86400);
        $daysUntilDel     = max(0, (int)ceil(($deletionTs - time()) / 86400));
        $needsAttention[] = [
          'type'        => 'deletion_warning',
          'date'        => date('Y-m-d H:i:s', $deletionTs),
          'title'       => $row['title'] ?? '',
          'status_line' => 'Scheduled for deletion in ' . $daysUntilDel . ' ' . ($daysUntilDel === 1 ? 'day' : 'days'),
        ];
      }
      usort($needsAttention, fn($a, $b) => strtotime($a['date']) <=> strtotime($b['date']));

      // Recently expired or member-deleted within 30 days
      $recentStmt = $db->prepare(
        "SELECT p.id, p.visibility, p.expires_at, p.deleted_at,
                (SELECT pmc.title FROM post_map_cards pmc
                 WHERE pmc.post_id = p.id ORDER BY pmc.id ASC LIMIT 1) AS title
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
        if (in_array((int)$row['id'], $warnIds, true)) continue;
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

      if (empty($needsAttention) && empty($recentlyExpired)) continue;

      $reportHtml  = cronBuildReminderReport($needsAttention, $recentlyExpired);
      $summaryLine = cronBuildReminderSummary($db, $memberId, $role);
      $subject     = cronGetReminderSubject($needsAttention, $recentlyExpired, $siteName);
      $displayName = $username !== '' ? $username : 'there';
      $unsubUrl    = $websiteBase . '/unsubscribed.html?id=' . $memberId . '&email=' . rawurlencode($email);

      cronSendEmail(
        $db, $smtpConfig, $siteSettings,
        'msg_email_reminder_report',
        $memberId, $role, $username, $email,
        [
          'name'             => htmlspecialchars($displayName, ENT_QUOTES, 'UTF-8'),
          'trigger_subject'  => htmlspecialchars($subject, ENT_QUOTES, 'UTF-8'),
          'summary'          => htmlspecialchars($summaryLine, ENT_QUOTES, 'UTF-8'),
          'reminder_report'  => $reportHtml,
          'unsubscribe_link' => htmlspecialchars($unsubUrl, ENT_QUOTES, 'UTF-8'),
        ]
      );
    }
  };

  $runForTable('members', 'member');
  $runForTable('admins',  'admin');
}

// ─── Section 710 — Account deletion warning ───────────────────────────────────
//
// Fires at day 23 of the 30-day account deletion grace period.
// One email per account (deduped via emails_sent).

function cronRunAccountDeletionWarning(
  mysqli $db,
  array  $smtpConfig,
  array  $siteSettings
): void {
  foreach (['members' => 'member', 'admins' => 'admin'] as $table => $role) {
    $stmt = $db->prepare(
      "SELECT id, account_email, username, deleted_at
       FROM `{$table}`
       WHERE deleted_at IS NOT NULL
         AND password_hash <> 'DELETED'
         AND deleted_at >= DATE_SUB(NOW(), INTERVAL 24 DAY)
         AND deleted_at <  DATE_SUB(NOW(), INTERVAL 23 DAY)"
    );
    $stmt->execute();
    $accounts = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    foreach ($accounts as $account) {
      $memberId   = (int)$account['id'];
      $email      = (string)$account['account_email'];
      $username   = (string)($account['username'] ?? '');
      $deletedAt  = (string)$account['deleted_at'];

      if (cronEmailAlreadySentAfter($db, $memberId, $role, 'msg_email_account_deletion_warning', $deletedAt)) {
        continue;
      }

      $deletionDate = date('j F Y', strtotime($deletedAt . ' +30 days'));

      cronSendEmail(
        $db, $smtpConfig, $siteSettings,
        'msg_email_account_deletion_warning',
        $memberId, $role, $username, $email,
        [
          'name' => htmlspecialchars($username !== '' ? $username : 'there', ENT_QUOTES, 'UTF-8'),
          'date' => htmlspecialchars($deletionDate, ENT_QUOTES, 'UTF-8'),
        ]
      );
    }
  }
}

// ─── Inactivity candidates (shared by 714 and 715) ───────────────────────────
//
// Inactivity is measured from the latest of:
//   last login, last post created, last payment, last post expiry.
// An account with a paid post still within its period is not considered inactive.

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
         COALESCE(a.last_login_at,                                                             '1970-01-01 00:00:00'),
         COALESCE((SELECT MAX(p.created_at)  FROM posts p        WHERE p.member_id = a.id AND p.member_role = ?), '1970-01-01 00:00:00'),
         COALESCE((SELECT MAX(t.created_at)  FROM transactions t WHERE t.member_id = a.id AND t.member_role = ?), '1970-01-01 00:00:00'),
         COALESCE((SELECT MAX(p2.expires_at) FROM posts p2       WHERE p2.member_id = a.id AND p2.member_role = ?), '1970-01-01 00:00:00'),
         COALESCE(a.created_at,                                                                '1970-01-01 00:00:00')
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

// ─── Section 714 — Inactivity warning ────────────────────────────────────────
//
// Fires at exactly 335 days of inactivity.
// Respects the reminder_emails opt-out flag.

function cronRunInactivityWarning(
  mysqli $db,
  array  $smtpConfig,
  array  $siteSettings,
  string $websiteBase
): void {
  foreach (['members' => 'member', 'admins' => 'admin'] as $table => $role) {
    $rows = cronGetInactivityCandidates($db, $table, $role);

    foreach ($rows as $row) {
      if (!empty($row['deleted_at']) || (int)$row['hidden'] === 1 || (int)$row['reminder_emails'] !== 1) {
        continue;
      }

      $inactiveDays = (int)floor((time() - strtotime((string)$row['last_activity'])) / 86400);
      if ($inactiveDays !== 335) continue;

      $memberId = (int)$row['id'];
      if (cronEmailAlreadySentAfter($db, $memberId, $role, 'msg_email_inactivity_warning', date('Y-m-d 00:00:00'))) {
        continue;
      }

      $email    = (string)$row['account_email'];
      $username = (string)($row['username'] ?? '');
      $unsubUrl = $websiteBase . '/unsubscribed.html?id=' . $memberId . '&email=' . rawurlencode($email);

      cronSendEmail(
        $db, $smtpConfig, $siteSettings,
        'msg_email_inactivity_warning',
        $memberId, $role, $username, $email,
        [
          'name'             => htmlspecialchars($username !== '' ? $username : 'there', ENT_QUOTES, 'UTF-8'),
          'unsubscribe_link' => htmlspecialchars($unsubUrl, ENT_QUOTES, 'UTF-8'),
        ]
      );
    }
  }
}

// ─── Section 715 — Inactivity closure ────────────────────────────────────────
//
// Fires at 365+ days of inactivity.
// Sends email 715, soft-closes the account (deleted_at, hidden = 1),
// and hides all posts. Does NOT hard-delete — that is the deletion process (711).

function cronRunInactivityClosure(
  mysqli $db,
  array  $smtpConfig,
  array  $siteSettings
): void {
  foreach (['members' => 'member', 'admins' => 'admin'] as $table => $role) {
    $rows = cronGetInactivityCandidates($db, $table, $role);

    foreach ($rows as $row) {
      if (!empty($row['deleted_at']) || (int)$row['hidden'] === 1) continue;

      $inactiveDays = (int)floor((time() - strtotime((string)$row['last_activity'])) / 86400);
      if ($inactiveDays < 365) continue;

      $memberId = (int)$row['id'];
      $email    = (string)$row['account_email'];
      $username = (string)($row['username'] ?? '');

      cronSendEmail(
        $db, $smtpConfig, $siteSettings,
        'msg_email_inactivity_closed',
        $memberId, $role, $username, $email,
        [
          'name' => htmlspecialchars($username !== '' ? $username : 'there', ENT_QUOTES, 'UTF-8'),
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

// ─── Section 711 — Deletion process ──────────────────────────────────────────
//
// ══════════════════════════════════════════════════════════════════
// WARNING: THIS FUNCTION PERFORMS PERMANENT, IRREVERSIBLE DATA DELETION.
// DO NOT ENABLE UNTIL THE FULL DELETION FLOW HAS BEEN TESTED END-TO-END.
// Enable by setting $runDeletionProcess = true at the top of this file.
// ══════════════════════════════════════════════════════════════════
//
// POST HARD DELETE (day 30):
//   1. Collect all post_media file URLs (including soft-deleted rows)
//   2. Delete CDN files
//   3. Hard DELETE posts row — cascades wipe:
//      post_map_cards → post_amenities, post_item_pricing, post_sessions,
//      post_ticket_pricing, post_links, post_media, post_revisions,
//      commissions, moderation_log
//   transactions: never touched — financial records retained
//
// ACCOUNT HARD DELETE (day 30):
//   1. Send email 711 BEFORE touching any data
//   2. Collect all post image URLs + avatar filename
//   3. Delete CDN files (post images + avatar)
//   4. UPDATE emails_sent: set username = 'Deleted Member'
//   5. Hard DELETE member_tokens
//   6. Hard DELETE member_settings
//   7. Hard DELETE all posts — cascades wipe all child tables
//   8. Tombstone: wipe personal columns, keep id + account_email + deleted_at + hidden
//   transactions: never touched — financial records retained
//
// TOMBSTONE (step 8):
//   The members/admins row is NOT hard deleted. Personal columns are wiped.
//   Retained: id, account_email, deleted_at, hidden = 1.
//   password_hash is set to the literal string 'DELETED' — this is intentional.
//   The duplicate-email check in add-member.php uses password_hash != 'DELETED'
//   to exclude tombstones and allow re-registration with the same email address.
//   Do NOT change this string without updating that check.

function cronCdnDelete(string $fileUrl, string $storageZoneName, string $storageApiKey): bool {
  if ($fileUrl === '') return true;
  $path   = preg_replace('#^https?://[^/]+/#', '', $fileUrl);
  $apiUrl = 'https://storage.bunnycdn.com/' . $storageZoneName . '/' . $path;
  $ch     = curl_init($apiUrl);
  curl_setopt_array($ch, [
    CURLOPT_CUSTOMREQUEST  => 'DELETE',
    CURLOPT_HTTPHEADER     => ['AccessKey: ' . $storageApiKey],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 30,
  ]);
  curl_exec($ch);
  $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
  curl_close($ch);
  return $httpCode === 200 || $httpCode === 404;
}

function cronRunDeletionProcess(
  mysqli $db,
  array  $smtpConfig,
  array  $siteSettings
): void {
  if (empty($siteSettings['storage_api_key']) || empty($siteSettings['storage_zone_name'])) {
    throw new RuntimeException('Required storage settings missing: storage_api_key, storage_zone_name');
  }

  $storageApiKey   = $siteSettings['storage_api_key'];
  $storageZoneName = $siteSettings['storage_zone_name'];

  // ── Post hard delete ──────────────────────────────────────────────────────

  $postStmt = $db->prepare(
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

  // ── Account hard delete ───────────────────────────────────────────────────

  foreach (['members' => 'member', 'admins' => 'admin'] as $table => $role) {
    $acctStmt = $db->prepare(
      "SELECT id, account_email, username, avatar_file
       FROM `{$table}`
       WHERE deleted_at IS NOT NULL
         AND deleted_at <= DATE_SUB(NOW(), INTERVAL 30 DAY)
         AND hidden = 1
         AND password_hash <> 'DELETED'"
    );
    $acctStmt->execute();
    $accounts = $acctStmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $acctStmt->close();

    foreach ($accounts as $account) {
      $memberId   = (int)$account['id'];
      $email      = (string)$account['account_email'];
      $username   = (string)($account['username'] ?? '');
      $avatarFile = (string)($account['avatar_file'] ?? '');

      // Step 1: Send email 711 BEFORE touching any data.
      cronSendEmail(
        $db, $smtpConfig, $siteSettings,
        'msg_email_account_deleted',
        $memberId, $role, $username, $email,
        [
          'name' => htmlspecialchars($username !== '' ? $username : 'there', ENT_QUOTES, 'UTF-8'),
        ]
      );

      // Steps 2–3: Delete all post image CDN files for this member.
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

      // Step 3b: Delete avatar from CDN.
      if ($avatarFile !== '' && !empty($siteSettings['folder_avatars'])) {
        $avatarUrl = rtrim($siteSettings['folder_avatars'], '/') . '/' . $avatarFile;
        cronCdnDelete($avatarUrl, $storageZoneName, $storageApiKey);
      }

      // Step 4: Preserve audit trail — replace username with 'Deleted Member'.
      $emailsStmt = $db->prepare("UPDATE emails_sent SET username = 'Deleted Member' WHERE member_id = ?");
      $emailsStmt->bind_param('i', $memberId);
      $emailsStmt->execute();
      $emailsStmt->close();

      // Step 5: Hard DELETE member_tokens.
      $tokensStmt = $db->prepare('DELETE FROM member_tokens WHERE member_id = ?');
      $tokensStmt->bind_param('i', $memberId);
      $tokensStmt->execute();
      $tokensStmt->close();

      // Step 6: Hard DELETE member_settings.
      $settingsStmt = $db->prepare('DELETE FROM member_settings WHERE member_id = ?');
      $settingsStmt->bind_param('i', $memberId);
      $settingsStmt->execute();
      $settingsStmt->close();

      // Step 7: Hard DELETE all posts — cascades wipe all child tables.
      $postsStmt = $db->prepare('DELETE FROM posts WHERE member_id = ? AND member_role = ?');
      $postsStmt->bind_param('is', $memberId, $role);
      $postsStmt->execute();
      $postsStmt->close();

      // Step 8: Tombstone — wipe personal columns, retain id + account_email + deleted_at + hidden.
      $wipeStmt = $db->prepare(
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
}

// ─── Execute ──────────────────────────────────────────────────────────────────

cronRunReminderReport($mysqli, $smtpConfig, $siteSettings, $websiteBase, $siteName);
cronRunAccountDeletionWarning($mysqli, $smtpConfig, $siteSettings);
cronRunInactivityWarning($mysqli, $smtpConfig, $siteSettings, $websiteBase);
cronRunInactivityClosure($mysqli, $smtpConfig, $siteSettings);

if ($runDeletionProcess === true) {
  cronRunDeletionProcess($mysqli, $smtpConfig, $siteSettings);
}
