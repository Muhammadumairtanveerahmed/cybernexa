@echo off
setlocal
title TechNexa - Start Development Servers

set "NODE_DIR=%LOCALAPPDATA%\Temp\technexa-node\node-v20.18.1-win-x64"
set "PATH=%NODE_DIR%;%PATH%"
cd /d "%~dp0"

echo Starting TechNexa local development environment...
echo.

rem Start MySQL only when port 3306 is not already listening.
netstat -an | findstr ":3306" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo Starting MySQL...
  start "TechNexa MySQL" /min "C:\xampp\mysql\bin\mysqld.exe" --defaults-file=C:\xampp\mysql\bin\my.ini --standalone
  timeout /t 5 /nobreak >nul
) else (
  echo MySQL is already running.
)

rem Start the API only when port 5000 is not already listening.
netstat -an | findstr ":5000" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo Starting API server...
  start "TechNexa API" cmd /k "cd /d ""%~dp0server"" && node src/server.js"
  timeout /t 3 /nobreak >nul
) else (
  echo API server is already running.
)

rem Start Vite only when port 5173 is not already listening.
netstat -an | findstr ":5173" | findstr "LISTENING" >nul
if errorlevel 1 (
  echo Starting React dev server...
  start "TechNexa Vite" cmd /k "cd /d ""%~dp0client"" && node ..\node_modules\vite\bin\vite.js --host 0.0.0.0 --port 5173"
  timeout /t 6 /nobreak >nul
) else (
  echo React dev server is already running.
)

echo.
echo Opening http://127.0.0.1:5173
start "" "http://127.0.0.1:5173"
echo.
echo Done. Keep the API and Vite windows open while testing.
pause
endlocal
