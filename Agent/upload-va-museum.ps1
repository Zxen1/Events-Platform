# Upload V&A Museum image (the one that failed)
$ErrorActionPreference = "Continue"

Write-Host "Downloading V&A Museum image..." -ForegroundColor Yellow

$url = "https://upload.wikimedia.org/wikipedia/commons/thumb/b/bb/Victoria_%26_Albert_Museum_Entrance%2C_London%2C_UK_-_Diliff.jpg/2560px-Victoria_%26_Albert_Museum_Entrance%2C_London%2C_UK_-_Diliff.jpg"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$localFile = Join-Path $scriptDir "venue-images\8-Victoria_and_Albert_Museum_London.jpg"

# Create folder if needed
$folder = Split-Path -Parent $localFile
if (!(Test-Path $folder)) { New-Item -ItemType Directory -Path $folder -Force | Out-Null }

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $url -OutFile $localFile -UseBasicParsing -TimeoutSec 120
    $size = [math]::Round((Get-Item $localFile).Length / 1MB, 2)
    Write-Host "Downloaded: $size MB" -ForegroundColor Green
} catch {
    Write-Host "Download failed: $_" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit
}

Write-Host "Uploading to Bunny CDN..." -ForegroundColor Yellow

try {
    $bytes = [System.IO.File]::ReadAllBytes($localFile)
    $headers = @{ "AccessKey" = "4e411191-8bc0-48a1-97ab6fea3ec9-404c-4810" }
    Invoke-RestMethod -Uri "https://storage.bunnycdn.com/funmap/post-images/2026-01/8-Victoria_and_Albert_Museum_London.jpg" -Method Put -Headers $headers -Body $bytes -ContentType "application/octet-stream" -TimeoutSec 120
    Write-Host "Upload complete!" -ForegroundColor Green
    Write-Host "URL: https://cdn.funmap.com/post-images/2026-01/8-Victoria_and_Albert_Museum_London.jpg" -ForegroundColor Cyan
} catch {
    Write-Host "Upload failed: $_" -ForegroundColor Red
}

Read-Host "Press Enter to close"
