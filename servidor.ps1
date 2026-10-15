# Servidor HTTP Local para MOTO TEAM BIKER BARINAS
# Permite acceder desde la computadora y desde cualquier teléfono en la misma red Wi-Fi

$Puerto = 8080
$Directorio = $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host " PRIMER ANIVERSARIO MOTO TEAM BIKER BARINAS" -ForegroundColor Yellow
Write-Host " Servidor Web Local para Control de Acceso y PWA" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Yellow

# Obtener IPs locales
$IPs = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -notmatch 'Loopback|vEthernet' }).IPAddress

Write-Host "`nServidor activo en:" -ForegroundColor Green
Write-Host "  Computadora local:  http://localhost:$Puerto" -ForegroundColor White
foreach ($ip in $IPs) {
    Write-Host "  Teléfonos móviles:  http://${ip}:$Puerto" -ForegroundColor Yellow
}
Write-Host "`nPara detener el servidor, presione Ctrl + C`n" -ForegroundColor DarkGray

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://*:$Puerto/")

try {
    $listener.Start()
} catch {
    # Si requiere permisos de administrador para wildcard, usar localhost
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Clear()
    $listener.Prefixes.Add("http://localhost:$Puerto/")
    $listener.Start()
    Write-Host "Iniciado solo en localhost por permisos. Para acceso en red ejecute PowerShell como Administrador." -ForegroundColor DarkYellow
}

# Tipos MIME
$mimeMap = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".webmanifest" = "application/manifest+json"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".ico"  = "image/x-icon"
}

while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $response = $context.Response

    $path = $request.Url.LocalPath.TrimStart('/')
    if ([string]::IsNullOrEmpty($path)) {
        $path = "index.html"
    }

    $filePath = Join-Path $Directorio $path

    if (Test-Path $filePath -PathType Leaf) {
        $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
        $contentType = $mimeMap[$ext]
        if (-not $contentType) { $contentType = "application/octet-stream" }

        $response.ContentType = $contentType
        $response.AddHeader("Access-Control-Allow-Origin", "*")
        $response.AddHeader("Cache-Control", "no-cache")

        $bytes = [System.IO.File]::ReadAllBytes($filePath)
        $response.ContentLength64 = $bytes.Length
        $response.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
        $response.StatusCode = 404
        $notFoundBytes = [System.Text.Encoding]::UTF8.GetBytes("404 - Archivo no encontrado")
        $response.OutputStream.Write($notFoundBytes, 0, $notFoundBytes.Length)
    }

    $response.OutputStream.Close()
}
