# Deploying MMPZ System to a VPS

This guide explains how to deploy the MMPZ System to a standard Virtual Private Server (VPS) running Ubuntu (or similar Linux distribution).

## 1. Prerequisites

You will need:

- A VPS (e.g., Cloud VPS 10).
- SSH access to your VPS.
- A domain name pointing to your VPS IP address (optional but recommended).

## 2. Server Setup

Connect to your VPS via SSH:

```bash
ssh root@your_server_ip
```

### Update System

```bash
apt update && apt upgrade -y
```

### Install Node.js (v18+)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt install -y nodejs
```

### Install Git

```bash
apt install -y git
```

### Install PM2 (Process Manager)

```bash
npm install -g pm2
```

## 3. Application Deployment

### Clone the Repository

```bash
git clone https://github.com/yourusername/mmpz-system.git
cd mmpz-system
```

### Install Dependencies

```bash
# Install root dependencies (Express server)
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### Build Frontend

```bash
# This builds the React app into client/dist
npm run build
```

### Configure Environment Variables

Create a `.env` file in the root directory:

```bash
nano .env
```

Paste your Supabase credentials:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
PORT=3000
```

Save and exit (`Ctrl+X`, `Y`, `Enter`).

### Start the Server with PM2

```bash
pm2 start server.js --name "mmpz-system"
pm2 save
pm2 startup
```

## 4. Web Server Setup (Nginx)

To make your app accessible on port 80/443 (HTTP/HTTPS) instead of 3000.

### Install Nginx

```bash
apt install -y nginx
```

### Configure Nginx

Create a new configuration file:

```bash
nano /etc/nginx/sites-available/mmpz
```

Paste the following configuration:

```nginx
server {
    listen 80;
    server_name your_domain_or_ip;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the configuration:

```bash
ln -s /etc/nginx/sites-available/mmpz /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

## 5. Security (SSL) with Certbot (Optional)

If you have a domain name:

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d your_domain.com
```

## Verification

Visit `http://your_server_ip` (or your domain). You should see the MMPZ System running.
Test the API by logging in or checking network requests.
