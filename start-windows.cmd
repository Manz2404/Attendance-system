@echo off
setlocal
cd /d "%~dp0"
if not exist "node_modules" goto setup_required
if not exist ".next\BUILD_ID" goto setup_required
call npm start
if errorlevel 1 pause
exit /b
:setup_required
echo Run setup-windows.cmd first.
pause
exit /b 1
