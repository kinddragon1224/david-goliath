@echo off
rem David & Goliath - start (server + full-screen browser)
setlocal
set "PORT=8723"
set "HERE=%~dp0"
set "URL=http://localhost:%PORT%/?kiosk=1"
set "PROFILE=%LOCALAPPDATA%\DavidGoliath\browser"
set "PF86=%ProgramFiles(x86)%"

rem 1) Start the local server if it is not running yet (hidden window)
call :ping
if errorlevel 1 start "" /min powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%HERE%server.ps1" -Port %PORT%

rem 2) Wait until the server answers (up to about 20 seconds)
set /a TRIES=0
:wait
call :ping
if not errorlevel 1 goto ready
set /a TRIES+=1
if %TRIES% geq 20 goto ready
timeout /t 1 /nobreak >nul
goto wait
:ready

rem 3) Find Chrome, otherwise Edge (Edge ships with Windows 10/11)
set "BROWSER="
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%PF86%\Google\Chrome\Application\chrome.exe" set "BROWSER=%PF86%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%PF86%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%PF86%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER (
  echo Chrome or Edge was not found. Please install Google Chrome.
  pause
  exit /b 1
)

rem 4) Full-screen kiosk window with its own profile (records live in this profile)
start "" "%BROWSER%" --kiosk "%URL%" --user-data-dir="%PROFILE%" --no-first-run --no-default-browser-check --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required --disable-session-crashed-bubble --disable-features=Translate --overscroll-history-navigation=0 --noerrdialogs --disable-pinch
exit /b 0

:ping
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 'http://localhost:%PORT%/version.txt' | Out-Null; exit 0 } catch { exit 1 }"
exit /b %errorlevel%
