# PingR Admin — Anleitung

## 1. Zugang

Das Admin-Panel ist erreichbar unter:
```
https://lumestack.de/admin
```
Login mit dem `ADMIN_SECRET` aus `/opt/pingr/.env`.

---

## 2. Admin-Panel Tabs

| Tab | Funktion |
|-----|----------|
| 📊 Übersicht | Live-Statistiken, Online-Nutzer, Schnellzugriff |
| 👥 Nutzer | Suchen, Sperren, Entsperren, Passwort-Reset, E-Mail verifizieren, Löschen |
| 🔐 Security | Sicherheits-Events, Behördenbericht erstellen |
| 📋 Meldungen | Nutzer-Meldungen bearbeiten (Offen/Geschlossen) |
| 📈 Statistiken | Registrierungen, Nachrichten-Aktivität, Top-Nutzer, Geräte |
| 📡 ICQ Claims | Legacy UIN-Claims genehmigen oder ablehnen |
| 🗄️ Datenbank | MongoDB-Explorer — Collections durchsuchen und bearbeiten |

---

## 3. Datenbank-Explorer

Im Tab **🗄️ Datenbank** kannst du direkt auf die MongoDB zugreifen.

### Collections
- `users` — Nutzerkonten
- `messages` — Nachrichten
- `conversations` — Chats und Gruppen
- `contacts` — Kontakte
- `legacyclaims` — ICQ Legacy Claims
- `reports` — Nutzer-Meldungen
- `securitylogs` — Sicherheits-Events

### Suche
- Freitext: durchsucht username, email, content
- Feld-Suche: `email:test@example.com` oder `uin:12345678`

### Sicherheitshinweise
- Passwörter und Tokens werden **niemals angezeigt**
- User können im DB-Explorer nicht gelöscht werden — nur über den **Nutzer-Tab** (mit Cascade-Löschung)

---

## 4. ICQ Claims verwalten

Im Tab **📡 ICQ Claims** siehst du alle ausstehenden Claims.

### Screenshot-Claims
- Nutzer lädt Screenshot seines alten ICQ-Clients hoch
- Du prüfst ob die UIN sichtbar ist
- **Genehmigen** → ICQ-UIN wird neue Haupt-UIN des Nutzers
- **Ablehnen** → mit Begründung (wird dem Nutzer angezeigt)

### E-Mail-Claims
- Werden automatisch per E-Mail-Link verifiziert
- Erscheinen nach Verifizierung als `approved`

---

## 5. API-Zugriff (Kommandozeile)

Alle Endpoints erfordern den Header `X-Admin-Secret: DEIN_SECRET`.

### Statistiken
```bash
curl -H "X-Admin-Secret: DEIN_SECRET" \
  https://lumestack.de/api/admin/stats
```

### Nutzer sperren
```bash
curl -X POST \
  -H "X-Admin-Secret: DEIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"userId": "MONGODB_USER_ID", "reason": "Verstoß gegen Nutzungsbedingungen"}' \
  https://lumestack.de/api/admin/ban-user
```

### Nutzer entsperren
```bash
curl -X POST \
  -H "X-Admin-Secret: DEIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"userId": "MONGODB_USER_ID"}' \
  https://lumestack.de/api/admin/unban-user
```

### 2FA deaktivieren (Notfall)
```bash
curl -X POST \
  -H "X-Admin-Secret: DEIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"userId": "MONGODB_USER_ID"}' \
  https://lumestack.de/api/admin/disable-2fa
```

### Behördenbericht erstellen
```bash
curl -X POST \
  -H "X-Admin-Secret: DEIN_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"markAsReported": true}' \
  https://lumestack.de/api/admin/generate-report \
  > bericht_$(date +%Y%m%d_%H%M%S).json
```

---

## 6. Server-Befehle

```bash
# Alle Container neu starten
cd /opt/pingr && docker compose restart

# Komplett neu bauen (nach Code-Änderungen)
docker compose down && docker compose build --no-cache && docker compose up -d

# Nur Frontend neu bauen
docker compose build --no-cache frontend && docker compose up -d

# Logs anzeigen
docker compose logs -f backend
docker compose logs -f nginx

# Datenbank direkt ansprechen
docker exec pingr-mongo-1 mongosh pingr

# TLS-Zertifikat prüfen
certbot certificates

# SSL-Response testen
curl -sI https://lumestack.de | grep -E "HTTP|Strict|server"
```

---

## 7. Wichtige Dateipfade

| Datei | Pfad |
|-------|------|
| Umgebungsvariablen | `/opt/pingr/.env` |
| Docker Compose | `/opt/pingr/docker-compose.yml` |
| nginx Konfiguration | `/opt/pingr/nginx/nginx.conf` |
| Admin-Panel | `/opt/pingr/frontend/public/admin.html` |
| Landing Page | `/opt/pingr/frontend/public/landing.html` |
| TLS-Zertifikat | `/etc/letsencrypt/live/lumestack.de/` |
| DH-Parameter | `/etc/nginx/dhparam.pem` |
| User-Uploads | `/opt/pingr/uploads/` |

---

## 8. TLS / HTTPS

PingR verwendet TLS 1.2/1.3 mit Let's Encrypt.

### Zertifikat manuell erneuern
```bash
certbot renew --quiet
docker compose restart nginx
```

### Auto-Renewal prüfen
```bash
crontab -l | grep certbot
```

### SSL-Qualität testen
```
https://www.ssllabs.com/ssltest/analyze.html?d=lumestack.de
```

---

## 9. Backup

### MongoDB manuell sichern
```bash
docker exec pingr-mongo-1 mongodump \
  --out /tmp/backup_$(date +%Y%m%d)
tar -czf /root/pingr_backup_$(date +%Y%m%d).tar.gz /tmp/backup_$(date +%Y%m%d)
```

### Automatisches tägliches Backup einrichten
```bash
crontab -e
# Zeile hinzufügen:
0 2 * * * docker exec pingr-mongo-1 mongodump --out /tmp/backup_$(date +\%Y\%m\%d) && tar -czf /root/backups/pingr_$(date +\%Y\%m\%d).tar.gz /tmp/backup_$(date +\%Y\%m\%d)
```
