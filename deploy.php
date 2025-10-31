<?php
// ======================================================
// 🍌 FunMap GitHub → cPanel Webhook (Banana-Skin Protected)
// Instant 200 OK response to prevent GitHub timeout
// Background executes /home/funmapco/auto-publish.sh pull
// ======================================================

ignore_user_abort(true);
set_time_limit(0);

// --- Immediate 200 OK so GitHub stops waiting ---
header("HTTP/1.1 200 OK");
echo "Deployment started.";
flush();
if (function_exists('fastcgi_finish_request')) {
    fastcgi_finish_request();
}

// --- Logging setup ---
$logDir = "/home/funmapco/logs";
if (!is_dir($logDir)) {
    mkdir($logDir, 0755, true);
}
$logFile = $logDir . "/deploy-" . date("Y-m-d") . ".log";

// --- Run auto-publish in background ---
$cmd = "/home/funmapco/auto-publish.sh pull >> $logFile 2>&1 &";
exec($cmd);

// --- Optional simple confirmation log entry ---
file_put_contents($logFile, "[" . date("Y-m-d H:i:s") . "] Webhook triggered\n", FILE_APPEND);
?>
