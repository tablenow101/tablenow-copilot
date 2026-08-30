#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$ROOT_DIR/deploy/cloud/cloud.env"
BASE_COMPOSE="$ROOT_DIR/deploy/docker/compose.yml"
CLOUD_COMPOSE="$ROOT_DIR/deploy/cloud/compose.override.yml"

if [ ! -f "$ENV_FILE" ]; then
  echo "Configuration cloud absente; lancez d'abord ./scripts/init-cloud.sh." >&2
  exit 1
fi
if grep -q 'replace-with-' "$ENV_FILE"; then
  echo "Le SMTP réel doit être renseigné avant tout démarrage cloud." >&2
  exit 1
fi
if grep -q '^AUTH_FIXED_OTP=.' "$ENV_FILE"; then
  echo "Un code fixe est interdit dans le cloud." >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$BASE_COMPOSE" -f "$CLOUD_COMPOSE" config --quiet
docker compose --env-file "$ENV_FILE" -f "$BASE_COMPOSE" -f "$CLOUD_COMPOSE" up --build --detach
"$ROOT_DIR/scripts/verify-cloud.sh"
