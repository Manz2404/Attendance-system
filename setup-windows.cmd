@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 goto node_missing
node -e "const [a,b]=process.versions.node.split('.').map(Number);if(a<22||(a===22&&b<13)){console.error('Install Node.js 22.13 or newer.');process.exit(1)}"
if errorlevel 1 goto failed
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo Enter your MySQL details in .env. Save the file and close Notepad.
  notepad ".env"
  echo When your .env is saved, press any key to continue.
  pause >nul
)
call npm install --no-audit --no-fund
if errorlevel 1 goto failed
call npm run setup
if errorlevel 1 goto failed
call npm run build
if errorlevel 1 goto failed
echo.
echo Ready. Double-click start-windows.cmd to start Attendance and open your browser.
echo Optional: run create-desktop-shortcut.cmd once to add a Hadir Attendance desktop icon.
pause
exit /b 0
:node_missing
echo Install the Node.js LTS Windows installer from https://nodejs.org/en/download
echo Then close this window and run setup-windows.cmd again.
pause
exit /b 1
:failed
echo.
echo Setup stopped. Review the message above, fix it, then run this file again.
pause
exit /b 1
