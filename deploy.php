<?php
$log = __DIR__ . '/deploy.log';
function logline($msg) {
  global $log;
  file_put_contents($log, date('[Y-m-d H:i:s] ') . $msg . "\n", FILE_APPEND);
}

logline("Webhook triggered.");

// Move to local repo folder
chdir('/home/funmapco/repositories/github');

// Pull latest from GitHub
exec('git fetch origin main 2>&1', $out1, $ret1);
logline("git fetch: " . implode("\n", $out1));

exec('git reset --hard origin/main 2>&1', $out2, $ret2);
logline("git reset: " . implode("\n", $out2));

// Run sync to update public_html
exec('/home/funmapco/auto-publish.sh 2>&1', $out3, $ret3);
logline("auto-publish: " . implode("\n", $out3));

logline("Deployment finished.\n");
http_response_code(200);
?>
