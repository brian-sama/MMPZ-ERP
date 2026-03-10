# Deployment Guide (No Docker)

## Production Target

- Domain: `intranet.mmpzmne.co.zw`
- Single host routing via Nginx:
  - `/` -> frontend static bundle (`platform/frontend/dist`)
  - `/api/` -> Django REST (Gunicorn)
  - `/ws/` -> Django Channels (Daphne)

## Runtime Topology

```text
Internet
  -> Nginx (TLS)
    -> /api  -> Gunicorn :8000
    -> /ws   -> Daphne   :8001
    -> /     -> frontend dist

Django dependencies:
  -> PostgreSQL
  -> Redis
  -> File storage (/uploads)
```

## Required Environment Variables

### Backend (`platform/backend/.env`)

```env
DJANGO_SECRET_KEY=<strong-secret>
DJANGO_DEBUG=0
DJANGO_ALLOWED_HOSTS=intranet.mmpzmne.co.zw
CORS_ALLOWED_ORIGINS=https://intranet.mmpzmne.co.zw
CSRF_TRUSTED_ORIGINS=https://intranet.mmpzmne.co.zw

DB_ENGINE=django.db.backends.postgresql
DB_NAME=<db_name>
DB_USER=<db_user>
DB_PASSWORD=<db_password>
DB_HOST=<db_host>
DB_PORT=5432

REDIS_URL=redis://127.0.0.1:6379/0
USE_REDIS_CACHE=1

SECURE_SSL_REDIRECT=1
SESSION_COOKIE_SECURE=1
CSRF_COOKIE_SECURE=1
USE_SECURE_PROXY_SSL_HEADER=1
SECURE_HSTS_SECONDS=31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS=1
SECURE_HSTS_PRELOAD=1
ALLOW_DJANGO_ADMIN=0
```

### Frontend (`platform/frontend/.env.production`)

```env
VITE_API_BASE=https://intranet.mmpzmne.co.zw/api/v1
VITE_WS_BASE=wss://intranet.mmpzmne.co.zw
```

## Build and Deploy

### 1. Backend

```bash
cd /opt/unified-enterprise-portal/platform/backend
source venv/bin/activate
python manage.py migrate --noinput
python manage.py collectstatic --noinput
python manage.py seed_access_control
python manage.py check
```

### 2. Frontend

```bash
cd /opt/unified-enterprise-portal/platform/frontend
npm ci
npm run build
```

### 3. Nginx + TLS

- Use config: `platform/scripts/nginx/unified_portal.conf`
- Symlink into `/etc/nginx/sites-available/` and enable in `sites-enabled`.
- Issue certificate:

```bash
sudo certbot --nginx -d intranet.mmpzmne.co.zw
sudo systemctl reload nginx
```

### 4. Process Services (systemd)

Template units are under `platform/scripts/systemd/`:

- `gunicorn.service`
- `daphne.service`
- `celery-worker.service`
- `celery-beat.service`

Install them under `/etc/systemd/system/`, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now gunicorn daphne
sudo systemctl enable --now celery-worker celery-beat
sudo systemctl restart gunicorn daphne celery-worker celery-beat
```

## Upload Paths

- `/uploads/documents`
- `/uploads/avatars`
- `/uploads/exports`

Database stores metadata only. File binaries remain on filesystem.

## Production-Direct Cutover Runbook

1. Backup database and environment config snapshot.
2. Build frontend and deploy `dist` bundle.
3. Apply backend env vars and restart Gunicorn/Daphne/Celery services.
4. Apply Nginx config and TLS cert, reload Nginx.
5. Run smoke checks against `https://intranet.mmpzmne.co.zw`:
   - login -> dashboard
   - create member
   - record donation
   - upload document + preview
   - websocket notification connect
   - checklist reference: `platform/docs/smoke-checklist.md`
6. Monitor for at least 60 minutes:
   - 5xx rate
   - auth failures
   - websocket disconnects
   - queue backlog
7. Rollback if needed:
   - restore previous frontend bundle
   - restore previous backend env/config
   - restore DB backup for schema/data regressions

## Quick Validation Commands

```bash
curl -I https://intranet.mmpzmne.co.zw
curl -I https://intranet.mmpzmne.co.zw/api/v1/auth/session/
```
