# VPS Deployment Guide (Docker & Nginx)

This guide explains how to deploy the MMPZ ERP System and other associated services to a VPS using Docker.
We use **Nginx** natively installed on the host OS as our reverse proxy, which seamlessly routes subdomains to our various Docker containers based on host port mapping.

## 1. Prerequisites
- A fresh Ubuntu 24.04 VPS.
- Domains pointed to your VPS (e.g., `mmpzmne.co.zw`, `streamlit.mmpzmne.co.zw`, `bathudi.co.za`).

## 2. Server Setup

We have provided an automated bash script to initialize the VPS.

1. SSH into the VPS as root: `ssh root@<VPS_IP>`
2. Transfer the `scripts/setup_vps.sh` file to the server and make it executable: `chmod +x setup_vps.sh`
3. Run the setup: `./setup_vps.sh`

This script will:
- Install Docker and Nginx.
- Set up a secure `brian` user.
- Create the shared `apps_network` for containers to communicate.
- Spin up a shared PostgreSQL database (`bathudi_db`).

## 3. Clone and Start App

From your VPS, authenticated as `brian`:

```bash
git clone git@github.com:brian-sama/mmpz-system.git
cd mmpz-system
```

Start the application stack:

```bash
docker-compose up -d --build
```

**Port Mapping Overview:**
- **MMPZ ERP Frontend/Node API**: Port `3001`
- **MMPZ Streamlit Dashboard**: Port `8501`
- *(Future integrations like Bathudi will map to unique ports like `8010` and `8080`)*

## 4. Reverse Proxy Setup (Nginx)

Now we route external traffic to our new containers using the provided templates in the `nginx/templates` directory.

1. Copy the templates to Nginx sites-available:
   ```bash
   sudo cp nginx/templates/mmpzmne.conf /etc/nginx/sites-available/
   ```

2. Enable the sites:
   ```bash
   sudo ln -s /etc/nginx/sites-available/mmpzmne.conf /etc/nginx/sites-enabled/
   ```

3. Test and reload Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

## 5. SSL Installation (HTTPS)

Secure the routes via Let's Encrypt using Certbot:

```bash
sudo certbot --nginx -d mmpzmne.co.zw -d streamlit.mmpzmne.co.zw
```

Follow the prompts to enable HTTPS. You're done!
