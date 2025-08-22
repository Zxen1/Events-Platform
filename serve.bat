@echo off
rem Simple script to serve this directory over HTTP using Python's built-in server
cd /d "%~dp0"

set PORT=%1
if "%PORT%"=="" set PORT=8000

echo Serving %CD% on port %PORT%
echo Open http://localhost:%PORT% in your browser.
start "" http://localhost:%PORT%

python -m http.server %PORT%

