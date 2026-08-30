#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/deploy/docker/compose.yml"
ENV_FILE="$ROOT_DIR/deploy/docker/node.env"
ADMIN_EMAIL=${1:-}

if [ -z "$ADMIN_EMAIL" ]; then
  echo "Usage: ./scripts/init-node.sh direction@restaurant.fr" >&2
  exit 2
fi
case "$ADMIN_EMAIL" in
  *@*.*) ;;
  *) echo "Adresse e-mail invalide: $ADMIN_EMAIL" >&2; exit 2 ;;
esac

for command_name in docker openssl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Commande requise absente: $command_name" >&2
    exit 1
  fi
done

if [ -f "$ENV_FILE" ]; then
  echo "Le fichier privé existe déjà: $ENV_FILE" >&2
  echo "Pour éviter d'écraser les secrets et les données, aucune modification n'a été faite." >&2
  exit 1
fi

umask 077
ADMIN_PASSWORD=$(openssl rand -hex 32)
APP_PASSWORD=$(openssl rand -hex 32)
SESSION_SECRET=$(openssl rand -hex 48)
OTP_PEPPER=$(openssl rand -hex 48)
NODE_TOKEN=$(openssl rand -hex 48)
COMPUTER_NODE_TOKEN=$(openssl rand -hex 48)
STORAGE_KEY=$(openssl rand -hex 32)

{
  echo "POSTGRES_ADMIN_PASSWORD=$ADMIN_PASSWORD"
  echo "POSTGRES_APP_PASSWORD=$APP_PASSWORD"
  echo "SESSION_SECRET=$SESSION_SECRET"
  echo "OTP_PEPPER=$OTP_PEPPER"
  echo "TABLENOW_NODE_TOKEN=$NODE_TOKEN"
  echo "TABLENOW_COMPUTER_NODE_TOKEN=$COMPUTER_NODE_TOKEN"
  echo "STORAGE_ENCRYPTION_KEY=$STORAGE_KEY"
  echo "NODE_ENV=production"
  echo "LOG_LEVEL=info"
  echo "PUBLIC_ORIGIN=http://localhost:8080"
  echo "PLATFORM_ADMIN_EMAIL=$ADMIN_EMAIL"
  echo "SESSION_TTL_HOURS=168"
  echo "OTP_TTL_MINUTES=10"
  echo "AUTH_FIXED_OTP="
  echo "EMAIL_TRANSPORT=smtp"
  echo "SMTP_HOST=mailpit"
  echo "SMTP_PORT=1025"
  echo "SMTP_SECURE=false"
  echo "SMTP_USER="
  echo "SMTP_PASSWORD="
  echo "EMAIL_FROM=TableNow <access@tablenow.local>"
  echo "AI_PROVIDER=deterministic"
  echo "AI_BASE_URL="
  echo "AI_API_KEY="
  echo "AI_MODEL=qwen3:8b"
  echo "AI_MAX_DAILY_EUR=5"
  echo "COMPUTER_HEADLESS=true"
  echo "COMPUTER_POLL_MS=2000"
  echo "COMPUTER_MAX_MODEL_STEPS=30"
  echo "OPENAI_API_KEY="
  echo "OPENAI_BASE_URL=https://api.openai.com/v1"
  echo "OPENAI_COMPUTER_MODEL=gpt-5.6"
  echo "DATA_RETENTION_MONTHS=24"
  echo "EXPORTS_DIR=/data/exports"
  echo "WORKER_POLL_MS=2000"
  echo "SYNC_ENABLED=false"
  echo "SYNC_PORT=4100"
  echo "TABLENOW_LEGAL_NAME=[DÉNOMINATION SOCIALE À COMPLÉTER]"
  echo "TABLENOW_LEGAL_FORM=[FORME JURIDIQUE À COMPLÉTER]"
  echo "TABLENOW_LEGAL_CAPITAL=[CAPITAL À COMPLÉTER]"
  echo "TABLENOW_LEGAL_REGISTRATION=[SIREN / RCS À COMPLÉTER]"
  echo "TABLENOW_LEGAL_ADDRESS=[SIÈGE SOCIAL À COMPLÉTER]"
  echo "TABLENOW_LEGAL_DIRECTOR=[DIRECTEUR DE PUBLICATION À COMPLÉTER]"
  echo "TABLENOW_LEGAL_HOST=TableNow Node local chez le client"
} > "$ENV_FILE"
chmod 600 "$ENV_FILE"

docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up --build --detach
"$ROOT_DIR/scripts/verify-node.sh"

echo
echo "TableNow Node est prêt."
echo "Application : http://localhost:8080"
echo "E-mails locaux : http://localhost:8025"
echo "Compte initial : $ADMIN_EMAIL"
echo "Le code de connexion se trouve dans Mailpit."
