# David & Goliath offline server.
# Serves the "app" folder next to this script on http://localhost:<Port>/ .
# Uses only what ships with Windows (PowerShell 5.1 / .NET Framework). No install needed.
# Keep this file ASCII-only: Windows PowerShell 5.1 reads BOM-less files as ANSI.

param([int]$Port = 8723)

$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'app'))

$mime = @{
  '.html' = 'text/html; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'
  '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.wasm' = 'application/wasm'
  '.task' = 'application/octet-stream'
  '.png' = 'image/png'
  '.jpg' = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.svg' = 'image/svg+xml'
  '.ico' = 'image/x-icon'
  '.woff2' = 'font/woff2'
  '.woff' = 'font/woff'
  '.txt' = 'text/plain; charset=utf-8'
}

# Map a request path to a file inside $root. Unknown paths without an extension fall back to index.html.
function Resolve-AppFile([string]$rawPath) {
  $path = [System.Uri]::UnescapeDataString(($rawPath -split '\?')[0])
  if ($path -eq '' -or $path.EndsWith('/')) { $path = $path + 'index.html' }
  $rel = $path.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
  $full = [System.IO.Path]::GetFullPath((Join-Path $root $rel))
  if (-not $full.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) { return $null }
  if ([System.IO.File]::Exists($full)) { return $full }
  if ([System.IO.Path]::GetExtension($full) -eq '') { return (Join-Path $root 'index.html') }
  return $null
}

function Get-Mime([string]$file) {
  $ext = [System.IO.Path]::GetExtension($file).ToLowerInvariant()
  if ($mime.ContainsKey($ext)) { return $mime[$ext] }
  return 'application/octet-stream'
}

# Preferred: HttpListener (http.sys handles many connections at once).
# http://localhost:<port>/ does not need administrator rights.
$listener = $null
try {
  $listener = New-Object System.Net.HttpListener
  $listener.Prefixes.Add("http://localhost:$Port/")
  $listener.Start()
} catch {
  $listener = $null
}

if ($listener) {
  Write-Host "David & Goliath server: http://localhost:$Port/ (HttpListener)"
  while ($listener.IsListening) {
    try {
      $ctx = $listener.GetContext()
      $res = $ctx.Response
      try {
        $file = Resolve-AppFile $ctx.Request.RawUrl
        if ($null -eq $file) {
          $res.StatusCode = 404
        } else {
          $res.ContentType = Get-Mime $file
          $res.Headers.Add('Cache-Control', 'no-cache')
          $info = New-Object System.IO.FileInfo($file)
          $res.ContentLength64 = $info.Length
          if ($ctx.Request.HttpMethod -ne 'HEAD') {
            $fs = [System.IO.File]::OpenRead($file)
            try { $fs.CopyTo($res.OutputStream) } finally { $fs.Dispose() }
          }
        }
      } catch {
        try { $res.StatusCode = 500 } catch {}
      } finally {
        try { $res.OutputStream.Close() } catch {}
      }
    } catch {
      Start-Sleep -Milliseconds 50
    }
  }
  exit 0
}

# Fallback: plain TCP socket, one connection at a time.
$tcp = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $Port)
try {
  $tcp.Start()
} catch {
  Write-Host "Port $Port is busy. The server is probably already running."
  exit 0
}
Write-Host "David & Goliath server: http://localhost:$Port/ (TCP)"
while ($true) {
  $client = $tcp.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 1500
    $client.SendTimeout = 10000
    $stream = $client.GetStream()
    $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::ASCII, $false, 8192, $true)
    $line = $reader.ReadLine()
    if ($line) {
      while ($true) {
        $h = $reader.ReadLine()
        if ($null -eq $h -or $h -eq '') { break }
      }
      $parts = $line -split ' '
      $method = $parts[0]
      $file = $null
      if ($parts.Length -ge 2) { $file = Resolve-AppFile $parts[1] }
      if ($null -eq $file) {
        $head = "HTTP/1.1 404 Not Found`r`nContent-Length: 0`r`nConnection: close`r`n`r`n"
        $bytes = [System.Text.Encoding]::ASCII.GetBytes($head)
        $stream.Write($bytes, 0, $bytes.Length)
      } else {
        $info = New-Object System.IO.FileInfo($file)
        $head = "HTTP/1.1 200 OK`r`nContent-Type: $(Get-Mime $file)`r`nContent-Length: $($info.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
        $bytes = [System.Text.Encoding]::ASCII.GetBytes($head)
        $stream.Write($bytes, 0, $bytes.Length)
        if ($method -ne 'HEAD') {
          $fs = [System.IO.File]::OpenRead($file)
          try { $fs.CopyTo($stream) } finally { $fs.Dispose() }
        }
      }
      $stream.Flush()
    }
  } catch {
  } finally {
    $client.Close()
  }
}
