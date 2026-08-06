# Nokki Desktop-Downloads und Web-Verbesserungen aktivieren

Das Update-ZIP direkt nach `/opt/pingr` hochladen und anschließend ausführen:

```bash
cd /opt/pingr
sudo unzip -o Nokki-Desktop-Konfiguration-1.0.0.zip -d /opt/pingr
sudo docker compose config --quiet
sudo docker compose up -d --build --force-recreate frontend nginx
sudo docker compose exec nginx nginx -t
```

Danach die Downloads testen:

```bash
curl -fIs https://lumestack.de/downloads/Nokki-1.0.0-windows-portable-x64.zip | head
curl -fIs https://lumestack.de/downloads/Nokki-1.0.0-linux-x86_64.AppImage | head
curl -fIs https://lumestack.de/downloads/Nokki-1.0.0-linux-amd64.deb | head
curl -fsS https://lumestack.de/api/health
```

Die zentrale Downloadseite ist danach unter
`https://lumestack.de/download.html` erreichbar. Sie erkennt Windows, macOS
oder Linux automatisch und aktiviert nur Pakete, die tatsächlich auf dem
Server vorhanden sind. Die Download-Schaltflächen auf der Nokki-Startseite
verlinken ebenfalls auf diese Seite.
Der macOS-Build ist vorbereitet, muss aber auf einem Mac gebaut und für eine
öffentliche Verteilung mit einem Apple-Developer-Zertifikat signiert werden.

Die Datei `GITHUB_INSTALLER_ANLEITUNG.md` beschreibt den automatischen Build
richtiger Windows-, Linux- und macOS-Installer. Das Update enthält außerdem die
korrigierte Adminseite und die optimierte Landingpage.
