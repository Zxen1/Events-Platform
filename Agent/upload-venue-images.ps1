# Bunny CDN Upload Script for Venue Images
# Downloads from Wikimedia Commons, saves locally, uploads to Bunny CDN

$BUNNY_API_KEY = "4e411191-8bc0-48a1-97ab6fea3ec9-404c-4810"
$BUNNY_STORAGE_ZONE = "funmap"
$BUNNY_URL = "https://storage.bunnycdn.com/$BUNNY_STORAGE_ZONE/post-images/2026-01"

# Paths
$MANIFEST_PATH = "D:\Websites\Events Platform Cursor 2025\Events-Platform\Agent\venue-test-batch-manifest.csv"
$LOCAL_BACKUP = "D:\Websites\Events Platform Cursor 2025\Events-Platform\Agent\venue-images"

# Create local backup folder
if (!(Test-Path $LOCAL_BACKUP)) {
    New-Item -ItemType Directory -Path $LOCAL_BACKUP -Force | Out-Null
    Write-Host "Created folder: $LOCAL_BACKUP" -ForegroundColor Green
}

# Read manifest (skip header)
$images = Import-Csv $MANIFEST_PATH

$total = $images.Count
$current = 0

foreach ($img in $images) {
    $current++
    $sourceUrl = $img.source_url
    $targetFile = $img.target_filename
    $localPath = Join-Path $LOCAL_BACKUP $targetFile
    
    Write-Host "[$current/$total] $targetFile" -ForegroundColor Cyan
    
    # Download from Wikimedia
    Write-Host "  Downloading..." -NoNewline
    try {
        Invoke-WebRequest -Uri $sourceUrl -OutFile $localPath -UseBasicParsing
        $fileSize = [math]::Round((Get-Item $localPath).Length / 1MB, 2)
        Write-Host " OK ($fileSize MB)" -ForegroundColor Green
    } catch {
        Write-Host " FAILED: $_" -ForegroundColor Red
        continue
    }
    
    # Upload to Bunny CDN
    Write-Host "  Uploading..." -NoNewline
    $uploadUrl = "$BUNNY_URL/$targetFile"
    try {
        $headers = @{ "AccessKey" = $BUNNY_API_KEY }
        $fileBytes = [System.IO.File]::ReadAllBytes($localPath)
        Invoke-RestMethod -Uri $uploadUrl -Method Put -Headers $headers -Body $fileBytes -ContentType "application/octet-stream"
        Write-Host " OK" -ForegroundColor Green
    } catch {
        Write-Host " FAILED: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "Complete! Local backups saved to:" -ForegroundColor Yellow
Write-Host "  $LOCAL_BACKUP" -ForegroundColor White
Write-Host ""
Write-Host "Images uploaded to:" -ForegroundColor Yellow
Write-Host "  https://cdn.funmap.com/post-images/2026-01/" -ForegroundColor White
