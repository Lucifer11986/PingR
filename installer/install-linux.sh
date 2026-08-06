#!/bin/bash
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo "  ██████╗ ██╗███╗   ██╗ ██████╗ ██████╗ "
echo "  ██╔══██╗██║████╗  ██║██╔════╝ ██╔══██╗"
echo "  ██████╔╝██║██╔██╗ ██║██║  ███╗██████╔╝"
echo "  ██╔═══╝ ██║██║╚██╗██║██║   ██║██╔══██╗"
echo "  ██║     ██║██║ ╚████║╚██████╔╝██║  ██║"
echo "  ╚═╝     ╚═╝╚═╝  ╚═══╝ ╚═════╝ ╚═╝  ╚═╝"
echo ""
echo -e "${GREEN}  Instant Messenger – Installer${NC}"
echo ""

# ── Prüfungen ────────────────────────────────────────────────────────────────

check_command() {
  if ! command -v "$1" &>/dev/null; then
    echo -e "${RED}✗ $1 nicht gefunden${NC}"
    return 1
  fi
  echo -e "${GREEN}✓ $1 verfügbar${NC}"
  return 0
}

echo "Prüfe Voraussetzungen..."

if ! check_command docker; then
  echo -e "${YELLOW}→ Docker wird installiert...${NC}"
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo -e "${GREEN}✓ Docker installiert – bitte neu anmelden und Installer erneut starten${NC}"
  exit 0
fi

if ! docker compose version &>/dev/null; then
  echo -e "${YELLOW}→ Docker Compose Plugin wird installiert...${NC}"
  DOCKER_CONFIG="${DOCKER_CONFIG:-$HOME/.docker}"
  mkdir -p "$DOCKER_CONFIG/cli-plugins"
  curl -SL "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" \
    -o "$DOCKER_CONFIG/cli-plugins/docker-compose"
  chmod +x "$DOCKER_CONFIG/cli-plugins/docker-compose"
fi

# ── .env anlegen ─────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

if [ ! -f .env ]; then
  echo -e "${YELLOW}→ .env wird erstellt...${NC}"
  cp .env.example .env
  # Zufälligen JWT_SECRET generieren
  JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || cat /proc/sys/kernel/random/uuid | tr -d '-')
  sed -i "s/aendere_mich_zu_einem_sicheren_zufaelligen_wert/$JWT_SECRET/" .env
  echo -e "${GREEN}✓ .env mit sicherem JWT_SECRET erstellt${NC}"
fi

# ── ICQ-Sound prüfen ─────────────────────────────────────────────────────────

if [ ! -f frontend/public/sounds/icq-ding.mp3 ]; then
  echo -e "${YELLOW}⚠  ICQ-Sound nicht gefunden${NC}"
  echo "   Lege die Dateien manuell ab:"
  echo "   → frontend/public/sounds/icq-ding.mp3"
  echo "   → frontend/public/sounds/icq-door.mp3"
  echo ""
fi

# ── Docker-Stack starten ──────────────────────────────────────────────────────

echo ""
echo -e "${GREEN}→ Nokki wird gestartet (erster Start kann einige Minuten dauern)...${NC}"
docker compose up -d --build

# ── Warten bis App erreichbar ────────────────────────────────────────────────

echo -n "   Warte auf App"
for i in $(seq 1 30); do
  if curl -sf http://localhost:3000 &>/dev/null; then
    echo ""
    break
  fi
  echo -n "."
  sleep 2
done

echo ""
echo -e "${GREEN}╔══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅  Nokki läuft!                    ║${NC}"
echo -e "${GREEN}║                                      ║${NC}"
echo -e "${GREEN}║  🌐  http://localhost:3000            ║${NC}"
echo -e "${GREEN}║  🔌  API:  http://localhost:3002      ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════╝${NC}"
echo ""

# Browser öffnen (optional)
if command -v xdg-open &>/dev/null; then
  xdg-open http://localhost:3000 &>/dev/null &
elif command -v open &>/dev/null; then
  open http://localhost:3000
fi
