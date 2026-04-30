# MMPZ ERP Operations Hardening

This guide captures optional production hardening steps for the current MMPZ ERP stack. These steps are intentionally separate from local development and normal app startup.

## Backups

- Schedule PostgreSQL backups outside the application container.
- Store backups outside the VPS when possible, such as object storage or a separate backup host.
- Keep at least daily backups for the last 7 days and weekly backups for the last 4 weeks.
- Test restore steps after every major schema change.

Example backup command:

```bash
pg_dump "$DATABASE_URL" > "mmpz_erp_$(date +%Y%m%d_%H%M%S).sql"
```

## Database Monitoring

- Enable PostgreSQL query monitoring on production databases where supported.
- Track slow queries against reporting, finance, budget, and analytics endpoints.
- Review table/index growth after Kobo imports, document uploads, and volunteer submissions.

Optional PostgreSQL extension:

```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

## Server Security

- Keep SSH key-only access for production users.
- Disable password SSH login after confirming key access works.
- Restrict firewall ingress to SSH, HTTP, and HTTPS unless another service is explicitly required.
- Keep database ports private to the Docker network or local host.
- Rotate application secrets after staff transitions or suspected exposure.

Example UFW baseline:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Deployment Checks

- Run `npm run build` before deploying frontend changes.
- Confirm `/api/health` responds after deployment.
- Smoke test login, dashboard, M&E, budget tracker, reports, and governance queue.
- Confirm scheduled backups still run after container or VPS changes.

## Notes

The `mmpz-system` reference folder contains older backup, monitoring, and security scripts. Treat those as reference material only. Adapt commands to the current server layout before running them on production.
