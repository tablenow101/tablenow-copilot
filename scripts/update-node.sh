#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/deploy/docker/compose.yml"
ENV_FILE="$ROOT_DIR/deploy/docker/node.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Configuration TableNow Node absente." >&2
  exit 1
fi

BACKUP=$("$ROOT_DIR/scripts/backup-node.sh")
echo "Sauvegarde avant mise à jour: $BACKUP"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" build
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm migrate
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm db-grants
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up --detach --remove-orphans
"$ROOT_DIR/scripts/verify-node.sh"
