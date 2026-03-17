#!/bin/sh
set -eu

SECRET_FILE="${GARDEN_PROXY_AUTH_FILE:-/auth/proxy-auth-token}"
if [ ! -s "$SECRET_FILE" ]; then
  echo "[AUTH] Proxy auth token file missing: $SECRET_FILE" >&2
  exit 1
fi

export GARDEN_PROXY_AUTH_TOKEN="$(tr -d '\r\n' < "$SECRET_FILE")"
if [ -z "$GARDEN_PROXY_AUTH_TOKEN" ]; then
  echo "[AUTH] Proxy auth token is empty" >&2
  exit 1
fi

envsubst '${GARDEN_PROXY_AUTH_TOKEN}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

exec nginx -g 'daemon off;'
