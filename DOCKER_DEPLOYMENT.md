# Docker & Traefik Deployment Guide

This guide explains how to deploy the MMPZ System using Docker Compose and Traefik for automated SSL and reverse proxying.

## 1. Prerequisites

- A VPS with Docker and Docker Compose installed.
- Domain `mmpzmne.co.zw` pointed to your VPS IP.
- Port 80 and 443 must be open and not used by other services (like Nginx on the host).

## 2. Initial Setup on VPS

Clone the repository and prepare the Traefik storage:

```bash
git clone git@github.com:brian-sama/mmpz-system.git
cd mmpz-system

# Create traefik storage and set correct permissions
mkdir -p traefik_data
touch traefik_data/acme.json
chmod 600 traefik_data/acme.json
```

## 3. Configuration

The `docker-compose.yml` is already configured for `mmpzmne.co.zw`. 
Check your `.env` file (if needed by the app container) though most configuration is now handled via the compose file.

## 4. Deployment

Run the system:

```bash
docker-compose up -d --build
```

This will:
1. Start the PostgreSQL database.
2. Build and start the Node.js app.
3. Build and start the Streamlit dashboard.
4. Start Traefik, which will automatically request SSL certificates from Let's Encrypt.

## 5. Verification

- **Main App**: [https://mmpzmne.co.zw](https://mmpzmne.co.zw)
- **Dashboard**: [https://mmpzmne.co.zw/streamlit](https://mmpzmne.co.zw/streamlit)
- **API Health**: [https://mmpzmne.co.zw/api/health](https://mmpzmne.co.zw/api/health)

## 6. Maintenance Commands

- **View logs**: `docker-compose logs -f`
- **View Traefik logs specifically**: `docker-compose logs -f traefik`
- **Restart a service**: `docker-compose restart app`
- **Stop everything**: `docker-compose down`

## 7. Troubleshooting SSL

If SSL is not working (e.g., certificate error):
1. Check Traefik logs: `docker-compose logs traefik`
2. Ensure `mmpzmne.co.zw` is resolving to the correct IP.
3. Ensure ports 80 and 443 are open in your VPS firewall (e.g., `ufw allow 80/tcp`, `ufw allow 443/tcp`).
