# Bunny CDN Upload Script for Venue Images
# Downloads from Wikimedia Commons, saves locally, uploads to Bunny CDN

$ErrorActionPreference = "Continue"

$BUNNY_API_KEY = "4e411191-8bc0-48a1-97ab6fea3ec9-404c-4810"
$BUNNY_STORAGE_ZONE = "funmap"
$BUNNY_URL = "https://storage.bunnycdn.com/$BUNNY_STORAGE_ZONE/post-images/2026-01"

# Paths
$MANIFEST_PATH = "D:\Websites\Events Platform Cursor 2025\Events-Platform\Agent\venue-test-batch-manifest.csv"
$LOCAL_BACKUP = "D:\Websites\Events Platform Cursor 2025\Events-Platform\Agent\venue-images"
$LOG_FILE = "D:\Websites\Events Platform Cursor 2025\Events-Platform\Agent\upload-log.txt"

# Start logging to file
Start-Transcript -Path $LOG_FILE -Force

Write-Host "=== Bunny CDN Image Upload Script ===" -ForegroundColor Yellow
Write-Host ""

# Create local backup folder
if (!(Test-Path $LOCAL_BACKUP)) {
    New-Item -ItemType Directory -Path $LOCAL_BACKUP -Force | Out-Null
    Write-Host "Created folder: $LOCAL_BACKUP" -ForegroundColor Green
}

# Check manifest exists
if (!(Test-Path $MANIFEST_PATH)) {
    Write-Host "ERROR: Manifest file not found at:" -ForegroundColor Red
    Write-Host "  $MANIFEST_PATH" -ForegroundColor Red
    Write-Host ""
    Read-Host "Press Enter to exit"
    exit
}

# Read manifest
$images = Import-Csv $MANIFEST_PATH

$total = $images.Count
$current = 0
$successCount = 0
$failCount = 0

Write-Host "Found $total images to process" -ForegroundColor Cyan
Write-Host ""

foreach ($img in $images) {
    $current++
    $sourceUrl = $img.source_url
    $targetFile = $img.target_filename
    $localPath = Join-Path $LOCAL_BACKUP $targetFile
    
    Write-Host "[$current/$total] $targetFile" -ForegroundColor Cyan
    Write-Host "  Source: $sourceUrl"
    
    # Download from Wikimedia
    Write-Host "  Downloading..." -NoNewline
    try {
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        Invoke-WebRequest -Uri $sourceUrl -OutFile $localPath -UseBasicParsing -TimeoutSec 60
        $fileSize = [math]::Round((Get-Item $localPath).Length / 1MB, 2)
        Write-Host " OK ($fileSize MB)" -ForegroundColor Green
    } catch {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
        continue
    }
    
    # Upload to Bunny CDN
    Write-Host "  Uploading to Bunny..." -NoNewline
    $uploadUrl = "$BUNNY_URL/$targetFile"
    try {
        $headers = @{ "AccessKey" = $BUNNY_API_KEY }
        $fileBytes = [System.IO.File]::ReadAllBytes($localPath)
        Invoke-RestMethod -Uri $uploadUrl -Method Put -Headers $headers -Body $fileBytes -ContentType "application/octet-stream" -TimeoutSec 120
        Write-Host " OK" -ForegroundColor Green
        $successCount++
    } catch {
        Write-Host " FAILED" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        $failCount++
    }
    
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Yellow
Write-Host "Complete!" -ForegroundColor Green
Write-Host "  Success: $successCount" -ForegroundColor Green
Write-Host "  Failed:  $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host ""
Write-Host "Local backups: $LOCAL_BACKUP" -ForegroundColor White
Write-Host "CDN location:  https://cdn.funmap.com/post-images/2026-01/" -ForegroundColor White
Write-Host ""
Write-Host "Log saved to: $LOG_FILE" -ForegroundColor Cyan

Stop-Transcript

Read-Host "Press Enter to close"
