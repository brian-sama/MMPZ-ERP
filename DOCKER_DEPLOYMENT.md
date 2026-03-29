# Docker & Shared Traefik Deployment Guide

This guide explains how to deploy the MMPZ System to a VPS that already has a **Global Traefik** instance running (such as one used for multiple websites like Lunia).

## 1. Prerequisites

- A VPS with Docker and Docker Compose installed.
- **Global Traefik** already running on the server.
- The network **`traefik-public`** must exist (it was detected as your global entry point).
- Domain `mmpzmne.co.zw` pointed to your VPS IP.

## 2. Initial Setup on VPS

Clone the repository:

```bash
git clone git@github.com:brian-sama/mmpz-system.git
cd mmpz-system
```

*(Note: You do NOT need to create a `traefik_data` directory for this project as the global Traefik handles all SSL certificates.)*

## 3. Configuration

The `docker-compose.yml` is configured to connect to your existing `traefik-public` network. 

**SSL Resolver Name**: This setup assumes your global Traefik uses the name `myresolver` for Let's Encrypt. If your global configuration use a different name (like `letsencrypt`), update the following labels in `docker-compose.yml`:
- `traefik.http.routers.mmpz_app.tls.certresolver`
- `traefik.http.routers.mmpz_streamlit.tls.certresolver`

## 4. Deployment

Run the system:

```bash
docker-compose up -d --build
```

This will:
1. Start the PostgreSQL database on a private internal network (`mmpz_inner`).
2. Build and start the Node.js app and Streamlit dashboard.
3. Automatically register these services with your **existing** Traefik instance via the `traefik-public` network.

## 5. Verification

- **Main App**: [https://mmpzmne.co.zw](https://mmpzmne.co.zw)
- **Dashboard**: [https://mmpzmne.co.zw/streamlit](https://mmpzmne.co.zw/streamlit)

## 6. Troubleshooting

### Network Not Found Error
If you see an error saying `network traefik-public not found`, verify the exact name of your global Traefik network:
```bash
docker network ls
```

### SSL Not Working
If the site loads but shows a security warning:
1. Check the logs of your **global** Traefik container (not the MMPZ containers).
2. Ensure the `certresolver` name in `docker-compose.yml` matches your global Traefik config.

## 7. Troubleshooting

### Container Name Conflict
If you see an error like `The container name "/traefik" is already in use`:
Check if you have another project using Traefik. If it's a stale container, remove it:
```bash
docker rm -f traefik
```

### Port Conflict (80/443)
If you see an error like `Bind for 0.0.0.0:80 failed: port is already allocated`:
This means another web server (Nginx, or another Traefik instance) is using those ports. 
- You must stop the other service: `sudo systemctl stop nginx` or `docker stop other_container`.
- **Note**: If you want to host **multiple** sites (e.g. Lunia and MMPZ) on the same VPS, you should use only **one** Traefik instance. Contact Brian for help merging the configurations.

### SSL Issuance
If SSL is not working:
1. Check Traefik logs: `docker-compose logs traefik`
2. Ensure `mmpzmne.co.zw` is resolving to the correct IP.
3. Check `traefik_data/acme.json` permissions (must be `600`).
