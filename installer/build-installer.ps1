#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$DesktopDir = Join-Path $PSScriptRoot "electron"
Set-Location $DesktopDir

npm ci
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

npm run build:win
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Nokki-Installer erstellt: $(Join-Path $PSScriptRoot '..\desktop-dist')" -ForegroundColor Green

