@echo off
setlocal
cd /d "%~dp0"
title Hadir - private Render database connection
node scripts\share-render-database.mjs %*
if errorlevel 1 (
  pause
  exit /b 1
)
pause
