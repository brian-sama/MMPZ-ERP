#!/bin/bash

# VPS Infrastructure Setup Script for MMPZ & Bathudi
# Target OS: Ubuntu 24.04 LTS
# Author: Antigravity

set -e

echo "------------------------------------------------"
echo "🚀 Starting VPS Infrastructure Setup"
echo "------------------------------------------------"

# 1. Update System
echo "🔄 Updating system packages..."
sudo apt update && sudo apt upgrade -y

# 2. Install Prerequisites
echo "🛠️ Installing prerequisites..."
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common lsb-release gnupg

# 3. Create User 'brian' (if not exists)
if ! id "brian" &>/dev/null; then
    echo "👤 Creating user 'brian'..."
    sudo adduser --disabled-password --gecos "" brian
    sudo usermod -aG sudo brian
    echo "Password for 'brian' (Enter when prompted):"
    sudo passwd brian
else
    echo "✅ User 'brian' already exists."
fi

# 4. Install Docker & Docker Compose
echo "🐳 Installing Docker..."
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# 5. Add 'brian' to docker group
sudo usermod -aG docker brian

# 6. Install Nginx & Certbot
echo "🌐 Installing Nginx and Certbot..."
sudo apt install -y nginx certbot python3-certbot-nginx

# 7. Create Docker Network
echo "🕸️ Creating Docker network 'apps_network'..."
if ! docker network ls | grep -q "apps_network"; then
    sudo docker network create apps_network
else
    echo "✅ Network 'apps_network' already exists."
fi

# 8. Set up shared PostgreSQL container
echo "🐘 Starting shared PostgreSQL container..."
if ! docker ps -a | grep -q "bathudi_db"; then
    sudo docker run -d \
      --name bathudi_db \
      --network apps_network \
      --restart unless-stopped \
      -e POSTGRES_USER=bathudi_admin \
      -e POSTGRES_PASSWORD=Brian7350 \
      -e POSTGRES_DB=bathudi_db \
      -v bathudi_pgdata:/var/lib/postgresql/data \
      postgres:16-alpine
else
    echo "✅ PostgreSQL container 'bathudi_db' already exists."
fi

echo "------------------------------------------------"
echo "✅ Setup Complete!"
echo "------------------------------------------------"
echo "Next steps:"
echo "1. Log in as 'brian': ssh brian@<VPS_IP>"
echo "2. Clone your repository."
echo "3. Update docker-compose.yml to use the 'apps_network'."
echo "4. Use Nginx templates to point subdomains to container ports."
