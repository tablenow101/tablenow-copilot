#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$ROOT_DIR/deploy/cloud/cloud.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Configuration cloud absente." >&2
  exit 1
fi

API_DOMAIN=$(sed -n 's/^API_DOMAIN=//p' "$ENV_FILE")
if [ -z "$API_DOMAIN" ]; then
  echo "API_DOMAIN absent." >&2
  exit 1
fi

attempt=0
while [ "$attempt" -lt 30 ]; do
  health_status=$(curl --silent --output /dev/null --write-out '%{http_code}' "https://$API_DOMAIN/health" || true)
  protected_status=$(curl --silent --output /dev/null --write-out '%{http_code}' "https://$API_DOMAIN/v1/auth/session" || true)
  hidden_status=$(curl --silent --output /dev/null --write-out '%{http_code}' "https://$API_DOMAIN/" || true)
  if [ "$health_status" = "200" ] && [ "$protected_status" = "401" ] && [ "$hidden_status" = "404" ]; then
    echo "Cloud V2 vérifié: santé 200, session protégée 401, surface inconnue 404."
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 2
done

echo "La vérification cloud a échoué." >&2
echo "Résultats: health=$health_status session=$protected_status root=$hidden_status" >&2
exit 1
