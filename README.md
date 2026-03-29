# MMPZ ERP

Million Memory Project Zimbabwe (MMPZ) ERP built as a single integrated system for governance, programs, M&E, volunteers, and finance.

## Current Architecture

- Frontend: React + Vite (`client/`)
- Backend API: Express server (`server.js` + `server/api/`)
- Database: PostgreSQL via `DATABASE_URL`
- Schema source of truth: `database/schema.sql` (single comprehensive schema)
- Seed data: `database/seed.sql`

Netlify functions and Netlify runtime are removed from the active stack.

## Deployment

For production deployment using Docker and Traefik (recommended for `mmpzmne.co.zw`), see [DOCKER_DEPLOYMENT.md](file:///c:/Users/brian/3D%20Objects/Personal%20Projects/MMPZ%20ERP/DOCKER_DEPLOYMENT.md).

## Local Setup

1. Install dependencies:

```bash
npm install
cd client && npm install
```

1. Configure env:

```bash
cp .env.example .env
```

Default `.env.example`:

```env
DATABASE_URL=postgresql://mmpz:mmpz@localhost:5432/mmpz_erp_local?sslmode=disable
```

1. Start local PostgreSQL (Docker):

```bash
npm run db:up
```

1. Apply schema + seed:

```bash
npm run db:migrate
npm run db:seed
```

Or reset end-to-end:

```bash
npm run db:reset
```

1. Start app:

```bash
npm run dev
```

- Frontend: `http://localhost:5173`
- API: `http://localhost:3000`

## Super Admin (Seeded)

- Email: `brianmagagula5@gmail.com`
- Password: `Brian7350$@#`
- Role: `DIRECTOR`

## Canonical Governance Roles

- `DIRECTOR`
- `FINANCE_ADMIN_OFFICER`
- `ADMIN_ASSISTANT`
- `LOGISTICS_ASSISTANT`
- `PSYCHOSOCIAL_SUPPORT_OFFICER`
- `COMMUNITY_DEVELOPMENT_OFFICER`
- `ME_INTERN_ACTING_OFFICER`
- `SOCIAL_SERVICES_INTERN`
- `YOUTH_COMMUNICATIONS_INTERN`
- `DEVELOPMENT_FACILITATOR`

## NPM Scripts

- `npm run dev`: ensure DB is reachable, then run API + frontend together
- `npm run dev:app`: run API + frontend only (without starting Docker DB)
- `npm run api`: run Express API only
- `npm run build`: build frontend
- `npm run db:dev`: ensure DB availability (use running local DB or start Docker DB)
- `npm run db:up`: start local Postgres container
- `npm run db:down`: stop local Postgres container
- `npm run db:migrate`: apply `database/schema.sql`
- `npm run db:seed`: apply `database/seed.sql`
- `npm run db:reset`: drop/recreate `public`, then migrate + seed

## Notes

- API compatibility fields are still returned for frontend continuity (`role`), while canonical fields (`role_code`, `role_assignment_status`, `role_confirmed_at`) are authoritative.
- If Docker is not installed locally, install Docker Desktop first; DB scripts require it unless you point `DATABASE_URL` to an existing PostgreSQL instance.

