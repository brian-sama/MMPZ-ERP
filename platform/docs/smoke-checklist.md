# Production Smoke Checklist (`intranet.mmpzmne.co.zw`)

## Domain and Routing

- Open `https://intranet.mmpzmne.co.zw` and confirm valid TLS certificate.
- Confirm no mixed-content errors in browser console.
- Confirm API route responds: `https://intranet.mmpzmne.co.zw/api/v1/auth/session/`.

## Authentication and Session

- Login with a valid user.
- Refresh browser and confirm session remains valid with JWT refresh flow.
- Logout and confirm protected routes redirect to `/login`.

## ERP Flows

- Members: create member, search, bulk category update, bulk soft delete, bulk restore.
- Finance: record donation, record expense, confirm summary cards update.
- Inventory: create stock movement, apply low-stock filter, run bulk reorder-level update.
- Assets: create location, asset, maintenance record, and depreciation record.

## Intranet Flows

- Announcements: create and edit announcement.
- Documents: upload document, open preview, add a new version.
- Messaging: create/select channel, send message, confirm realtime updates.
- Events: create and edit event.
- Directory: create and edit directory entry.
- Knowledge Base: create and edit article.

## Admin Flows

- Users: search/filter, bulk activate/suspend/force-reset, export CSV.
- Roles: create role, assign role, bulk role assignment, export CSV.
- Settings: confirm health, cache, and queue views load.

## Realtime and Notifications

- Confirm websocket notifications connect at `/ws/notifications/?token=<access>`.
- Confirm messaging websocket connects at `/ws/messaging/<room_id>/?token=<access>`.
- Trigger one audited action and confirm activity feed updates.

## Security Checks

- Confirm restricted routes are hidden/blocked by permission.
- Confirm missing permission users cannot access protected API actions.
- Confirm auth endpoints return throttling behavior according to configured rates.

## Rollback Readiness

- Verify latest DB backup exists before rollout.
- Verify previous frontend bundle is retained.
- Verify previous backend env/config snapshot is retained.
