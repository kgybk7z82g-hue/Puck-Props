@echo off
setlocal
if /i not "%~1"=="--background" (
  wscript.exe "%~dp0start-hidden.vbs" "%~f0"
  exit /b
)
cd /d "%~dp0"
set "HOST=127.0.0.1"
set "PORT=4173"
where node >nul 2>nul
if errorlevel 1 (
  powershell.exe -NoProfile -WindowStyle Hidden -Command "Add-Type -AssemblyName PresentationFramework;[System.Windows.MessageBox]::Show('Node.js is required to run the NHL data connection. Install Node.js, then start Puck Props again.','Puck Props') | Out-Null"
  exit /b 1
)
powershell.exe -NoProfile -WindowStyle Hidden -Command "$nodePath=(Get-Command node).Source; Start-Process -FilePath $nodePath -ArgumentList 'server.js' -WorkingDirectory '%CD%' -WindowStyle Hidden"
for /L %%i in (1,1,15) do (
  curl.exe --silent --fail --max-time 1 http://127.0.0.1:4173/api/health > "%TEMP%\puck-props-health.json" 2>nul
  if not errorlevel 1 findstr.exe /r /c:version.*17 "%TEMP%\puck-props-health.json" >nul 2>nul
  if not errorlevel 1 goto server_ready
  timeout /t 1 /nobreak >nul
)
powershell.exe -NoProfile -WindowStyle Hidden -Command "Add-Type -AssemblyName PresentationFramework;[System.Windows.MessageBox]::Show('Puck Props could not start its data connection. Another server may be using port 4173. Close it and try again.','Puck Props') | Out-Null"
exit /b 1
:server_ready
start "" http://127.0.0.1:4173/
