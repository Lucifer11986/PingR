# Nokki-Installer mit GitHub bauen

Die Pipeline baut auf echten Windows-, Linux- und macOS-Systemen. Dadurch
entstehen ein vollständiger Windows-Installer, Linux-Pakete und ein macOS-DMG.

## 1. Repository vorbereiten

Erstelle bei GitHub ein neues privates Repository. Führe danach im lokalen
Nokki-Ordner aus und ersetze `DEIN-NAME` durch deinen GitHub-Namen:

```bash
git init
git add .
git commit -m "Nokki Desktop Build"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/nokki.git
git push -u origin main
```

Die `.gitignore` verhindert, dass `.env`, Logs, Uploads, Backups,
`node_modules` und gebaute Installer hochgeladen werden. Vor dem ersten Push
trotzdem mit `git status` kontrollieren, dass keine Zugangsdaten enthalten sind.

## 2. Installer als Release erzeugen

```bash
git tag v1.0.0
git push origin v1.0.0
```

Unter `Actions` startet der Workflow `Desktop-Installer`. Nach erfolgreichem
Abschluss befinden sich die fertigen Pakete unter `Releases` bei Version
`v1.0.0`.

## 3. Installer auf lumestack.de bereitstellen

Lade die gewünschten Release-Dateien herunter und kopiere sie mit WinSCP nach:

```text
/opt/pingr/desktop-dist/
```

Danach kann die Landingpage direkt auf diese Dateien unter
`https://lumestack.de/downloads/DATEINAME` verlinken.

## Signaturen

Die Installer sind technisch vollständig, aber zunächst unsigniert. Windows
SmartScreen und macOS Gatekeeper können deshalb Warnungen anzeigen. Für eine
vertrauenswürdige öffentliche Verteilung werden später ein Windows-Code-Signing-
Zertifikat und ein Apple-Developer-Account benötigt.
