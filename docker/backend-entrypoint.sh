#!/bin/sh
set -eu

SECRET_FILE="${GARDEN_PROXY_AUTH_FILE:-/auth/proxy-auth-token}"
SECRET_DIR="$(dirname "$SECRET_FILE")"

mkdir -p "$SECRET_DIR"

if [ ! -s "$SECRET_FILE" ]; then
  umask 077
  head -c 32 /dev/urandom | base64 | tr -d '\n' > "$SECRET_FILE"
  echo "[AUTH] Generated proxy auth token at $SECRET_FILE"
fi

GARDEN_PROXY_AUTH_TOKEN="$(tr -d '\r\n' < "$SECRET_FILE")"
if [ -z "$GARDEN_PROXY_AUTH_TOKEN" ]; then
  echo "[AUTH] Failed to read proxy auth token from $SECRET_FILE" >&2
  exit 1
fi

export GARDEN_PROXY_AUTH_TOKEN

exec node dist/server.js
