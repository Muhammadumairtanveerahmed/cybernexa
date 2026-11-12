@echo off
title TechNexa - Starting Servers
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-all.ps1"
echo.
echo Browser khol raha hoon...
start "" "http://localhost:5173/"
echo.
pause
