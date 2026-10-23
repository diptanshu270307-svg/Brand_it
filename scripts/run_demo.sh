#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$ROOT/.env" ] && [ -f "$ROOT/.env.example" ]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
fi

if [ ! -d "$ROOT/backend/.venv" ]; then
  echo "==> Creating Python virtual environment and installing dependencies..."
  python3 -m venv "$ROOT/backend/.venv"
  "$ROOT/backend/.venv/bin/pip" install -q -r "$ROOT/backend/requirements.txt"
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "==> Installing frontend dependencies..."
  (cd "$ROOT/frontend" && npm install --no-audit --no-fund)
fi

echo "==> Resetting and seeding BrandLint demo database..."
(cd "$ROOT/backend" && .venv/bin/python -m app.seed --reset)

echo "==> Building React + TypeScript frontend..."
(cd "$ROOT/frontend" && npm run build)

echo "==> Starting BrandLint on http://127.0.0.1:8000 ..."
cd "$ROOT/backend"
exec .venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000
