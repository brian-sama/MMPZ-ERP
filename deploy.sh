#!/bin/bash

# MMPZ ERP Automated Deployment Script

echo "🚀 Starting MMPZ ERP Deployment..."

# 1. Pull latest changes
echo "📥 Pulling latest code..."
git pull origin main

# Automagically detect whether to use 'docker-compose' or 'docker compose'
if docker compose version >/dev/null 2>&1; then
  DC_CMD="docker compose"
elif docker-compose version >/dev/null 2>&1; then
  DC_CMD="docker-compose"
else
  echo "❌ Error: Neither 'docker compose' nor 'docker-compose' found."
  exit 1
fi

# 2. Build and restart containers
echo "🏗️ Building and restarting containers using $DC_CMD..."
$DC_CMD build app
$DC_CMD up -d

# 3. Run database migrations
echo "🗄️ Running database migrations..."
$DC_CMD exec app npm run db:migrate:all

# 4. Clean up unused images
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Deployment complete!"
