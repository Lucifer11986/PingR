# 📋 PingR Changelog

Alle wichtigen Änderungen werden in dieser Datei dokumentiert.

---

## [1.16.0] — April 2026 — TLS, Datenbank-Explorer & Rechtliches

### ✨ Neu
- 🔒 **TLS 1.2/1.3** vollständig konfiguriert (Let's Encrypt, lumestack.de)
  - Nur sichere Cipher Suites (ECDHE, kein RC4/3DES)
  - HSTS mit `max-age=31536000; includeSubDomains; preload`
  - OCSP Stapling, DH-Parameter (2048-bit)
  - Perfect Forward Secrecy
  - HTTP → HTTPS Redirect (Port 80)
  - Auto-Renewal per Cron-Job
- 🗄️ **Datenbank-Explorer** im Admin-Panel
  - Collections durchsuchen (users, messages, conversations, ...)
  - Dokumente anzeigen, bearbeiten, löschen, hinzufügen
  - JSON-Editor mit Syntax-Highlighting
  - Pagination, Freitextsuche (feld:wert)
  - Sensible Felder (Passwörter, Tokens) werden niemals angezeigt
- 📡 **ICQ Claims Tab** im Admin-Panel (war unsichtbar wegen Panel-ID-Bug)
- 📊 **Öffentliche Stats-API** (`/api/public/stats`) für Landing Page Live-Counter
- 🌐 **Landing Page** komplett überarbeitet
  - Rechtlich bereinigt (keine angreifbaren Aussagen mehr)
  - DSGVO/BDSG-konformer Cookie-Banner
  - Datenschutz-Info-Sektion (Art. 13 DSGVO)
  - Live-Statistiken mit Auto-Refresh (30s)
  - Amber-Gold Design konsistent mit der App

### 🔧 Fixes
- nginx.conf: `events{}`/`http{}`-Wrapper entfernt (conf.d-Kompatibilität)
- admin.html: Claims-Script Quote-Bug behoben (`''` → `\'`)
- admin.html: `function loadDb` war außerhalb `<script>`-Tag
- admin.html: `dbAdd` Template-Strings mit echten Zeilenumbrüchen → `\n` escaped
- admin.html: Doppelter `loadClaims()`-Aufruf entfernt
- admin.html: `loadDb` beim Tab-Wechsel registriert
- ContactList: Chat-Löschen-Button (🗑️) war unsichtbar (`opacity:0`, kein Hover-Handler)
- Settings.tsx: Passwort-Felder zeigten `\x95`-Zeichen statt `••••••••`
- docker-compose.yml: `VITE_API_URL` auf `https://lumestack.de` gesetzt (kein Mixed Content)
- docker-compose.yml: `VITE_WS_URL` auf `wss://lumestack.de` gesetzt
- nginx: Frontend-Routing via `proxy_pass http://frontend:80`
- nginx: `/admin` Route direkt auf `admin.html` (kein React-Router Hijack)
- admin.ts: `export default` war zu früh (disable-2fa Route war nie erreichbar)
- admin.ts: `/api/admin/charts` Route fehlte komplett
- conversations.ts: `POST /:id/add` mit Admin-Check und Max-Member-Prüfung
- Conversation.ts: Neue Felder im Schema ergänzt

### 🏗️ Infrastruktur
- docker-compose.yml: Port 8084 beibehalten, Port 443 hinzugefügt
- Volumes: `/etc/letsencrypt`, `/var/www/certbot`, `/etc/nginx/dhparam.pem`
- Backend: neue Routes `public.ts`, `adminDb.ts`, `claims.ts` in index.ts eingetragen

---

## [1.15.0] — April 2026 — Gruppen-Einstellungen 2.0

### ✨ Neu
- 📝 **Gruppenbeschreibung** (300 Zeichen, für alle Mitglieder sichtbar)
- 🐌 **Slow Mode** — Cooldown 10s bis 1h pro Nutzer
- 🛡️ **Admin-Only Modus** — nur Admins dürfen schreiben
- ✋ **Beitritt bestätigen** — Admin genehmigt neue Mitglieder
- 👥 **Max. Mitglieder** — frei einstellbar bis 500
- 🔇 **Mitglieder stummschalten** — 5 Min bis 7 Tage, Badge sichtbar
- 👑 **Admin degradieren** — zurück zum normalen Mitglied
- ➕ **Mitglied direkt hinzufügen** — Suche nach Nutzername/UIN
- 🗑️ **Chat leeren** — alle Nachrichten löschen, Mitglieder bleiben
- ❌ **Gruppe löschen** — mit Bestätigung durch Gruppenname-Eingabe
- ⚠️ **Gefahrenzone-Tab** im GroupSettings-Modal

### 🔧 Fixes
- GroupSettings: Toggle-Buttons statt Checkboxen
- Neue Backend-Routen: `/demote`, `/mute`, `/messages DELETE`
- conversations.ts: `DELETE /:id` funktioniert jetzt auch für Gruppen

---

## [1.14.0] — April 2026 — ICQ Legacy Claim System

### ✨ Neu
- 📡 **ICQ Legacy UIN Claim** — alte ICQ-Nummer für PingR-Profil beanspruchen
  - 3 Methoden: E-Mail-Verifizierung, Screenshot (Admin prüft), First-Come
  - Bei Genehmigung: ICQ-UIN wird neue Haupt-UIN des Users
  - Admin-Tab für Claims (Genehmigen/Ablehnen mit Notiz)
- 🗂️ **Admin Claims-Tab** in der Navigation

---

## [1.13.0] — April 2026 — Video/Audio Calls

### ✨ Neu
- 📞 **WebRTC Video/Audio Calls** — P2P direkt im Chat
- 📌 **Angepinnte Nachrichten** — bis zu 5 pro Chat
- 🔍 **Nachrichtensuche** — Volltext mit Highlight
- 💾 **Chat-Export** — TXT oder JSON

---

## [1.12.0] — April 2026 — Sicherheit + E2EE

### ✨ Neu
- 🔒 **Ende-zu-Ende Verschlüsselung** (ECDH P-256 + AES-GCM 256-bit)
- 🤖 **CAPTCHA** bei Registrierung
- 🚫 **IP-Blacklisting** — 5 Fehlversuche → 1h gesperrt
- 📧 **Login-Alert** bei neuer IP
- 📊 **Admin Charts** mit MongoDB Aggregation

---

## [1.11.0] — April 2026 — UX & Design

### ✨ Neu
- 🎨 **Farbthemen** — Dunkel, Hell, Midnight, Ozean, Wald
- 🖼️ **Chat-Hintergründe**
- ✓✓ **Lesebestätigungen** — SVG-Haken

---

## [1.10.0] — April 2026 — Internationalisierung

### ✨ Neu
- 🌍 **Mehrsprachigkeit** DE/EN/FR/TR
- 🌐 **Automatische Spracherkennung** per IP
- 🖼️ **Gruppen-Avatar**

---

## [1.9.0] — April 2026 — Features Runde 3

### ✨ Neu
- 💬 **Markdown-Rendering**
- 🔗 **Link-Vorschau**
- 😂 **GIF-Picker** (Tenor API)
- 📊 **Umfragen** in Gruppen
- 📱 **PWA** — installierbar

---

## [1.8.0] — April 2026 — E-Mail Verifizierung

### ✨ Neu
- ✅ **E-Mail-Verifizierung** mit Banner und Neu-Senden-Button

---

## [1.7.0] — April 2026 — SSL & Security

### ✨ Neu
- 🔒 **HTTPS** mit Let's Encrypt
- 🔐 **2FA** (TOTP)
- 📋 **Login-Verlauf**

---

## [1.6.0] — März 2026 — Admin 2.0

### ✨ Neu
- 🛡️ **Admin-Panel** komplett neu
- 📢 **Broadcast** an alle Nutzer
- 🗂️ **Behördenbericht** Generator

---

## [1.5.0] — März 2026 — Gruppen

### ✨ Neu
- ⚙️ **Gruppeneinstellungen**
- 🔗 **Einladungslinks**

---

## [1.0.0–1.4.0] — Februar/März 2026 — Launch & Kernfeatures

- UIN-System, Messaging, WebSocket, Gruppen, Sounds, Lesezeichen, Reaktionen
