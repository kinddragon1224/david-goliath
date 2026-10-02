@echo off
rem David & Goliath - remove auto start and desktop shortcut (records are kept)
powershell -NoProfile -ExecutionPolicy Bypass -Command "foreach($d in @([Environment]::GetFolderPath('Startup'),[Environment]::GetFolderPath('Desktop'))){ Remove-Item -LiteralPath (Join-Path $d 'DavidGoliath.lnk') -ErrorAction SilentlyContinue }"
call "%~dp0stop.bat"
echo Auto start removed. Records in this PC are kept.
pause
