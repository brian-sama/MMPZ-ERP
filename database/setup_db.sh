#!/bin/bash
set -e

# Wait until the database is ready just in case
until pg_isready -h "localhost" -p 5432 -U "$POSTGRES_USER"; do
  echo "Waiting for postgres..."
  sleep 2
done

echo "Running 1: schema.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-init-scripts/schema.sql

echo "Running 2: rebuild_schema.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-init-scripts/rebuild_schema.sql

echo "Running 3: seed.sql..."
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f /docker-init-scripts/seed.sql

echo "Database successfully initialized and seeded!"
