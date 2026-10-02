@echo off
rem David & Goliath - stop the local server (use before replacing files for an update)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*server.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"
echo Server stopped.
timeout /t 2 /nobreak >nul
