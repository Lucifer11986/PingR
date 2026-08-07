# Sicherheitsprüfung für den geschlossenen Live-Test

Stand: 7. August 2026

## Geprüft

- Backend-Tests und TypeScript-Build
- Frontend-TypeScript- und Produktions-Build
- Produktionsabhängigkeiten von Backend, Frontend und Desktop
- kurzlebige Developer-Zugriffstokens und rotierende Refresh-Sitzungen
- verschlüsselte API-/Webhook-Geheimnisse und verschlüsselte Webhook-Payloads
- Webhook-Zielvalidierung gegen lokale und private Netze
- Berechtigungsprüfung für Bots, Installationen und Webhooks
- Sicherheitsheader und öffentliche Live-Endpunkte

## React-Router-Hinweis

Nokki verwendet `react-router-dom` 7.18.2. `npm audit` meldet für diese Version eine
hohe Warnung zur Verarbeitung von React Server Components beziehungsweise Server Actions.
Nokki ist eine klassische Vite-SPA und aktiviert weder RSC noch React-Router-Server-Actions.
Der betroffene Codepfad wird daher nicht verwendet.

Ein Downgrade auf 7.11 wurde geprüft und verworfen, weil diese Version mehrere zusätzliche
XSS-, Open-Redirect-, RCE- und DoS-Warnungen besitzt. Bis eine kompatible korrigierte Version
verfügbar ist, bleibt 7.18.2 die risikoärmere Variante. Bei jedem Abhängigkeitsupdate muss
dieser Befund erneut geprüft werden.

## Grenzen

Die Prüfung ersetzt keinen externen Penetrationstest. SMTP, OAuth, Desktop-Signierung,
Audio-/Videoanrufe und Wiederherstellung aus einem Server-Backup müssen in der echten
Infrastruktur mit Testkonten geprüft werden. Der Start ist deshalb zunächst als geschlossener
Beta-Test mit bekannten Testern vorgesehen.
