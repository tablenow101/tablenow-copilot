#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/deploy/docker/compose.yml"
ENV_FILE="$ROOT_DIR/deploy/docker/node.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Configuration absente. Lancez d'abord ./scripts/init-node.sh adresse@email.fr" >&2
  exit 1
fi

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps

attempt=0
while [ "$attempt" -lt 30 ]; do
  if curl --fail --silent --show-error http://localhost:8080/api/health >/dev/null \
    && curl --fail --silent --show-error http://localhost:8080/login >/dev/null; then
    echo "Vérification réussie: interface et API opérationnelles."
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 2
done

echo "TableNow n'a pas répondu dans le délai prévu." >&2
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" logs --tail=100 core-api console proxy >&2
exit 1
