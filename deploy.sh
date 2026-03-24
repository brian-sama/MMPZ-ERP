#!/bin/bash

# MMPZ ERP Automated Deployment Script

echo "🚀 Starting MMPZ ERP Deployment..."

# 1. Pull latest changes
echo "📥 Pulling latest code..."
git pull origin main

# 2. Build and restart containers
echo "🏗️ Building and restarting containers..."
docker-compose build app
docker-compose up -d

# 3. Run database migrations
echo "🗄️ Running database migrations..."
docker-compose exec app npm run db:migrate:all

# 4. Clean up unused images
echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Deployment complete!"
