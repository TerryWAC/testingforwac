@echo off
title Link Deadlock Match Ping with Steam
setlocal
if exist "%~dp0DeadlockMatchPing.exe" (
  set "LINE="%~dp0DeadlockMatchPing.exe" --steam %%command%% -condebug"
) else (
  set "LINE="%~dp0steam-launch.bat" %%command%% -condebug"
)
echo %LINE%| clip
echo.
echo  The launch-options line has been COPIED TO YOUR CLIPBOARD:
echo.
echo    %LINE%
echo.
echo  Now link it in Steam (30 seconds):
echo    1. Steam - right-click Deadlock - Properties
echo    2. General tab - Launch Options box
echo    3. DELETE what's there now (your old -condebug is included in the new line)
echo    4. Paste (Ctrl+V) and close the window
echo.
echo  Done. From now on, launching Deadlock auto-starts the watcher in the
echo  background - no black window, no .bat to remember.
echo.
pause
