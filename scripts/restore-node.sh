#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/deploy/docker/compose.yml"
ENV_FILE="$ROOT_DIR/deploy/docker/node.env"
SOURCE=${1:-}
CONFIRM=${2:-}

if [ -z "$SOURCE" ] || [ "$CONFIRM" != "--yes" ]; then
  echo "Usage: ./scripts/restore-node.sh backups/tablenow-AAAA.dump --yes" >&2
  echo "La restauration remplace la base active après avoir créé une sauvegarde de sécurité." >&2
  exit 2
fi
if [ ! -f "$SOURCE" ] || [ ! -s "$SOURCE" ]; then
  echo "Sauvegarde introuvable ou vide: $SOURCE" >&2
  exit 2
fi
if [ ! -f "$ENV_FILE" ]; then
  echo "Configuration TableNow Node absente." >&2
  exit 1
fi
SAFETY_BACKUP=$("$ROOT_DIR/scripts/backup-node.sh")
echo "Sauvegarde de sécurité créée: $SAFETY_BACKUP"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" stop core-api worker console proxy
if docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_restore -U tablenow_admin -d tablenow_v2 --clean --if-exists --no-owner --no-acl < "$SOURCE"; then
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" run --rm db-grants
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up --detach core-api worker console proxy
  "$ROOT_DIR/scripts/verify-node.sh"
  echo "Restauration terminée."
else
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up --detach core-api worker console proxy
  echo "La restauration a échoué. La sauvegarde de sécurité est disponible: $SAFETY_BACKUP" >&2
  exit 1
fi
