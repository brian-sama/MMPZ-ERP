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

## 3. Clone and Start Apps (ERP & M&E)

From your VPS, authenticated as `brian`:

### A. Deploy MMPZ ERP (mmpzmne.co.zw)
```bash
git clone git@github.com:brian-sama/mmpz-system.git erp-system
cd erp-system
docker compose up -d --build
```
> [!NOTE]
> Database migrations (`db:migrate:all`) and non-overwriting seeds (`db:seed`) will run automatically on startup. Any existing custom settings or user passwords will remain completely untouched.

### B. Deploy MMPZ Compass M&E (monitoring.mmpzmne.co.zw)
```bash
git clone git@github.com:brian-sama/mmpz-compass.git compass-system
cd compass-system
docker compose up -d --build
```

**Port Mapping Overview:**
- **MMPZ ERP API & Web Client**: Port `3001` (Internal `3000`)
- **MMPZ Streamlit Dashboard**: Port `8501` (Internal `8501`)
- **MMPZ Compass M&E & API**: Port `4001` (Internal `4000`)

---

## 4. Reverse Proxy Setup (Nginx)

Route external public traffic to your active Docker containers using the provided high-performance Nginx templates.

1. **Copy the templates** to Nginx sites-available:
   ```bash
   # ERP & Streamlit
   sudo cp /home/brian/erp-system/nginx/templates/mmpzmne.conf /etc/nginx/sites-available/
   
   # M&E Compass
   sudo cp /home/brian/compass-system/nginx/templates/monitoring.mmpzmne.conf /etc/nginx/sites-available/
   ```

2. **Enable the site configurations**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/mmpzmne.conf /etc/nginx/sites-enabled/
   sudo ln -s /etc/nginx/sites-available/monitoring.mmpzmne.conf /etc/nginx/sites-enabled/
   ```

3. **Test and reload Nginx**:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

---

## 5. SSL Installation (HTTPS)

Secure the subdomains via Let's Encrypt using Certbot:

```bash
sudo certbot --nginx -d mmpzmne.co.zw -d streamlit.mmpzmne.co.zw -d monitoring.mmpzmne.co.zw
```

Follow the prompts to enable HTTPS. You're done!

## 6. Optional Operations Hardening

Production hardening guidance is documented in `docs/OPERATIONS_HARDENING.md`.
Use it for backup scheduling, database monitoring, SSH/firewall hardening, and deployment smoke checks. These steps are intentionally opt-in and are not part of normal local development startup.
