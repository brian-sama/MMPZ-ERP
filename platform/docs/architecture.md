# Unified Enterprise Portal Architecture

## Vision

Digital Organization Platform:

`ERP + Intranet = Unified Enterprise Portal`

Target organizations:

- Churches
- Institutions
- NGOs
- Companies

Everything is accessed from a single portal dashboard.

## Technology Stack

- Frontend: React + Vite, TailwindCSS, Framer Motion, Lucide Icons
- Next.js compatibility: reserved for future SSR/public surfaces
- Backend: Django + Django REST Framework
- Realtime: Django Channels (WebSockets)
- Cache and jobs: Redis + Celery
- Database: PostgreSQL
- Runtime: Nginx + Gunicorn + Django
- No Docker required in production

## Project Structure

```text
platform
├ frontend
├ backend
├ database
├ uploads
├ scripts
└ docs
```

## Backend Architecture

```text
backend
├ core
│  ├ authentication
│  ├ users
│  ├ roles
│  ├ permissions
│  └ notifications
├ membership
├ finance
├ inventory
├ assets
├ reporting
├ intranet
│  ├ announcements
│  ├ documents
│  ├ messaging
│  ├ events
│  └ directory
├ integrations
│  ├ chatbot
│  ├ email_sender
│  └ payments
└ infrastructure
   ├ cache
   ├ storage
   └ queues
```

Each app follows:

`models.py`, `serializers.py`, `views.py`, `services.py`, `urls.py`, `permissions.py`

## API Architecture

- Base namespace: `/api/v1`
- Reserved namespace: `/api/v2`
- Core entry points:
  - `/api/v1/auth/*`
  - `/api/v1/users/*`
  - `/api/v1/members/*`
  - `/api/v1/assets/*`
  - `/api/v1/inventory/*`
  - `/api/v1/finance/*`
  - `/api/v1/announcements/*`

## Core Platform Services

- JWT authentication + refresh
- Session management
- Password reset flow
- RBAC roles:
  - `ADMIN`
  - `MANAGER`
  - `FINANCE_OFFICER`
  - `STAFF`
  - `MEMBER`
- Key permissions:
  - `members.view`
  - `members.edit`
  - `finance.approve`
  - `inventory.manage`
  - `documents.upload`

## Realtime and Performance

- Redis cache for heavy dashboard/member/inventory reads
- Celery queues for emails, reports, notifications, exports
- WebSocket channels:
  - `/ws/notifications/`
  - `/ws/messaging/{room_id}/`

## Security Baseline

- JWT + token rotation
- CSRF protections
- Input validation through serializers
- SQL injection protection via ORM/parameterized queries
- XSS and secure header defaults
- Audit logs for sensitive actions
