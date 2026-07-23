@echo off
title Deadlock Match Ping — Setup
cd /d "%~dp0"

if exist "%~dp0DeadlockMatchPing.exe" (
  "%~dp0DeadlockMatchPing.exe" --setup
  goto :extras
)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed. Install it with one command:
  echo.
  echo     winget install OpenJS.NodeJS.LTS
  echo.
  echo ...then double-click Setup.bat again.
  pause
  exit /b 1
)
node watch.js --setup
:extras

echo.
echo ----------------------------------------------------------------------
echo  Finishing touches
echo ----------------------------------------------------------------------
echo.

choice /c YN /m "Create a desktop shortcut (with the app icon)"
if not errorlevel 2 (
  powershell -NoProfile -Command ^
    "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Deadlock Match Ping.lnk');" ^
    "$s.TargetPath='%~dp0Start-Deadlock-Match-Ping.bat';" ^
    "$s.WorkingDirectory='%~dp0';" ^
    "$s.IconLocation='%~dp0assets\icon.ico';" ^
    "$s.Description='Pings you when your Deadlock match pops';" ^
    "$s.Save()" && echo   Desktop shortcut created.
)

echo.
set "LINE="%~dp0steam-launch.bat" %%command%% -condebug"
echo %LINE%| clip
echo  RECOMMENDED — link with Steam so the watcher starts itself with the game.
echo  This line is already COPIED TO YOUR CLIPBOARD:
echo.
echo    %LINE%
echo.
echo  In Steam: right-click Deadlock - Properties - General - Launch Options:
echo  delete what's there and paste (Ctrl+V). That's it — the watcher will
echo  start hidden every time you launch Deadlock, with no window to manage.
echo.
echo  Setup complete. Good luck in your queues!
pause
