#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# PingR TLS Setup — einmalig auf dem Server ausführen
# Server: 217.154.165.25 | Domain: lumestack.de
# ═══════════════════════════════════════════════════════════════════
# Ausführen: bash tls_setup.sh

set -e
echo "🔒 PingR TLS Setup startet…"

# ── Schritt 1: Certbot installieren ─────────────────────────────────
echo ""
echo "📦 Certbot installieren…"
apt-get update -qq
apt-get install -y certbot

# ── Schritt 2: Verzeichnis für ACME-Challenge ────────────────────────
mkdir -p /var/www/certbot

# ── Schritt 3: Nginx kurz auf Port 80 starten für Challenge ─────────
echo ""
echo "🌐 Nginx auf Port 80 für ACME-Challenge…"
# Nginx muss Port 80 erreichbar machen → temporär stoppen und mit minimalem Config starten
cd /opt/pingr
docker compose stop nginx 2>/dev/null || true

# Temporärer Nginx für Challenge
docker run -d --name nginx-tmp \
  -p 80:80 \
  -v /var/www/certbot:/var/www/certbot \
  nginx:alpine sh -c "echo 'server{listen 80;location /.well-known/acme-challenge/{root /var/www/certbot;}}' > /etc/nginx/conf.d/acme.conf && nginx -g 'daemon off;'" || true

sleep 2

# ── Schritt 4: Zertifikat holen ──────────────────────────────────────
echo ""
echo "🔑 Let's Encrypt Zertifikat für lumestack.de holen…"
certbot certonly \
  --webroot \
  --webroot-path /var/www/certbot \
  -d lumestack.de \
  -d www.lumestack.de \
  --email privacy@lumestack.de \
  --agree-tos \
  --non-interactive \
  --no-eff-email

# Temporären Nginx stoppen
docker stop nginx-tmp 2>/dev/null || true
docker rm   nginx-tmp 2>/dev/null || true

# ── Schritt 5: DH-Parameter generieren ──────────────────────────────
echo ""
echo "🔐 DH-Parameter generieren (dauert ~1 Minute)…"
if [ ! -f /etc/nginx/dhparam.pem ]; then
  openssl dhparam -out /etc/nginx/dhparam.pem 2048
  echo "✓ dhparam.pem erstellt"
else
  echo "ℹ dhparam.pem bereits vorhanden"
fi

# ── Schritt 6: nginx.conf an die richtige Stelle ────────────────────
echo ""
echo "📝 nginx.conf aktualisieren…"
cp /opt/pingr/nginx/nginx.conf /opt/pingr/nginx/nginx.conf.backup
# Die neue nginx.conf muss schon hochgeladen sein:
# scp nginx.conf root@217.154.165.25:/opt/pingr/nginx/nginx.conf

# ── Schritt 7: docker-compose.yml — Port 443 + Zertifikate einbinden ─
echo ""
echo "📋 docker-compose.yml prüfen…"
echo "   Stelle sicher dass nginx folgendes in docker-compose.yml hat:"
echo ""
echo "   nginx:"
echo "     ports:"
echo "       - '80:80'"
echo "       - '443:443'"
echo "     volumes:"
echo "       - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro"
echo "       - /etc/letsencrypt:/etc/letsencrypt:ro"
echo "       - /var/www/certbot:/var/www/certbot:ro"
echo "       - /etc/nginx/dhparam.pem:/etc/nginx/dhparam.pem:ro"

# ── Schritt 8: PingR neu starten ────────────────────────────────────
echo ""
echo "🚀 PingR mit TLS neu starten…"
cd /opt/pingr
docker compose down
docker compose up -d

sleep 5
echo ""
echo "✅ TLS Setup abgeschlossen!"
echo ""
echo "Testen:"
echo "  curl -I https://lumestack.de"
echo "  curl -I http://lumestack.de  ← muss auf HTTPS weiterleiten"
echo ""
echo "SSL-Score testen: https://www.ssllabs.com/ssltest/analyze.html?d=lumestack.de"
echo ""

# ── Schritt 9: Auto-Renewal einrichten ──────────────────────────────
echo "⏰ Auto-Renewal für Zertifikate einrichten…"
# Certbot erneuert automatisch Zertifikate die in <30 Tagen ablaufen
# Cron-Job: täglich um 3 Uhr prüfen
(crontab -l 2>/dev/null; echo "0 3 * * * certbot renew --quiet --post-hook 'docker compose -f /opt/pingr/docker-compose.yml restart nginx'") | crontab -
echo "✓ Cron-Job für Auto-Renewal erstellt (täglich 03:00 Uhr)"
echo ""
echo "Zertifikats-Status:"
certbot certificates