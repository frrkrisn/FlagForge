# Starts the FlagForge backend (and the built website) on http://localhost:8080.
#
#   powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\start-backend.ps1 -Data data\other -Port 8081
#
# ctf_server.exe needs the MSYS2 runtime DLLs (OpenSSL, zlib, brotli). Without this folder on PATH
# Windows refuses to start it silently with exit code -1073741515 (DLL not found).
param(
    [string]$Data = "data\demo",
    [int]$Port = 8080,
    [string]$Msys = "C:\msys64\ucrt64\bin"
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not (Test-Path "$Msys\libssl-3-x64.dll")) {
    Write-Error "MSYS2 runtime not found in $Msys. Install MSYS2 UCRT64 or pass -Msys <folder>."
    exit 1
}
if (-not (Test-Path ".\build\bin\ctf_server.exe")) {
    Write-Error "build\bin\ctf_server.exe is missing. Build first: cmake --build build -j 2"
    exit 1
}

$env:PATH = "$Msys;$env:PATH"
Write-Host "FlagForge backend: http://localhost:$Port  (data: $Data)  Ctrl+C to stop"
& .\build\bin\ctf_server.exe --port $Port --data $Data --web frontend\dist --secret-file "$Data-secret.txt"
Write-Host "Backend exited with code $LASTEXITCODE"
