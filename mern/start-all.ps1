# TechNexa - start MySQL + API + Vite
$ErrorActionPreference = 'Continue'
$logDir = "$env:LOCALAPPDATA\Temp\opencode\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

$node = "$env:LOCALAPPDATA\Temp\technexa-node\node-v20.18.1-win-x64\node.exe"
$proj = 'C:\Users\Muhammad Umair\Documents\Default Project\mern'

function Test-Port($port) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $c.Connect('127.0.0.1', $port)
    $ok = $c.Connected
    $c.Close()
    return $ok
  } catch { return $false }
}

# 1) MySQL
if (-not (Test-Port 3306)) {
  Write-Host 'Starting MySQL...'
  Start-Process -FilePath 'C:\xampp\mysql\bin\mysqld.exe' `
    -ArgumentList '--defaults-file=C:\xampp\mysql\bin\my.ini', '--console' `
    -WorkingDirectory 'C:\xampp\mysql\bin' -WindowStyle Hidden `
    -RedirectStandardOutput "$logDir\mysql.out.log" -RedirectStandardError "$logDir\mysql.err.log"
  for ($i = 0; $i -lt 30; $i++) { Start-Sleep -Seconds 1; if (Test-Port 3306) { break } }
} else { Write-Host 'MySQL already running.' }

# 2) API
if (-not (Test-Port 5000)) {
  Write-Host 'Starting API...'
  Start-Process -FilePath $node -ArgumentList 'src/server.js' `
    -WorkingDirectory "$proj\server" -WindowStyle Hidden `
    -RedirectStandardOutput "$logDir\api.out.log" -RedirectStandardError "$logDir\api.err.log"
} else { Write-Host 'API already running.' }

# 3) Vite client
if (-not (Test-Port 5173)) {
  Write-Host 'Starting Vite...'
  Start-Process -FilePath $node `
    -ArgumentList "`"$proj\node_modules\vite\bin\vite.js`"", '--host', '0.0.0.0', '--port', '5173' `
    -WorkingDirectory "$proj\client" -WindowStyle Hidden `
    -RedirectStandardOutput "$logDir\vite.out.log" -RedirectStandardError "$logDir\vite.err.log"
} else { Write-Host 'Vite already running.' }

for ($i = 0; $i -lt 30; $i++) {
  Start-Sleep -Seconds 1
  if ((Test-Port 5000) -and (Test-Port 5173)) { break }
}

Write-Host ''
Write-Host ('MySQL 3306 : ' + (Test-Port 3306))
Write-Host ('API   5000 : ' + (Test-Port 5000))
Write-Host ('Vite  5173 : ' + (Test-Port 5173))
Write-Host ''
Write-Host 'Website : http://localhost:5173/'
Write-Host 'API     : http://localhost:5000/api/health'
Write-Host ''
if ((Test-Port 5000) -and (Test-Port 5173)) { Write-Host 'READY - sab kuch chal raha hai.' }
else { Write-Host "Kuch start nahi hua. Logs dekhein: $logDir" }
