#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-https://lumestack.de}"
base_url="${base_url%/}"
errors=0

pass() { printf 'OK   %s\n' "$1"; }
fail() { printf 'FAIL %s\n' "$1"; errors=$((errors + 1)); }

check_page() {
  local path="$1" expected="${2:-200}" code
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "$base_url$path" || true)"
  [ "$code" = "$expected" ] && pass "$path liefert HTTP $expected" || fail "$path liefert HTTP ${code:-keine Antwort}"
}

printf 'Nokki Live-Smoke-Test: %s\n==============================\n' "$base_url"
for path in / /login /register /developers /dev-login /download /api/health; do check_page "$path"; done

health="$(curl -fsS --max-time 15 "$base_url/api/health" || true)"
printf '%s' "$health" | grep -q '"status":"ok"' && pass 'Health-Status ist ok' || fail 'Health-Status ist nicht ok'
printf '%s' "$health" | grep -q '"app":"Nokki"' && pass 'Healthcheck meldet Nokki' || fail 'Healthcheck meldet nicht Nokki'

headers="$(curl -sSI --max-time 15 "$base_url/" | tr -d '\r' || true)"
for header in strict-transport-security content-security-policy x-content-type-options x-frame-options referrer-policy; do
  printf '%s\n' "$headers" | grep -qi "^${header}:" && pass "$header vorhanden" || fail "$header fehlt"
done

printf '\nErgebnis: %d Fehler\n' "$errors"
[ "$errors" -eq 0 ]
