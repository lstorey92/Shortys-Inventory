#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/shortys-inventory"
cd "$APP_DIR"

if [[ ! -f .env.aws ]]; then
  echo "Missing .env.aws in $APP_DIR"
  exit 1
fi

if [[ ! -f docker-compose.ec2.yml ]]; then
  echo "Missing docker-compose.ec2.yml in $APP_DIR"
  exit 1
fi

docker compose -f docker-compose.ec2.yml down || true
docker compose -f docker-compose.ec2.yml build --pull
docker compose -f docker-compose.ec2.yml up -d

echo "Deployment complete."
