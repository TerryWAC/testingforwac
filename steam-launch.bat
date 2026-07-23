@echo off
rem Steam launch wrapper: starts the watcher hidden, then launches Deadlock.
rem Used via Steam Launch Options (run Link-With-Steam.bat for the exact line):
rem   "C:\path\to\steam-launch.bat" %command% -condebug
wscript.exe "%~dp0run-hidden.vbs"
%*
