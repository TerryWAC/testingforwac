@echo off
title Create Desktop Shortcut
powershell -NoProfile -Command ^
  "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\Deadlock Match Ping.lnk');" ^
  "$s.TargetPath='%~dp0Start-Deadlock-Match-Ping.bat';" ^
  "$s.WorkingDirectory='%~dp0';" ^
  "$s.IconLocation='%~dp0assets\icon.ico';" ^
  "$s.Description='Pings you when your Deadlock match pops';" ^
  "$s.Save()"
if errorlevel 1 (echo Could not create the shortcut.) else (echo Desktop shortcut created with the app icon.)
pause
