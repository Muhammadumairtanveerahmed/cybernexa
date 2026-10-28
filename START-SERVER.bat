@echo off
title TechNexa Solutions - Website Server + Live Link
cd /d "%~dp0"

echo ==========================================================
echo   TechNexa Solutions
echo   Website Server + Public Link - Starting...
echo ==========================================================
echo.

REM --- Start the website server (node) ---
where node >nul 2>nul
if %errorlevel%==0 (
    start "TechNexa-Server" /min cmd /k "node server.js"
) else (
    echo [ERROR] Node.js not found in PATH. Please install Node.js first.
    pause
    exit /b 1
)

timeout /t 3 /nobreak >nul

echo.
echo  Website is running at:      http://localhost:3000
echo  Admin panel:                http://localhost:3000/admin
echo                             (admin / admin123)
echo.
echo  Now starting the PUBLIC link...
echo  Keep this window OPEN - closing it stops your website link.
echo  The public URL appears below when ready (takes 5-30 seconds):
echo.

REM --- Start the public tunnel (try cloudflared first, then localhost.run backup) ---
if exist "%~dp0cloudflared.exe" (
    echo [1] Trying Cloudflare tunnel...
    "%~dp0cloudflared.exe" tunnel --url http://localhost:3000
    echo.
    echo [2] Cloudflare failed - starting backup tunnel (localhost.run)...
    ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes -R 80:localhost:3000 nokey@localhost.run
) else (
    echo [1] cloudflared.exe not found - using localhost.run tunnel...
    ssh -o StrictHostKeyChecking=no -o ServerAliveInterval=30 -o ExitOnForwardFailure=yes -R 80:localhost:3000 nokey@localhost.run
)

echo.
echo  Tunnel closed. Press any key to exit.
pause >nul