# Nokki Live-Test-Checkliste

## Vor dem Deployment

- Server-Backup oder Snapshot erstellen.
- Wiederherstellung des Backups einmal praktisch testen.
- `./scripts/preflight.sh` ohne Fehler ausführen.
- `.env` darf nicht in Git liegen.
- SMTP sowie gewünschte OAuth-Anbieter vollständig konfigurieren.
- Nur Testkonten ohne reale vertrauliche Inhalte verwenden.

## Deployment

```bash
cd /opt/pingr
docker compose up -d --build --force-recreate
docker compose ps
docker compose logs --tail=100 backend frontend nginx
./scripts/live-smoke-test.sh https://lumestack.de
```

## Funktionstest

- Registrierung und E-Mail-Bestätigung
- Login, Logout und Sitzungsverlängerung
- Passwort vergessen und Passwort zurücksetzen
- Direktnachricht und Gruppennachricht
- Antworten, Bearbeiten, Löschen und Reaktionen
- Datei- und Bild-Upload mit erlaubtem sowie abgelehntem Dateityp
- Audio-/Videoanruf mit zwei unterschiedlichen Geräten
- Desktop-App unter Windows, Linux und macOS
- Developer-Registrierung und API-Key-Rotation
- Bot erstellen, installieren und Berechtigungen prüfen
- Webhook testen, Fehler provozieren, Verlauf öffnen und erneut senden
- Admin-Anmeldung, Nutzerverwaltung und Bot-Freigabe

## Während des geschlossenen Tests

```bash
cd /opt/pingr
docker compose logs -f --tail=100 backend nginx
docker stats
```

- Zunächst höchstens 5–10 bekannte Tester zulassen.
- Keine Produktionszusagen oder SLA nennen.
- Fehler mit Zeitpunkt, Benutzeraktion und betroffener Plattform dokumentieren.
- Kritische Fehler: Registrierung, Login, Datenverlust, Rechteumgehung, Upload oder Adminzugriff.

## Abbruchkriterien

Den Test stoppen bei Datenverlust, unberechtigtem Zugriff, wiederholten Container-Abstürzen,
unkontrolliertem Ressourcenverbrauch oder nicht zustellbaren Sicherheits-E-Mails.

## Rollback

Vorheriges ZIP und Server-Snapshot aufbewahren. Bei einem kritischen Fehler den neuen Stand
nicht weiter patchen, sondern auf den letzten geprüften Stand zurückrollen und erst danach analysieren.
