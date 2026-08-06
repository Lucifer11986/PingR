# 💬 Nokki — Instant Messenger

> Messenger und Developer-Plattform aus Deutschland.  
> Web-, Desktop- und Bot-Funktionen, betrieben auf lumestack.de.

[![Made in Germany](https://img.shields.io/badge/Made%20in-Germany-black?style=flat)](https://lumestack.de)
[![DSGVO](https://img.shields.io/badge/DSGVO-konform-green)](https://lumestack.de/datenschutz.html)
[![TLS](https://img.shields.io/badge/TLS-1.3-blue)](https://lumestack.de)
[![License](https://img.shields.io/badge/License-Proprietary-red)](LICENSE)

---

## 🌐 Live-Instanz

| Seite | URL |
|-------|-----|
| 🏠 Landing Page | https://lumestack.de |
| 💬 Web App | https://lumestack.de/chat |
| 🔑 Login | https://lumestack.de/login |
| 📝 Registrieren | https://lumestack.de/register |
| 🛡️ Admin-Panel | https://lumestack.de/admin |
| 📄 Datenschutz | https://lumestack.de/datenschutz.html |
| 📋 Impressum | https://lumestack.de/impressum.html |

---

## ✨ Features

### 💬 Messaging
| Feature | Status |
|---------|--------|
| 🔢 Persönliche UIN (8–9 Stellen) | ✅ |
| ⚡ Echtzeit-Nachrichten (WebSocket) | ✅ |
| 📝 Markdown-Rendering | ✅ |
| 🔗 Link-Vorschau (OpenGraph) | ✅ |
| 😂 GIF-Suche (Tenor API) | ✅ |
| 🎤 Sprachnachrichten | ✅ |
| 📎 Datei-Upload (max. 50 MB) | ✅ |
| ↩ Antworten & Weiterleiten | ✅ |
| ✏️ Bearbeiten & Löschen | ✅ |
| 😀 Emoji-Reaktionen | ✅ |
| ✓✓ Lesebestätigungen | ✅ |
| 📌 Angepinnte Nachrichten (max. 5) | ✅ |
| 🔍 Nachrichtensuche | ✅ |
| ⏱ Selbst-zerstörende Nachrichten | ✅ |
| ⏰ Zeitkapsel-Nachrichten | ✅ |
| 🔖 Lesezeichen | ✅ |
| 💾 Chat-Export (TXT/JSON) | ✅ |
| 📞 Video- & Audioanrufe (WebRTC) | ✅ |

### 👥 Gruppen
| Feature | Status |
|---------|--------|
| 👥 Gruppen (privat/öffentlich) | ✅ |
| 📝 Gruppenbeschreibung | ✅ |
| 🐌 Slow Mode (10s–1h) | ✅ |
| 🛡️ Admin-only Modus | ✅ |
| ✋ Beitritt bestätigen | ✅ |
| 👥 Max. Mitglieder (2–500) | ✅ |
| 🔇 Mitglieder stummschalten | ✅ |
| 👑 Admin degradieren | ✅ |
| ➕ Mitglieder direkt hinzufügen | ✅ |
| 🗑️ Chat leeren / Gruppe löschen | ✅ |
| 🔗 Einladungslinks | ✅ |
| 🌐 Öffentliche Gruppen entdecken | ✅ |
| 📊 Umfragen | ✅ |

### 👤 Profil & Einstellungen
| Feature | Status |
|---------|--------|
| 🖼️ Profilbild | ✅ |
| 📝 Bio/Status | ✅ |
| 🌍 Mehrsprachigkeit (DE/EN) | ✅ |
| 🔒 Datenschutz-Einstellungen | ✅ |
| 🎨 Farbthemen | ✅ |
| 🖼️ Chat-Hintergründe | ✅ |
| 🔐 Zwei-Faktor-Authentifizierung (TOTP) | ✅ |
| 📋 Login-Verlauf | ✅ |
| 📡 ICQ Legacy UIN Claim | ✅ |
| 📱 PWA (als App installierbar) | ✅ |

### 🔒 Sicherheit & Infrastruktur
| Feature | Status |
|---------|--------|
| 🔒 TLS 1.2/1.3 (Let's Encrypt) | ✅ |
| 🔐 HSTS (1 Jahr, preload) | ✅ |
| 🔑 Perfect Forward Secrecy (ECDHE) | ✅ |
| 🔒 E2E-Verschlüsselung (ECDH + AES-GCM) | ✅ |
| 🛡️ Content-Filter | ✅ |
| 📱 Geräteerkennung (IP, OS, Browser) | ✅ |
| 🚨 Nutzer-Meldungen | ✅ |
| 📊 Rate-Limiting (API/Auth/Upload) | ✅ |
| 🤖 CAPTCHA bei Registrierung | ✅ |
| 🚫 IP-Blacklisting | ✅ |
| 📧 Login-Alert bei neuer IP | ✅ |
| ✉️ Wegwerf-E-Mail-Sperre | ✅ |
| ✅ E-Mail-Verifizierung | ✅ |

---

## 🏗️ Tech Stack

| Bereich | Technologie |
|---------|-------------|
| **Frontend** | React 18, TypeScript, Vite |
| **Backend** | Node.js, Express, TypeScript |
| **Datenbank** | MongoDB 7 + Mongoose |
| **Echtzeit** | Socket.IO (WebSocket) |
| **Video/Audio** | WebRTC (P2P) |
| **Kryptographie** | WebCrypto API (ECDH P-256 + AES-GCM 256) |
| **Reverse Proxy** | Nginx (TLS Termination) |
| **Container** | Docker + Docker Compose |
| **TLS** | Let's Encrypt (certbot) |
| **Server** | Hetzner VPS, Deutschland 🇩🇪 |

---

## 🚀 Deployment

### Voraussetzungen
- Docker & Docker Compose v2
- Domain mit A-Record auf Server-IP
- Server mit mind. 2 GB RAM

### Schnellstart

```bash
cd /opt/pingr

# .env anlegen
cp .env.example .env
nano .env  # JWT_SECRET, ADMIN_SECRET, SMTP_* setzen

# TLS-Zertifikat holen
mkdir -p /var/www/certbot
certbot certonly --webroot --webroot-path /var/www/certbot \
  -d lumestack.de --email privacy@lumestack.de --agree-tos --non-interactive

# DH-Parameter generieren (einmalig)
openssl dhparam -out /etc/nginx/dhparam.pem 2048

# Starten
docker compose up -d --build

# Logs prüfen
docker compose logs -f backend
```

### Zertifikat erneuern (automatisch per Cron)
```bash
# Cron-Job (täglich 03:00 Uhr)
0 3 * * * certbot renew --quiet --post-hook 'docker compose -f /opt/pingr/docker-compose.yml restart nginx'
```

---

## ⚙️ Konfiguration (.env)

```env
# Pflichtfelder
JWT_SECRET=min_32_zeichen_zufaelliger_string
ADMIN_SECRET=sicheres_admin_passwort
MONGO_INITDB_DATABASE=pingr
NODE_ENV=production
APP_URL=https://lumestack.de

# Optional: E-Mail
ADMIN_EMAIL=admin@lumestack.de
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=deine@gmail.com
SMTP_PASS=app_passwort

# Server
SERVER_IP=217.154.165.25
```

---

## 🛡️ Admin-Panel

Erreichbar unter `https://lumestack.de/admin` — Login mit `ADMIN_SECRET`.

### Tabs
| Tab | Funktion |
|-----|----------|
| 📊 Übersicht | Live-Statistiken, Online-Count |
| 👥 Nutzer | Sperren, Passwort-Reset, E-Mail verifizieren |
| 🔐 Security | Sicherheits-Events, Behördenbericht |
| 📋 Meldungen | Nutzer-Meldungen bearbeiten |
| 📈 Statistiken | Charts, Top-User, Nachrichten-Typen |
| 📡 ICQ Claims | Legacy UIN Claims genehmigen/ablehnen |
| 🗄️ Datenbank | MongoDB-Explorer (CRUD) |

---

## 🔧 Nützliche Befehle

```bash
# Neustart
cd /opt/pingr && docker compose restart

# Komplett neu bauen
docker compose down && docker compose build --no-cache && docker compose up -d

# Logs
docker compose logs -f backend
docker compose logs -f nginx

# Datenbank-Shell
docker compose exec mongo mongosh pingr

# 2FA deaktivieren (Notfall)
curl -X POST -H "X-Admin-Secret: SECRET" \
  -H "Content-Type: application/json" \
  -d '{"userId":"USER_ID"}' \
  https://lumestack.de/api/admin/disable-2fa

# SSL-Status prüfen
curl -sI https://lumestack.de | grep -i "strict-transport"
```

---

## 📁 Projektstruktur

```
Nokki/
├── backend/src/
│   ├── middleware/     # Auth, Rate-Limiting, IP-Blacklist, Security
│   ├── models/         # MongoDB Schemas (User, Message, Conversation, ...)
│   ├── routes/         # API Endpoints (auth, messages, admin, claims, public, adminDb, ...)
│   ├── socket/         # WebSocket Events + WebRTC Signaling
│   └── utils/          # Mailer, TimeCapsule, Migrations, ContentFilter
├── frontend/
│   ├── public/         # admin.html, landing.html, SW, Sounds
│   └── src/
│       ├── components/ # React Komponenten (Chat, GroupSettings, Settings, ...)
│       ├── hooks/      # useI18n, useSound, useContacts, ...
│       ├── pages/      # Login, Register, Chat, Settings
│       ├── services/   # API, Socket
│       └── store/      # authStore, chatStore, themeStore
├── nginx/
│   ├── Dockerfile
│   └── nginx.conf      # TLS 1.2/1.3, HSTS, Rate-Limiting, Proxy
├── docker-compose.yml
└── .env
```

---

## ⚠️ Wichtige Hinweise

- **Mikrofon/Kamera** funktionieren nur über HTTPS
- **E2E-Schlüssel** werden nur lokal gespeichert — Backup exportieren!
- **ADMIN_SECRET** sicher aufbewahren
- **dhparam.pem** einmalig generieren: `openssl dhparam -out /etc/nginx/dhparam.pem 2048`
- **nginx.conf** wird als `conf.d/default.conf` gemountet — kein `events{}`/`http{}` Wrapper

---

*Nokki — entwickelt in Deutschland*
