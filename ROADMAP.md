# 🗺️ PingR — Roadmap

---

## ✅ Bereits umgesetzt (Stand April 2026)

### Infrastruktur
- [x] Docker-Deployment (nginx, frontend, backend, mongo)
- [x] TLS 1.2/1.3 mit Let's Encrypt (lumestack.de)
- [x] HSTS, Perfect Forward Secrecy, OCSP Stapling
- [x] HTTP → HTTPS Redirect, Auto-Renewal
- [x] Rate-Limiting (API, Auth, Upload)
- [x] nginx Reverse Proxy mit WebSocket-Support

### Messaging
- [x] UIN-System, Echtzeit-Nachrichten (WebSocket)
- [x] Gruppen (privat/öffentlich), Einladungslinks
- [x] Sprachnachrichten, Datei-Upload, GIF-Picker
- [x] Reaktionen, Antworten, Weiterleiten, Bearbeiten, Löschen
- [x] Zeitkapsel- und selbst-zerstörende Nachrichten
- [x] Angepinnte Nachrichten, Nachrichtensuche
- [x] Video-/Audioanrufe (WebRTC)

### Sicherheit
- [x] E2E-Verschlüsselung (ECDH P-256 + AES-GCM)
- [x] 2FA (TOTP), Login-Verlauf, Login-Alert
- [x] CAPTCHA, IP-Blacklisting, Wegwerf-E-Mail-Sperre
- [x] E-Mail-Verifizierung
- [x] Content-Filter, Meldungen, Behördenbericht

### Admin
- [x] Admin-Panel mit 7 Tabs
- [x] Datenbank-Explorer (CRUD für alle Collections)
- [x] ICQ Legacy Claims (3 Methoden)
- [x] Broadcast, Security-Logs, Statistik-Charts

### Gruppen-Features
- [x] Beschreibung, Slow Mode, Admin-Only, Max. Mitglieder
- [x] Stummschalten, Admin degradieren, Mitglieder hinzufügen
- [x] Chat leeren, Gruppe löschen (Gefahrenzone)

### Rechtliches
- [x] DSGVO-konformer Cookie-Banner
- [x] Landing Page rechtlich bereinigt
- [x] Datenschutzerklärung, Impressum, AGB verlinkt

---

## 📅 Q2 2026 (April–Juni) — Stabilisierung

### Technisch
- [ ] **MongoDB automatische Backups** — täglicher Cron-Job
- [ ] **TURN-Server** — Coturn für WebRTC hinter NAT
- [ ] **Monitoring** — Uptime Robot (kostenlos), Fehler-Alerts
- [ ] **Push Notifications** — Web Push API

### Features
- [ ] **Sprache manuell persistent speichern** (localStorage-Fix in useI18n.ts)
- [ ] **Öffentliche Stats-Route** aktivieren (`/api/public/stats` in index.ts eintragen)
- [ ] **Anonym-Modus** — temporär anonym chatten
- [ ] **Flüster-Modus** — private Nachrichten in Gruppen
- [ ] **Einladungslinks als QR-Code**
- [ ] **Saved Messages** ("Notizen an mich")

### Wartung
- [ ] Alle `??`-Emojis in LegacyClaimForm.tsx prüfen
- [ ] useI18n.ts: manuelle Sprachauswahl persistent machen
- [ ] update-banner.js Syntax-Error beheben

---

## 📅 Q3 2026 (Juli–September) — Mobile

### Technisch
- [ ] React Native App (iOS + Android)
- [ ] FCM / APNs Push Notifications
- [ ] App Store / Google Play Einreichung

### Features
- [ ] **To-Do Listen** direkt im Chat
- [ ] **Tresor-Chat** — verschlüsselter privater Bereich
- [ ] **Live-Räume** — Gruppenräume in Echtzeit
- [ ] **Bot-API** (Webhook + Commands)

---

## 📅 Q4 2026 (Oktober–Dezember) — Skalierung

### Technisch
- [ ] Redis für Session-Management
- [ ] CDN für Datei-Uploads
- [ ] Elasticsearch für Suche
- [ ] Electron Desktop-App
- [ ] Horizontale Skalierung (mehrere Backend-Instanzen)

### Features
- [ ] **Premium-Tier** (mehr Speicher, exklusive Themes)
- [ ] **Gruppen-Videoanrufe**
- [ ] **Channels** (Telegram-Style Broadcast)

---

## 💰 Kosten

| Posten | Kosten/Monat |
|--------|-------------|
| VPS (Hetzner, Deutschland) | ~25 € |
| Domain lumestack.de | ~1 € |
| SSL (Let's Encrypt) | 0 € |
| E-Mail (SMTP) | 0–10 € |
| **Gesamt** | **~26–36 €** |

### Bei Wachstum
| Nutzer | Infrastruktur | Kosten/Monat |
|--------|--------------|-------------|
| 0–1.000 | 1x VPS (aktuell) | ~30 € |
| 1.000–10.000 | 2x VPS + Load Balancer | ~100 € |
| 10.000–100.000 | 4x VPS + Redis + CDN | ~400 € |

---

## 🛡️ Rechtliche To-Dos

- [ ] Impressum vollständig ausfüllen (Name, Adresse)
- [ ] Datenschutzerklärung anwaltlich prüfen lassen
- [ ] AGB finalisieren
- [ ] NetzDG-Transparenzbericht (erst ab 1 Mio. Nutzer Pflicht)

---

## 📊 Ziele 2026

| Metrik | Q2 | Q3 | Q4 |
|--------|----|----|-----|
| Registrierte Nutzer | 100 | 1.000 | 10.000 |
| Daily Active Users | 20 | 200 | 2.000 |
| Zahlende Nutzer | 5 | 50 | 500 |

---

*Letzte Aktualisierung: April 2026*
