#!/bin/sh
set -e

echo "Starting MMPZ ERP Deployment Lifecycle..."

mkdir -p /app/uploads/avatars /app/uploads/documents /app/uploads/volunteer-submissions

# Wait for DB to be ready to accept connections
attempts=0
max_attempts="${DB_WAIT_MAX_ATTEMPTS:-30}"
wait_interval="${DB_WAIT_INTERVAL_SECONDS:-2}"
while [ $attempts -lt $max_attempts ]; do
    echo "Checking database connectivity... ($((attempts+1))/$max_attempts)"
    if echo "import postgres from 'postgres'; const sql = postgres(process.env.DATABASE_URL); sql\`SELECT 1\`.then(() => process.exit(0)).catch(() => process.exit(1));" | node --input-type=module > /dev/null 2>&1; then
        echo "Database is ready!"
        break
    fi
    sleep "$wait_interval"
    attempts=$((attempts+1))
done

if [ $attempts -eq $max_attempts ]; then
    echo "Error: Database did not become ready in time. Exiting."
    exit 1
fi

if [ "${RUN_DB_MIGRATIONS_ON_STARTUP:-true}" = "true" ]; then
    echo "Running database migrations..."
    if ! npm run db:migrate:all; then
        echo "Migration failed. Check logs for details."
        exit 1
    fi
else
    echo "Skipping database migrations because RUN_DB_MIGRATIONS_ON_STARTUP=false"
fi

# Start the application
echo "Starting MMPZ ERP Server..."
exec npm start
