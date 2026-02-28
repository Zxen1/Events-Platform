<?php
$configCandidates = [
  dirname(__DIR__, 2) . '/config/config-db.php',
  dirname(__DIR__, 3) . '/config/config-db.php',
  __DIR__ . '/../../config/config-db.php',
  __DIR__ . '/../config/config-db.php',
];
$configPath = null;
foreach ($configCandidates as $c) {
  if (is_file($c)) { $configPath = $c; break; }
}
if ($configPath === null) { die('Cannot find config-db.php'); }
require_once $configPath;

$stmt = $mysqli->prepare(
  "SELECT setting_key, setting_value FROM admin_settings
   WHERE setting_key IN ('email_logo', 'folder_system_images')"
);
$stmt->execute();
$res = $stmt->get_result();
$settings = [];
while ($row = $res->fetch_assoc()) {
  $settings[$row['setting_key']] = $row['setting_value'];
}
$stmt->close();

$logoFolder = rtrim($settings['folder_system_images'] ?? '', '/');
$logoFile   = $settings['email_logo'] ?? '';
$logoUrl    = ($logoFolder && $logoFile) ? $logoFolder . '/' . rawurlencode($logoFile) : '';

$stmt = $mysqli->prepare(
  "SELECT message_name, message_key, message_text, placeholders
   FROM admin_messages
   WHERE container_key = 'msg_email' AND is_active = 1
   ORDER BY id ASC"
);
$stmt->execute();
$result = $stmt->get_result();
$templates = $result->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$logoHtml = '';
if ($logoUrl) {
  $logoHtml = '<div style="background:#fff;padding:24px;text-align:center;border-bottom:1px solid #eee;"><img src="' . htmlspecialchars($logoUrl) . '" alt="" style="max-height:60px;max-width:100%;"></div>';
}

function preview_format_amount(mysqli $db, float $amount, string $currencyCode): string {
  $stmt = $db->prepare(
    "SELECT lc.option_symbol, lc.option_symbol_position, lc.option_decimal_separator,
            lc.option_decimal_places, lc.option_thousands_separator, lc.option_filename,
            s.setting_value AS folder_currencies
     FROM list_currencies lc
     LEFT JOIN admin_settings s ON s.setting_key = 'folder_currencies'
     WHERE lc.option_value = ? AND lc.is_active = 1 LIMIT 1"
  );
  if (!$stmt) return number_format($amount, 2);
  $stmt->bind_param('s', $currencyCode);
  $stmt->execute();
  $cur = $stmt->get_result()->fetch_assoc();
  $stmt->close();
  if (!$cur) return number_format($amount, 2);
  $decPlaces = (int)$cur['option_decimal_places'];
  $decSep    = $cur['option_decimal_separator'] ?: '.';
  $thousSep  = $cur['option_thousands_separator'] ?: ',';
  $symbol    = $cur['option_symbol'] ?: $currencyCode;
  $position  = $cur['option_symbol_position'] ?: 'left';
  $filename  = $cur['option_filename'] ?: '';
  $formatted = number_format($amount, $decPlaces, $decSep, $thousSep);
  $number    = $position === 'right' ? $formatted . ' ' . $symbol : $symbol . $formatted;
  $flagHtml  = '';
  if ($filename && $cur['folder_currencies']) {
    $cdnBase  = rtrim($cur['folder_currencies'], '/');
    $flagHtml = '<img src="' . htmlspecialchars($cdnBase . '/' . $filename) . '" alt="' . htmlspecialchars($currencyCode) . '" style="width:18px;height:12px;vertical-align:middle;margin-right:5px;">';
  }
  return $flagHtml . $number;
}

// Fetch most recent transaction per type, with member name
$txData = [];
foreach (['new_post', 'edit', 'donation'] as $type) {
  $stmt = $mysqli->prepare(
    "SELECT t.id, t.description, t.amount, t.currency,
            COALESCE(m.username, 'Member') AS member_name
     FROM transactions t
     LEFT JOIN members m ON m.id = t.member_id
     WHERE t.transaction_type = ?
     ORDER BY t.id DESC LIMIT 1"
  );
  if ($stmt) {
    $stmt->bind_param('s', $type);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if ($row) $txData[$type] = $row;
  }
}

$keyToType = [
  'msg_email_post_live'       => 'new_post',
  'msg_email_post_updated'    => 'edit',
  'msg_email_donation_thanks' => 'donation',
];

$samples = [
  'logo'          => $logoHtml,
  'name'          => 'Jane Smith',
  'title'         => 'Sydney Harbour Fireworks',
  'tier'          => 'Premium',
  'view_link'     => 'https://funmap.com/post/1828-login-and-pay-test',
  'edit_link'     => 'https://funmap.com/post-editor=1828-login-and-pay-test',
  'reset_link'    => 'https://funmap.com',
  'amount'        => '',
  'description'   => '',
  'receipt_id'    => '',
  'listings'      => '<ul style="padding:0 0 0 20px;margin:0 0 16px;"><li style="margin-bottom:8px;font-size:15px;color:#333;">Sydney Harbour Fireworks — expires 6 Mar 2026</li><li style="margin-bottom:8px;font-size:15px;color:#333;">Little Havana Domino Park — expires 9 Mar 2026</li></ul>',
  'listing_label' => 'listings',
  'has_have'      => 'have',
  'is_are'        => 'are',
];
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Email Preview</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; background: #e0e0e0; padding: 40px 20px; }
    h1 { font-size: 18px; color: #333; margin-bottom: 30px; }
    .email-block { margin-bottom: 60px; }
    .email-label { font-size: 13px; font-weight: bold; color: #666; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
    .email-subject { font-size: 13px; color: #999; margin-bottom: 14px; }
    .email-subject span { color: #333; font-weight: bold; }
    .email-frame { background: #fff; border-radius: 4px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.12); max-width: 640px; }
    .divider { border: none; border-top: 1px solid #ccc; margin: 0 0 60px; }
  </style>
</head>
<body>
  <h1>FunMap — Email Template Preview</h1>
  <br>
<?php foreach ($templates as $t):
  $body    = $t['message_text'];
  $allowed = $t['placeholders'] ? json_decode($t['placeholders'], true) : [];

  $type = $keyToType[$t['message_key']] ?? null;
  $tx   = $type && isset($txData[$type]) ? $txData[$type] : null;

  $renderSamples = $samples;
  if ($tx) {
    $renderSamples['name']        = htmlspecialchars($tx['member_name']);
    $renderSamples['description'] = htmlspecialchars($tx['description']);
    $renderSamples['amount']      = preview_format_amount($mysqli, (float)$tx['amount'], $tx['currency']);
    $renderSamples['receipt_id']  = (string)$tx['id'];
  }

  if (is_array($allowed)) {
    foreach ($allowed as $key) {
      $val  = $renderSamples[$key] ?? '{' . $key . '}';
      $body = str_replace('{' . $key . '}', $val, $body);
    }
  }
?>
  <div class="email-block">
    <div class="email-label"><?= htmlspecialchars($t['message_key']) ?></div>
    <div class="email-subject">Subject: <span><?= htmlspecialchars($t['message_name']) ?></span></div>
    <div class="email-frame"><?= $body ?></div>
  </div>
  <hr class="divider">
<?php endforeach; ?>
</body>
</html>
