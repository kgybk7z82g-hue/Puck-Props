@echo off
setlocal
cd /d "%~dp0"
set "HOST=127.0.0.1"
set "PORT=4173"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to run the NHL data connection.
  echo Install Node.js, then double-click start.bat again.
  pause
  exit /b 1
)
start "Puck Props server" cmd /k node server.js
for /L %%i in (1,1,15) do (
  curl.exe --silent --fail --max-time 1 http://127.0.0.1:4173/api/health > "%TEMP%\puck-props-health.json" 2>nul
  if not errorlevel 1 findstr.exe /r /c:version.13 "%TEMP%\puck-props-health.json" >nul 2>nul
  if not errorlevel 1 goto server_ready
  timeout /t 1 /nobreak >nul
)
echo Puck Props could not start its data server.
echo An older server may already be using port 4173.
echo Close older Puck Props server windows, then run start.bat again.
echo Keep the server window open while using the app.
pause
exit /b 1
:server_ready
start "" http://127.0.0.1:4173/
