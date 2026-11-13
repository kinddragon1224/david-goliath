# David & Goliath self-update. start.bat runs this first at every start.
# If the web has a different version, download the install zip and copy it over this folder.
# Exit 3 = updated (start.bat restarts itself), anything else = keep going with what is installed.
# Records are not touched: they live in the browser profile under %LOCALAPPDATA%\DavidGoliath.
# Keep this file ASCII-only: Windows PowerShell 5.1 reads BOM-less files as ANSI.

$base = '{{UPDATE_URL}}'
if (-not $base -or $base.StartsWith('{{')) { exit 0 }  # editions without a web home do not update
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'  # the PS 5.1 progress bar makes downloads many times slower
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$here = $PSScriptRoot
$log = Join-Path $here 'update.log'
function Say([string]$m) { Add-Content -LiteralPath $log -Value ("{0:yyyy-MM-dd HH:mm:ss} {1}" -f (Get-Date), $m) }

try {
  $local = (Get-Content -Raw -LiteralPath (Join-Path $here 'app\version.txt')).Trim()
  # Wi-Fi can come up a little after login: try a few times before giving up for this start
  $remote = $null
  foreach ($i in 1..3) {
    try { $remote = ([string](Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 "$base/version.txt").Content).Trim(); break }
    catch { Start-Sleep -Seconds 3 }
  }
  if (-not $remote) { Say "no internet, keeping $local"; exit 0 }
  if ($remote -notmatch '^\d+(\.\d+)+$' -or $remote -eq $local) { exit 0 }

  Write-Host "Updating $local -> $remote ... (about 1 minute)"
  Say "update $local -> $remote"
  $tmp = Join-Path $env:TEMP "DavidGoliath-update"
  if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
  New-Item -ItemType Directory -Path $tmp | Out-Null
  $zip = Join-Path $tmp 'new.zip'
  Invoke-WebRequest -UseBasicParsing -TimeoutSec 300 "$base/pc" -OutFile $zip
  Expand-Archive -LiteralPath $zip -DestinationPath (Join-Path $tmp 'x') -Force
  $src = Join-Path $tmp 'x\DavidGoliath'
  $got = (Get-Content -Raw -LiteralPath (Join-Path $src 'app\version.txt')).Trim()
  if ($got -ne $remote) { throw "zip has $got, expected $remote" }

  # The old server keeps files open and serves the old version: stop it before copying
  Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'powershell.exe' -and $_.CommandLine -like '*server.ps1*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
  Start-Sleep -Seconds 1
  # ponytail: copies over in place; a failure halfway leaves mixed files until the next start retries
  robocopy $src $here /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "copy failed ($LASTEXITCODE)" }
  Get-ChildItem -LiteralPath $here -Recurse | Unblock-File
  Remove-Item -Recurse -Force $tmp
  Say "updated to $remote"
  exit 3
} catch {
  Say "update failed: $($_.Exception.Message)"
  exit 1
}
