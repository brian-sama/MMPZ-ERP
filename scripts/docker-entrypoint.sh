#!/bin/sh
set -e

# Extract host/port from DATABASE_URL for health-check if possible
# Or just use a simple netcat/ping check if available in alpine
# Since we have node, we can also use a quick node check

echo "Starting MMPZ ERP Deployment Lifecycle..."

# Wait for DB to be ready to accept connections
attempts=0
max_attempts=30
while [ $attempts -lt $max_attempts ]; do
    if node -e "import postgres from 'postgres'; const sql = postgres(process.env.DATABASE_URL); await sql\`SELECT 1\`; process.exit(0);" 2>/dev/null; then
        echo "Database is ready!"
        break
    fi
    echo "Waiting for database... ($((attempts+1))/$max_attempts)"
    sleep 2
    attempts=$((attempts+1))
done

if [ $attempts -eq $max_attempts ]; then
    echo "Error: Database did not become ready in time. Exiting."
    exit 1
fi

# Run migrations
echo "Running database migrations..."
if ! npm run db:migrate:all; then
    echo "Migration failed. Check logs for details."
    exit 1
fi

# Start the application
echo "Starting MMPZ ERP Server..."
exec npm start
