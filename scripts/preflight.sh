#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="$project_dir/.env"
errors=0
warnings=0

ok() { printf 'OK   %s\n' "$1"; }
warn() { printf 'WARN %s\n' "$1"; warnings=$((warnings + 1)); }
fail() { printf 'FAIL %s\n' "$1"; errors=$((errors + 1)); }

env_value() {
  awk -F= -v key="$1" '$1 == key { sub(/^[^=]*=/, ""); print; exit }' "$env_file"
}

require_secret() {
  local key="$1" value
  value="$(env_value "$key")"
  if [ "${#value}" -lt 32 ] || [[ "$value" == HIER_* ]]; then
    fail "$key fehlt oder ist kürzer als 32 Zeichen"
  else
    ok "$key ist gesetzt"
  fi
}

printf 'Nokki Preflight\n===============\n'

if [ ! -f "$env_file" ]; then
  printf 'FAIL .env fehlt unter %s\n' "$project_dir"
  exit 1
fi

require_secret JWT_SECRET
require_secret REFRESH_SECRET
require_secret ADMIN_SECRET
require_secret FIELD_ENCRYPTION_SECRET

[ "$(env_value NODE_ENV)" = "production" ] && ok 'NODE_ENV=production' || fail 'NODE_ENV muss production sein'
[[ "$(env_value APP_URL)" == https://* ]] && ok 'APP_URL verwendet HTTPS' || fail 'APP_URL muss eine HTTPS-Adresse sein'

smtp_host="$(env_value SMTP_HOST)"
smtp_user="$(env_value SMTP_USER)"
smtp_pass="$(env_value SMTP_PASS)"
if [ -n "$smtp_host$smtp_user$smtp_pass" ]; then
  [ -n "$smtp_host" ] && [ -n "$smtp_user" ] && [ -n "$smtp_pass" ] \
    && ok 'SMTP vollständig konfiguriert' || fail 'SMTP ist nur teilweise konfiguriert'
else
  warn 'SMTP fehlt: Verifizierung und Passwort-Reset versenden keine E-Mails'
fi

for provider in GITHUB GOOGLE; do
  client_id="$(env_value "${provider}_CLIENT_ID")"
  client_secret="$(env_value "${provider}_CLIENT_SECRET")"
  callback="$(env_value "${provider}_CALLBACK_URL")"
  if [ -n "$client_id$client_secret$callback" ]; then
    [ -n "$client_id" ] && [ -n "$client_secret" ] && [[ "$callback" == https://*/api/dev/auth/*/callback ]] \
      && ok "$provider OAuth vollständig konfiguriert" || fail "$provider OAuth ist unvollständig oder Callback ist falsch"
  else
    warn "$provider OAuth ist deaktiviert"
  fi
done

if command -v docker >/dev/null 2>&1; then
  if (cd "$project_dir" && docker compose config --quiet >/dev/null 2>&1); then
    ok 'docker compose Konfiguration ist gültig'
  else
    fail 'docker compose Konfiguration ist ungültig'
  fi
else
  fail 'Docker ist nicht installiert'
fi

available_mb="$(df -Pm "$project_dir" | awk 'NR==2 {print $4}')"
[ "${available_mb:-0}" -ge 2048 ] && ok 'mindestens 2 GB Speicher frei' || warn 'weniger als 2 GB Speicher frei'

printf '\nErgebnis: %d Fehler, %d Warnungen\n' "$errors" "$warnings"
[ "$errors" -eq 0 ]
