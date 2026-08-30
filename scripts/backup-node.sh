#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/deploy/docker/compose.yml"
ENV_FILE="$ROOT_DIR/deploy/docker/node.env"
BACKUP_DIR="$ROOT_DIR/backups"

if [ ! -f "$ENV_FILE" ]; then
  echo "Configuration TableNow Node absente." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
umask 077
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TARGET="$BACKUP_DIR/tablenow-$STAMP.dump"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U tablenow_admin -d tablenow_v2 --format=custom --no-owner --no-acl > "$TARGET"

if [ ! -s "$TARGET" ]; then
  echo "La sauvegarde est vide; vérification requise." >&2
  exit 1
fi
chmod 600 "$TARGET"
echo "$TARGET"
