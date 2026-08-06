#Requires -Version 5.1
$ErrorActionPreference = "Stop"

$Banner = @"

  ██████╗ ██╗███╗   ██╗ ██████╗ ██████╗
  ██╔══██╗██║████╗  ██║██╔════╝ ██╔══██╗
  ██████╔╝██║██╔██╗ ██║██║  ███╗██████╔╝
  ██╔═══╝ ██║██║╚██╗██║██║   ██║██╔══██╗
  ██║     ██║██║ ╚████║╚██████╔╝██║  ██║
  ╚═╝     ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝

  Instant Messenger – Windows Installer
"@

Write-Host $Banner -ForegroundColor Cyan

# ── Docker prüfen ─────────────────────────────────────────────────────────────

Write-Host "`nPrüfe Voraussetzungen..." -ForegroundColor Yellow

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "✗ Docker Desktop nicht gefunden." -ForegroundColor Red
    Write-Host ""
    Write-Host "Bitte Docker Desktop installieren:" -ForegroundColor Yellow
    Write-Host "  https://www.docker.com/products/docker-desktop" -ForegroundColor Cyan
    Write-Host ""
    $open = Read-Host "Seite jetzt öffnen? (j/n)"
    if ($open -eq 'j') {
        Start-Process "https://www.docker.com/products/docker-desktop"
    }
    Write-Host "Nach der Installation dieses Skript erneut ausführen." -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Docker gefunden" -ForegroundColor Green

# Docker läuft?
$dockerRunning = docker info 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "→ Docker Desktop wird gestartet..." -ForegroundColor Yellow
    Start-Process "Docker Desktop" -ErrorAction SilentlyContinue
    Write-Host "  Warte 15 Sekunden..."
    Start-Sleep -Seconds 15
}

# ── Projektverzeichnis ────────────────────────────────────────────────────────

$ScriptDir  = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectDir = Split-Path -Parent $ScriptDir
Set-Location $ProjectDir

# ── .env anlegen ─────────────────────────────────────────────────────────────

if (-not (Test-Path ".env")) {
    Write-Host "→ .env wird erstellt..." -ForegroundColor Yellow
    Copy-Item ".env.example" ".env"
    # Zufälligen JWT_SECRET generieren
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    $secret = [System.BitConverter]::ToString($bytes) -replace '-', '' | ToLower
    (Get-Content ".env") -replace 'aendere_mich_zu_einem_sicheren_zufaelligen_wert', $secret |
        Set-Content ".env"
    Write-Host "✓ .env mit sicherem JWT_SECRET erstellt" -ForegroundColor Green
}

# ── ICQ-Sound prüfen ─────────────────────────────────────────────────────────

if (-not (Test-Path "frontend\public\sounds\icq-ding.mp3")) {
    Write-Host ""
    Write-Host "⚠  ICQ-Sound-Dateien fehlen!" -ForegroundColor Yellow
    Write-Host "   Bitte manuell ablegen:" -ForegroundColor Yellow
    Write-Host "   → frontend\public\sounds\icq-ding.mp3" -ForegroundColor Cyan
    Write-Host "   → frontend\public\sounds\icq-door.mp3" -ForegroundColor Cyan
    Write-Host ""
}

# ── Docker-Stack starten ──────────────────────────────────────────────────────

Write-Host ""
Write-Host "→ Nokki wird gestartet (erster Start: einige Minuten)..." -ForegroundColor Green
docker compose up -d --build

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Docker Compose fehlgeschlagen." -ForegroundColor Red
    exit 1
}

# ── Warten bis App erreichbar ─────────────────────────────────────────────────

Write-Host "   Warte auf App..." -ForegroundColor Yellow
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $r = Invoke-WebRequest -Uri "http://localhost:3000" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Start-Sleep -Seconds 2
    Write-Host "   ." -NoNewline
}

Write-Host ""
Write-Host ""
Write-Host "╔══════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║  ✅  Nokki läuft!                    ║" -ForegroundColor Green
Write-Host "║                                      ║" -ForegroundColor Green
Write-Host "║  🌐  http://localhost:3000            ║" -ForegroundColor Green
Write-Host "║  🔌  API:  http://localhost:3002      ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""

Start-Process "http://localhost:3000"
