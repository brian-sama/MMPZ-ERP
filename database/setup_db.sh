#!/bin/bash
set -e

# NOTE: The postgres docker-entrypoint already handles waiting for the DB
# to be ready before running scripts in /docker-entrypoint-initdb.d/
# This script runs inside that phase.

echo "Running 1: schema.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-init-scripts/schema.sql

echo "Running 2: seed.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-init-scripts/seed.sql

echo "Database successfully initialized and seeded!"
