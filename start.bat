@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 18 or newer is required: https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies - first run...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
rem The server runs in its own console window. Pressing Ctrl+C or closing that window stops it at once,
rem without cmd's "Terminate batch job (Y/N)?" question, which only appears when a batch file is running.
start "Meow Image Compressor" node scripts\start.mjs --pause-on-error %*
