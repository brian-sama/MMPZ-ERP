#!/bin/sh
set -e

echo "Starting MMPZ ERP Deployment Lifecycle..."

# Run migrations
echo "Running database migrations..."
npm run db:migrate:all

# Start the application
echo "Starting MMPZ ERP Server..."
exec npm start
