#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# PingR — MongoDB Backup Script
# Speichert täglich ein komprimiertes Backup der Datenbank
# Einrichten: bash /opt/pingr/backup.sh setup
# ═══════════════════════════════════════════════════════════════

BACKUP_DIR="/opt/pingr/backups"
COMPOSE_DIR="/opt/pingr"
KEEP_DAYS=14   # Backups älter als 14 Tage werden gelöscht
DATE=$(date +%Y-%m-%d_%H-%M)

# ── Backup ausführen ─────────────────────────────────────────────
run_backup() {
  echo "🗄️  PingR Backup startet: $DATE"
  mkdir -p "$BACKUP_DIR"

  # MongoDB Dump aus dem Container
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T mongo \
    mongodump --db pingr --out /tmp/pingr_backup_$DATE --quiet

  # Aus Container auf Host kopieren
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T mongo \
    tar -czf /tmp/pingr_backup_$DATE.tar.gz -C /tmp pingr_backup_$DATE

  docker compose -f "$COMPOSE_DIR/docker-compose.yml" cp \
    mongo:/tmp/pingr_backup_$DATE.tar.gz \
    "$BACKUP_DIR/pingr_$DATE.tar.gz"

  # Temp-Dateien im Container aufräumen
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T mongo \
    rm -rf /tmp/pingr_backup_$DATE /tmp/pingr_backup_$DATE.tar.gz

  # Dateigröße prüfen
  SIZE=$(du -sh "$BACKUP_DIR/pingr_$DATE.tar.gz" 2>/dev/null | cut -f1)
  echo "✅ Backup erstellt: $BACKUP_DIR/pingr_$DATE.tar.gz ($SIZE)"

  # Alte Backups löschen
  find "$BACKUP_DIR" -name "pingr_*.tar.gz" -mtime +$KEEP_DAYS -delete
  COUNT=$(ls "$BACKUP_DIR"/pingr_*.tar.gz 2>/dev/null | wc -l)
  echo "📦 Gespeicherte Backups: $COUNT (max. $KEEP_DAYS Tage)"
}

# ── Cron-Job einrichten ──────────────────────────────────────────
setup_cron() {
  SCRIPT_PATH="/opt/pingr/backup.sh"

  # Script an den richtigen Ort kopieren falls nötig
  if [ ! -f "$SCRIPT_PATH" ]; then
    cp "$0" "$SCRIPT_PATH"
    chmod +x "$SCRIPT_PATH"
  fi

  # Cron-Job hinzufügen (täglich um 02:30 Uhr)
  CRON_LINE="30 2 * * * $SCRIPT_PATH run >> /var/log/pingr_backup.log 2>&1"

  # Prüfen ob bereits vorhanden
  if crontab -l 2>/dev/null | grep -q "pingr.*backup"; then
    echo "ℹ️  Cron-Job bereits vorhanden:"
    crontab -l | grep pingr
  else
    (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
    echo "✅ Cron-Job eingerichtet: täglich um 02:30 Uhr"
    echo "   Logs: /var/log/pingr_backup.log"
  fi

  echo ""
  echo "📁 Backup-Verzeichnis: $BACKUP_DIR"
  echo "🗓️  Aufbewahrung: $KEEP_DAYS Tage"
  echo ""
  echo "Jetzt testen:"
  echo "  bash $SCRIPT_PATH run"
}

# ── Status anzeigen ──────────────────────────────────────────────
show_status() {
  echo "📊 PingR Backup Status"
  echo "─────────────────────"
  if ls "$BACKUP_DIR"/pingr_*.tar.gz 2>/dev/null | head -5; then
    echo ""
    echo "Gesamt: $(ls "$BACKUP_DIR"/pingr_*.tar.gz 2>/dev/null | wc -l) Backups"
    echo "Speicher: $(du -sh "$BACKUP_DIR" 2>/dev/null | cut -f1)"
  else
    echo "Noch keine Backups vorhanden."
    echo "Ausführen: bash /opt/pingr/backup.sh run"
  fi
  echo ""
  echo "Cron-Job:"
  crontab -l 2>/dev/null | grep -q backup && crontab -l | grep backup || echo "  Kein Cron-Job gefunden — 'bash backup.sh setup' ausführen"
}

# ── Wiederherstellen ─────────────────────────────────────────────
restore() {
  BACKUP_FILE="$1"
  if [ -z "$BACKUP_FILE" ]; then
    echo "Verwendung: bash backup.sh restore DATEINAME.tar.gz"
    echo "Verfügbare Backups:"
    ls -lh "$BACKUP_DIR"/pingr_*.tar.gz 2>/dev/null || echo "Keine Backups gefunden"
    exit 1
  fi

  echo "⚠️  ACHTUNG: Alle aktuellen Daten werden überschrieben!"
  read -p "Fortfahren? (ja/nein): " confirm
  if [ "$confirm" != "ja" ]; then echo "Abgebrochen."; exit 0; fi

  echo "🔄 Wiederherstellen aus: $BACKUP_FILE"
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" cp "$BACKUP_FILE" mongo:/tmp/restore.tar.gz
  docker compose -f "$COMPOSE_DIR/docker-compose.yml" exec -T mongo \
    bash -c "cd /tmp && tar -xzf restore.tar.gz && mongorestore --db pingr --drop /tmp/pingr_backup_*/pingr --quiet"
  echo "✅ Wiederherstellung abgeschlossen"
}

# ── Hauptprogramm ─────────────────────────────────────────────────
case "$1" in
  run)     run_backup ;;
  setup)   setup_cron ;;
  status)  show_status ;;
  restore) restore "$2" ;;
  *)
    echo "PingR Backup Script"
    echo ""
    echo "Befehle:"
    echo "  bash backup.sh setup           — Cron-Job einrichten (einmalig)"
    echo "  bash backup.sh run             — Backup jetzt ausführen"
    echo "  bash backup.sh status          — Vorhandene Backups anzeigen"
    echo "  bash backup.sh restore FILE    — Aus Backup wiederherstellen"
    ;;
esac