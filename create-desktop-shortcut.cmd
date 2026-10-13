@echo off
setlocal
cd /d "%~dp0"
set "HADIR_SHORTCUT_PROJECT=%~dp0"
if not exist "start-windows.cmd" goto missing
powershell.exe -NoProfile -NonInteractive -Command "$ErrorActionPreference='Stop'; $project=$env:HADIR_SHORTCUT_PROJECT; $desktop=if($env:HADIR_SHORTCUT_DIRECTORY){$env:HADIR_SHORTCUT_DIRECTORY}else{[Environment]::GetFolderPath('DesktopDirectory')}; if(-not $desktop){throw 'Windows could not locate your Desktop.'}; [IO.Directory]::CreateDirectory($desktop) | Out-Null; $shell=New-Object -ComObject WScript.Shell; $link=$shell.CreateShortcut((Join-Path $desktop 'Hadir Attendance.lnk')); $link.TargetPath=Join-Path $project 'start-windows.cmd'; $link.WorkingDirectory=$project; $link.Description='Start Hadir Attendance and open it in your browser'; $link.Save(); Write-Host 'Created the Hadir Attendance desktop shortcut.'"
if errorlevel 1 goto failed
echo Double-click Hadir Attendance on your Desktop to start and open the system.
if /I not "%~1"=="--quiet" pause
exit /b 0
:missing
echo Keep this file inside your Attendance-system folder beside start-windows.cmd.
if /I not "%~1"=="--quiet" pause
exit /b 1
:failed
echo Could not create the shortcut. You can still use start-windows.cmd directly.
if /I not "%~1"=="--quiet" pause
exit /b 1
