@echo off
title TechNexa - Grafana SSH Tunnel
setlocal

set "KEY=%USERPROFILE%\Downloads\cybernexa.pem"
if not exist "%KEY%" (
  echo Key nahi mili: %KEY%
  echo Apni cybernexa.pem file ka sahi path yahan set karein.
  pause
  exit /b 1
)

echo ============================================================
echo   TechNexa Monitoring - SSH Tunnel
echo   Grafana    : http://localhost:3001/d/technexa-server
echo   Prometheus : http://localhost:9090/targets
echo ============================================================
echo.
echo Ye window khol rakhein. Band karne ke liye window close karein.
echo.

ssh -i "%KEY%" -N -L 3001:127.0.0.1:3001 -L 9090:127.0.0.1:9090 ubuntu@54.161.79.42
pause
