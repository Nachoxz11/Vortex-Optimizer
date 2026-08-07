$ErrorActionPreference = 'Stop'

$bundleDir = Join-Path $PSScriptRoot '..\src-tauri\target\release\bundle\nsis'
$packageJson = Join-Path $PSScriptRoot '..\package.json'
$version = (Get-Content -Raw -LiteralPath $packageJson | ConvertFrom-Json).version
$source = Join-Path $bundleDir "Vortex-Optimizer_${version}_x64-setup.exe"
$target = Join-Path $bundleDir "Vortex-Optimizer-${version}-setup.exe"

if (-not (Test-Path -LiteralPath $source)) {
  throw "No se encontró el instalador generado: $source"
}

if (Test-Path -LiteralPath $target) {
  Remove-Item -LiteralPath $target -Force
}

Move-Item -LiteralPath $source -Destination $target
Write-Host "Instalador generado: $target"
