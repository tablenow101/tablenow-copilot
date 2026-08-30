#!/usr/bin/env sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
ENV_FILE="$ROOT_DIR/deploy/cloud/cloud.env"
ADMIN_EMAIL=${1:-}
API_DOMAIN=${2:-}
PUBLIC_ORIGIN=${3:-}

if [ -z "$ADMIN_EMAIL" ] || [ -z "$API_DOMAIN" ] || [ -z "$PUBLIC_ORIGIN" ]; then
  echo "Usage: ./scripts/init-cloud.sh direction@tablenow.io api.copilot.tablenow.io https://copilot.tablenow.io" >&2
  exit 2
fi
case "$ADMIN_EMAIL" in *@*.*) ;; *) echo "Adresse e-mail invalide." >&2; exit 2 ;; esac
case "$API_DOMAIN" in *.*) ;; *) echo "Domaine API invalide." >&2; exit 2 ;; esac
case "$PUBLIC_ORIGIN" in https://*) ;; *) echo "L'origine publique doit commencer par https://" >&2; exit 2 ;; esac

for command_name in docker openssl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "Commande requise absente: $command_name" >&2
    exit 1
  fi
done

if [ -f "$ENV_FILE" ]; then
  echo "Configuration cloud déjà présente; aucun secret n'a été écrasé." >&2
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

sed \
  -e "s|^API_DOMAIN=.*|API_DOMAIN=$API_DOMAIN|" \
  -e "s|^PUBLIC_ORIGIN=.*|PUBLIC_ORIGIN=$PUBLIC_ORIGIN|" \
  -e "s|^PLATFORM_ADMIN_EMAIL=.*|PLATFORM_ADMIN_EMAIL=$ADMIN_EMAIL|" \
  -e "s|^POSTGRES_ADMIN_PASSWORD=.*|POSTGRES_ADMIN_PASSWORD=$ADMIN_PASSWORD|" \
  -e "s|^POSTGRES_APP_PASSWORD=.*|POSTGRES_APP_PASSWORD=$APP_PASSWORD|" \
  -e "s|^SESSION_SECRET=.*|SESSION_SECRET=$SESSION_SECRET|" \
  -e "s|^OTP_PEPPER=.*|OTP_PEPPER=$OTP_PEPPER|" \
  -e "s|^TABLENOW_NODE_TOKEN=.*|TABLENOW_NODE_TOKEN=$NODE_TOKEN|" \
  -e "s|^TABLENOW_COMPUTER_NODE_TOKEN=.*|TABLENOW_COMPUTER_NODE_TOKEN=$COMPUTER_NODE_TOKEN|" \
  -e "s|^STORAGE_ENCRYPTION_KEY=.*|STORAGE_ENCRYPTION_KEY=$STORAGE_KEY|" \
  "$ROOT_DIR/deploy/cloud/cloud.env.example" > "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "Secrets V2 générés dans deploy/cloud/cloud.env."
echo "Renseignez le SMTP réel et les informations juridiques avant le démarrage."
echo "Aucun conteneur n'a été lancé automatiquement."
