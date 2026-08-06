# Nokki-Sicherheitsupdate auf dem VServer

Diese Version ersetzt mehrere sicherheitskritische Bereiche. Bestehende Nutzer
müssen sich nach dem Wechsel des JWT-Schlüssels erneut anmelden. Sichere zuerst
die Datenbank und die bestehende `.env`-Datei.

## 1. Dateien hochladen und Sicherung erstellen

Die Dateien gehören weiterhin nach `/opt/pingr`. Danach in PuTTY:

```bash
cd /opt/pingr
sudo docker compose ps
sudo cp .env ".env.backup-$(date +%Y%m%d-%H%M%S)"
sudo docker compose exec -T mongo mongodump --archive --gzip > "backup-before-security-$(date +%Y%m%d-%H%M%S).archive.gz"
```

## 2. Vier getrennte Geheimnisse setzen

Viermal ausführen und jeden ausgegebenen Wert getrennt notieren:

```bash
openssl rand -hex 32
```

Dann die bestehende Konfiguration öffnen:

```bash
sudo nano /opt/pingr/.env
```

Diese Werte müssen vorhanden und jeweils unterschiedlich sein:

```dotenv
NODE_ENV=production
APP_URL=https://lumestack.de
SERVER_IP=217.154.165.25
JWT_SECRET=ERSTER_ZUFAELLSWERT
REFRESH_SECRET=ZWEITER_ZUFAELLSWERT
ADMIN_SECRET=DRITTER_ZUFAELLSWERT
FIELD_ENCRYPTION_SECRET=VIERTER_ZUFAELLSWERT
REDIS_URL=redis://redis:6379
```

Die Datei schützen:

```bash
sudo chmod 600 /opt/pingr/.env
sudo mkdir -p /opt/pingr/uploads /opt/pingr/logs /opt/pingr/backups /opt/pingr/desktop-dist
sudo chown -R 1000:1000 /opt/pingr/uploads /opt/pingr/logs
```

`FIELD_ENCRYPTION_SECRET` später nicht einfach ändern: Damit sind vorhandene
2FA-Geheimnisse und IP-Felder verschlüsselt. Bei Verlust sind sie nicht mehr
lesbar. Den Wert deshalb zusätzlich in einem Passwortmanager sichern.

## 3. Neu bauen und starten

```bash
cd /opt/pingr
sudo docker compose config >/dev/null
sudo docker compose build --no-cache backend frontend nginx
sudo docker compose up -d --force-recreate
sudo docker compose ps
sudo docker compose logs --tail=100 backend nginx
curl -fsS https://lumestack.de/api/health
```

Erwartete Health-Antwort: `{"status":"ok",...}`. Prüfe danach Registrierung,
Login, 2FA, eine Direktnachricht, Datei-Upload, Admin-Login und einen Anruf.

## 4. Zertifikat ohne Stoppen von Nginx erneuern

Die frühere Standalone-Methode kann bei laufendem Docker-Nginx Port 80 nicht
belegen. Stelle die Erneuerung einmalig auf Webroot um:

```bash
sudo mkdir -p /var/www/certbot
sudo certbot certonly --webroot -w /var/www/certbot \
  --cert-name lumestack.de -d lumestack.de \
  --email privacy@lumestack.de --agree-tos --no-eff-email --force-renewal
sudo docker compose exec nginx nginx -s reload
sudo certbot renew --dry-run
```

Damit Nginx nach jeder automatischen Verlängerung das neue Zertifikat lädt:

```bash
sudo mkdir -p /etc/letsencrypt/renewal-hooks/deploy
sudo nano /etc/letsencrypt/renewal-hooks/deploy/reload-nokki-nginx.sh
```

Inhalt der Datei:

```bash
#!/bin/sh
cd /opt/pingr && /usr/bin/docker compose exec -T nginx nginx -s reload
```

Danach:

```bash
sudo chmod 750 /etc/letsencrypt/renewal-hooks/deploy/reload-nokki-nginx.sh
```

## 5. Installer bereitstellen

Die GitHub-Action aus `.github/workflows/desktop-build.yml` erzeugt beim Tag
`v1.0.0` Windows-, macOS- und Linux-Pakete. Die fertigen Dateien aus dem GitHub
Release mit WinSCP nach `/opt/pingr/desktop-dist/` laden. Die Downloadseite
aktiviert nur tatsächlich vorhandene Dateien.

## Enthaltene Schutzmaßnahmen

- Rollenbasierte Admin-Rechte und kurzlebige Staff-Sitzungen
- Mitgliedschaftsprüfung für Nachrichten, Uploads, Socket.IO, Anrufe und Typing
- kurzlebige Access-Tokens plus rotierende HttpOnly-Refresh-Cookies
- lokale 2FA-QR-Erzeugung und verschlüsselte 2FA-Geheimnisse
- Dateisignaturprüfung für Uploads und geschützte Upload-Abrufe
- SSRF-Schutz für Link-Vorschauen und restriktives CORS
- feste öffentliche Benutzerfelder, damit keine internen Token herausgegeben werden
- reproduzierbare Docker-Builds ohne ignorierte TypeScript-Fehler

Echte Ende-zu-Ende-Verschlüsselung ist bewusst deaktiviert und wird auf den
öffentlichen Seiten nicht mehr als fertige Funktion beworben.
