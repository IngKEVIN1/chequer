# =============================================================================
# servidor-local.ps1 - Servidor web minimo para usar la app en Windows con
# http://localhost (necesario para OCR, modo sin conexion e instalacion).
# Usa solo PowerShell, que ya viene en Windows. No instala nada.
# Solo acepta conexiones de ESTA computadora (localhost).
# Uso: doble clic en INICIAR-SERVIDOR.bat   (o: .\servidor-local.ps1 -Puerto 8081)
# Para detenerlo: cierre esta ventana o presione Ctrl+C.
# =============================================================================
param([int]$Puerto = 8080)

$raiz = [System.IO.Path]::GetFullPath($PSScriptRoot)
if (-not $raiz.EndsWith('\')) { $raiz += '\' }

$tipos = @{
  '.html' = 'text/html; charset=utf-8'
  '.js'   = 'application/javascript; charset=utf-8'
  '.css'  = 'text/css; charset=utf-8'
  '.json' = 'application/json; charset=utf-8'
  '.webmanifest' = 'application/manifest+json'
  '.png'  = 'image/png'
  '.jpg'  = 'image/jpeg'
  '.jpeg' = 'image/jpeg'
  '.svg'  = 'image/svg+xml'
  '.ico'  = 'image/x-icon'
  '.wasm' = 'application/wasm'
  '.gz'   = 'application/octet-stream'
  '.md'   = 'text/plain; charset=utf-8'
  '.txt'  = 'text/plain; charset=utf-8'
}

$prefijo = "http://localhost:$Puerto/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefijo)
try {
  $listener.Start()
} catch {
  Write-Host "No se pudo iniciar el servidor en el puerto $Puerto." -ForegroundColor Red
  Write-Host "Puede que ya este abierto en otra ventana. Pruebe otro puerto:" -ForegroundColor Yellow
  Write-Host "  powershell -ExecutionPolicy Bypass -File servidor-local.ps1 -Puerto 8081"
  exit 1
}

Write-Host ""
Write-Host " Reubicacion de material - servidor local" -ForegroundColor Green
Write-Host " Direccion: $($prefijo)index.html"
Write-Host " Carpeta:   $raiz"
Write-Host " Deje esta ventana abierta mientras usa la app. Ctrl+C o cerrar ventana para detener."
Write-Host ""
Start-Process ($prefijo + 'index.html')

try {
  while ($listener.IsListening) {
    $tarea = $listener.GetContextAsync()
    while (-not $tarea.AsyncWaitHandle.WaitOne(500)) { }
    $ctx = $tarea.GetAwaiter().GetResult()
    $resp = $ctx.Response
    try {
      $ruta = [System.Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ([string]::IsNullOrWhiteSpace($ruta)) { $ruta = 'index.html' }
      $archivo = [System.IO.Path]::GetFullPath((Join-Path $raiz $ruta))
      if (Test-Path -LiteralPath $archivo -PathType Container) { $archivo = Join-Path $archivo 'index.html' }
      if (-not $archivo.StartsWith($raiz, [System.StringComparison]::OrdinalIgnoreCase)) {
        $resp.StatusCode = 403
      } elseif (Test-Path -LiteralPath $archivo -PathType Leaf) {
        $bytes = [System.IO.File]::ReadAllBytes($archivo)
        $ext = [System.IO.Path]::GetExtension($archivo).ToLowerInvariant()
        if ($tipos.ContainsKey($ext)) { $resp.ContentType = $tipos[$ext] } else { $resp.ContentType = 'application/octet-stream' }
        $resp.Headers.Add('Cache-Control', 'no-cache')
        $resp.ContentLength64 = $bytes.Length
        $resp.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $resp.StatusCode = 404
      }
    } catch {
      try { $resp.StatusCode = 500 } catch { }
    } finally {
      try { $resp.OutputStream.Close() } catch { }
    }
  }
} finally {
  $listener.Stop()
}
