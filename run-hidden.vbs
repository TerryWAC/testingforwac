' Starts the Deadlock Match Ping watcher with NO console window.
' All status arrives via notifications; a second copy exits by itself.
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = dir
If fso.FileExists(dir & "\DeadlockMatchPing.exe") Then
  sh.Run """" & dir & "\DeadlockMatchPing.exe"" --announce", 0, False
Else
  sh.Run "cmd /c node """ & dir & "\watch.js"" --announce", 0, False
End If
