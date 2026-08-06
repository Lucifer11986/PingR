# Nokki Desktop

Die Desktop-App verbindet sich standardmäßig mit `https://lumestack.de/chat`.
Docker wird auf dem Rechner des Nutzers nicht benötigt.

## Entwicklung

```bash
cd installer/electron
npm ci
npm start
```

Für einen lokalen Entwicklungsserver kann die Zieladresse überschrieben werden:

```bash
NOKKI_APP_URL=http://localhost:5173 npm start
```

Andere unverschlüsselte HTTP-Adressen werden aus Sicherheitsgründen abgelehnt.

## Installer bauen

- Windows: `installer\build-installer.ps1`
- Linux: `./installer/build-installer.sh linux`
- macOS: `./installer/build-installer.sh macos`

Die Ergebnisse werden unter `desktop-dist/` abgelegt. Ein macOS-Build muss auf
macOS ausgeführt werden. Für eine öffentliche Verteilung sollten Windows- und
macOS-Pakete zusätzlich mit einem gültigen Entwicklerzertifikat signiert werden.

## Automatische Builds mit GitHub

Die Workflow-Datei `.github/workflows/desktop-build.yml` baut Windows, Linux
und macOS jeweils auf einem nativen GitHub-Runner. Ein manueller Lauf stellt die
Pakete als Workflow-Artefakte bereit.

Ein Versions-Tag erstellt zusätzlich ein dauerhaftes GitHub-Release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

Danach liegen der Windows-Installer, Linux-Pakete und das macOS-DMG unter
`Releases` im GitHub-Repository. Ohne Code-Signing funktionieren die Pakete,
Windows SmartScreen und macOS Gatekeeper können jedoch Warnungen anzeigen.
