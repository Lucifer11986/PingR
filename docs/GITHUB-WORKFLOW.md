# Nokki auf GitHub aktualisieren

Das Repository ist `Lucifer11986/PingR`. Der Projektname darf intern weiterhin so heißen;
die sichtbare Anwendung heißt Nokki.

## Empfohlener Ablauf auf dem Server

Zuerst sicherstellen, dass der bisherige Stand sauber ist:

```bash
cd /opt/pingr
git status
git switch main
git pull --ff-only origin main
```

Danach einen neuen Branch für den vollständigen Live-Test-Stand anlegen:

```bash
git switch -c release/nokki-live-test
```

Das neue Nokki-ZIP außerhalb von `/opt/pingr` entpacken und übernehmen:

```bash
nokki_update_dir=$(mktemp -d)
unzip -q /opt/Nokki.zip -d "$nokki_update_dir"
rsync -a --exclude '.env' "$nokki_update_dir/Nokki/" /opt/pingr/
```

Vor dem Commit prüfen, dass keine Geheimnisse erfasst werden:

```bash
cd /opt/pingr
git check-ignore .env backend/.env
git status --short
./scripts/preflight.sh
```

Dann committen und hochladen:

```bash
git add .
git diff --cached --stat
git commit -m "Prepare Nokki live test"
git push -u origin release/nokki-live-test
```

Pull-Request mit GitHub CLI erstellen:

```bash
gh pr create \
  --base main \
  --head release/nokki-live-test \
  --title "Prepare Nokki live test" \
  --body "Webhook-Verlauf, Auth-Sicherheit, Tests und Live-Test-Werkzeuge."
```

Erst nach erfolgreichen GitHub-Actions-Checks in `main` mergen. Der ältere,
unvollständige Branch `agent/webhook-delivery-log` wird für diesen Ablauf nicht verwendet.
