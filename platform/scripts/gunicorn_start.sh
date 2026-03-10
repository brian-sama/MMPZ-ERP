#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../backend"
source venv/Scripts/activate

exec gunicorn config.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 4 \
  --threads 2 \
  --timeout 120
