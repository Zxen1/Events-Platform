<?php
$log = __DIR__ . '/deploy.log';
function logline($msg) {
  global $log;
  file_put_contents($log, date('[Y-m-d H:i:s] ') . $msg . "\n", FILE_APPEND);
}

logline("Webhook triggered.");

chdir('/home/funmapco/repositories/github');
exec('git reset --hard HEAD 2>&1', $out1, $ret1);
logline("git reset: " . implode("\n", $out1));

exec('git pull origin main 2>&1', $out2, $ret2);
logline("git pull: " . implode("\n", $out2));

exec('/home/funmapco/auto-publish.sh 2>&1', $out3, $ret3);
logline("auto-publish: " . implode("\n", $out3));

logline("Deployment finished.\n");
http_response_code(200);
