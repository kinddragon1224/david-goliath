@echo off
rem David & Goliath - one-time setup: auto start at login, desktop shortcut, no sleep
setlocal
set "HERE=%~dp0"
echo Setting up David ^& Goliath ...

rem Remove the "downloaded from internet" mark so Windows does not block the scripts
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath '%HERE%' -Recurse | Unblock-File" >nul 2>&1

rem Shortcuts: Startup folder (auto start) + Desktop
powershell -NoProfile -ExecutionPolicy Bypass -Command "$w=New-Object -ComObject WScript.Shell; foreach($d in @([Environment]::GetFolderPath('Startup'),[Environment]::GetFolderPath('Desktop'))){ $s=$w.CreateShortcut((Join-Path $d 'DavidGoliath.lnk')); $s.TargetPath='%HERE%start.bat'; $s.WorkingDirectory='%HERE%'; $s.WindowStyle=7; $s.Save() }"

rem Never turn off the screen or sleep while plugged in
powercfg /change monitor-timeout-ac 0 >nul 2>&1
powercfg /change standby-timeout-ac 0 >nul 2>&1
powercfg /change hibernate-timeout-ac 0 >nul 2>&1

echo.
echo Done. The game will start automatically when this PC logs in.
echo Starting now ...
call "%HERE%start.bat"
