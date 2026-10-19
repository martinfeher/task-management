#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/mobile"

if [ -z "${EXPO_PUBLIC_API_URL:-}" ]; then
  LAN_IP=""
  if command -v ipconfig >/dev/null 2>&1; then
    LAN_IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
  fi
  if [ -n "$LAN_IP" ]; then
    export EXPO_PUBLIC_API_URL="http://${LAN_IP}:3000"
    echo "EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL} (LAN — for device API calls)"
  fi
fi

exec npx expo start "$@"
