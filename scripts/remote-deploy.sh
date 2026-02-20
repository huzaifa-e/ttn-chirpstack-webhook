#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/emoni/ttn-lorawan}"
BRANCH="${BRANCH:-main}"

cd "$APP_DIR"

echo "[deploy] pull latest on branch: $BRANCH"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "[deploy] docker compose up"
docker compose up -d --build

echo "[deploy] done"
docker compose ps
