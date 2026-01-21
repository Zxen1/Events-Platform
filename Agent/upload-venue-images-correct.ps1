# PowerShell script to download images from Wikimedia and upload to Bunny CDN
# Uses correct naming convention: {postId}-{original_filename}.{ext}

$ErrorActionPreference = "Continue"

# Start logging
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$logFile = Join-Path $scriptDir "upload-log-correct.txt"
Start-Transcript -Path $logFile -Append

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Venue Images Upload Script (Correct Names)" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Bunny CDN credentials
$storageZone = "funmap"
$storageApiKey = "4e411191-8bc0-48a1-97ab6fea3ec9-404c-4810"
$cdnPath = "post-images/2026-01"

# Local backup folder
$backupFolder = Join-Path $scriptDir "venue-images-backup"
if (-not (Test-Path $backupFolder)) {
    New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
    Write-Host "Created backup folder: $backupFolder" -ForegroundColor Green
}

# Force TLS 1.2
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

# CSV with source URLs and target filenames
$csvPath = Join-Path $scriptDir "venue-images-correct-names.csv"
$images = Import-Csv $csvPath

Write-Host "Found $($images.Count) images to process" -ForegroundColor Yellow
Write-Host ""

$successCount = 0
$failCount = 0

foreach ($img in $images) {
    $sourceUrl = $img.source_url
    $targetFilename = $img.target_filename
    
    Write-Host "Processing: $targetFilename" -ForegroundColor White
    Write-Host "  Source: $sourceUrl" -ForegroundColor Gray
    
    $localPath = Join-Path $backupFolder $targetFilename
    
    # Download from Wikimedia
    try {
        Write-Host "  Downloading..." -ForegroundColor Yellow
        
        $webClient = New-Object System.Net.WebClient
        $webClient.Headers.Add("User-Agent", "FunmapBot/1.0 (https://funmap.com; contact@funmap.com) PowerShell/5.1")
        $webClient.DownloadFile($sourceUrl, $localPath)
        
        $fileSize = (Get-Item $localPath).Length
        Write-Host "  Downloaded: $([math]::Round($fileSize/1MB, 2)) MB" -ForegroundColor Green
        
    } catch {
        Write-Host "  DOWNLOAD FAILED: $_" -ForegroundColor Red
        $failCount++
        Write-Host ""
        Start-Sleep -Seconds 2
        continue
    }
    
    # Upload to Bunny CDN
    try {
        Write-Host "  Uploading to Bunny CDN..." -ForegroundColor Yellow
        
        $bunnyUrl = "https://storage.bunnycdn.com/$storageZone/$cdnPath/$targetFilename"
        $fileBytes = [System.IO.File]::ReadAllBytes($localPath)
        
        $headers = @{
            "AccessKey" = $storageApiKey
            "Content-Type" = "application/octet-stream"
        }
        
        $response = Invoke-WebRequest -Uri $bunnyUrl -Method PUT -Headers $headers -Body $fileBytes -UseBasicParsing
        
        if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
            Write-Host "  UPLOADED: https://cdn.funmap.com/$cdnPath/$targetFilename" -ForegroundColor Green
            $successCount++
        } else {
            Write-Host "  UPLOAD FAILED: HTTP $($response.StatusCode)" -ForegroundColor Red
            $failCount++
        }
        
    } catch {
        Write-Host "  UPLOAD FAILED: $_" -ForegroundColor Red
        $failCount++
    }
    
    Write-Host ""
    
    # Rate limiting - wait 2 seconds between downloads
    Start-Sleep -Seconds 2
}

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "COMPLETE" -ForegroundColor Cyan
Write-Host "  Success: $successCount" -ForegroundColor Green
Write-Host "  Failed: $failCount" -ForegroundColor $(if ($failCount -gt 0) { "Red" } else { "Green" })
Write-Host "  Backup folder: $backupFolder" -ForegroundColor Gray
Write-Host "============================================" -ForegroundColor Cyan

Stop-Transcript

Write-Host ""
Write-Host "Log saved to: $logFile" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Enter to close..." -ForegroundColor Yellow
Read-Host
