@echo off
title Deadlock Match Ping
cd /d "%~dp0"
if exist "%~dp0DeadlockMatchPing.exe" (
  "%~dp0DeadlockMatchPing.exe"
  pause
  exit /b
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it with one command:
  echo.
  echo     winget install OpenJS.NodeJS.LTS
  echo.
  echo ...then double-click this file again.
  pause
  exit /b 1
)
node watch.js
pause
