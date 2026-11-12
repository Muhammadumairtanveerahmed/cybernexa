@echo off
title TechNexa - Monitoring (Prometheus + Grafana)
setlocal

echo ==========================================
echo   TechNexa Monitoring Stack
echo   Prometheus : http://localhost:9090
echo   Grafana    : http://localhost:3001
echo ==========================================
echo.

docker info >nul 2>&1
if errorlevel 1 (
  echo Docker Desktop start ho raha hai, please wait...
  if exist "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe" (
    start "" "%LOCALAPPDATA%\Programs\DockerDesktop\Docker Desktop.exe"
  ) else if exist "C:\Program Files\Docker\Docker\Docker Desktop.exe" (
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  ) else (
    echo Docker Desktop nahi mila. Pehle Docker Desktop install ya start karein.
    pause
    exit /b 1
  )

  :waitdocker
  timeout /t 5 /nobreak >nul
  docker info >nul 2>&1
  if errorlevel 1 goto waitdocker
  echo Docker engine ready.
)

echo.
echo Containers start ho rahe hain...
docker compose -f "%~dp0monitoring\docker-compose.monitoring.yml" up -d

echo.
echo Waiting for Grafana...
timeout /t 12 /nobreak >nul

echo.
echo Prometheus : http://localhost:9090
echo Grafana    : http://localhost:3001  (admin / technexa)
echo Dashboard  : http://localhost:3001/d/technexa-overview
echo.

start "" "http://localhost:3001/d/technexa-overview"
pause
