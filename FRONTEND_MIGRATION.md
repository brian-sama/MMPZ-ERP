# Frontend API Migration Guide

## Changes Made

### 1. API Configuration (`client/src/apiConfig.js`)

Created a new API configuration file that automatically switches between:

- **Local Development**: `http://localhost:8888/.netlify/functions` (Netlify Dev)
- **Production**: `/.netlify/functions` (Netlify deployed)
- **Fallback**: `http://localhost:3001/api` (Old Express server)

### 2. App.jsx Updates

- Replaced hardcoded `API_BASE` with import from `apiConfig.js`
- All existing API calls remain unchanged
- Automatic switching based on environment

## API Endpoint Mapping

The frontend uses these endpoints (already compatible with Netlify Functions):

### Authentication

- `POST /login` → `/.netlify/functions/login`

### Indicators

- `GET /indicators` → `/.netlify/functions/get-indicators`
- `POST /indicators` → `/.netlify/functions/create-indicator`
- `PUT /indicators/:id` → `/.netlify/functions/update-indicator`
- `DELETE /indicators/:id` → `/.netlify/functions/delete-indicator`
- `PATCH /indicators/:id/complete` → `/.netlify/functions/mark-indicator-complete`
- `GET /indicators/search` → `/.netlify/functions/search-indicators`
- `POST /indicators/:id/progress` → `/.netlify/functions/create-progress`
- `GET /indicators/:id/progress` → `/.netlify/functions/get-progress`

### Activities

- `POST /activities` → `/.netlify/functions/create-activity`

### Users (Admin)

- `GET /users` → `/.netlify/functions/get-users`
- `POST /users` → `/.netlify/functions/create-user`
- `PATCH /users/:id/role` → `/.netlify/functions/update-user-role`
- `DELETE /users/:id` → `/.netlify/functions/delete-user`

### Progress & Approvals

- `GET /approvals/pending` → `/.netlify/functions/get-pending-approvals`
- `PATCH /progress/:id/approve` → `/.netlify/functions/approve-progress`

### Notifications

- `GET /notifications` → `/.netlify/functions/get-notifications`
- `PATCH /notifications/:id/read` → `/.netlify/functions/mark-notification-read`
- `PATCH /notifications/read-all` → `/.netlify/functions/mark-all-notifications-read`

### Export

- `GET /export/indicators` → `/.netlify/functions/export-indicators` (not yet created)

### KoboToolbox (Optional - not yet migrated)

- `GET /kobo/config`
- `POST /kobo/config`
- `POST /kobo/disconnect`
- `GET /kobo/forms`
- `POST /kobo/link`
- `GET /kobo/links`
- `DELETE /kobo/link/:id`
- `POST /kobo/sync/:id`
- `POST /kobo/sync-all`

### Reports (Optional - not yet migrated)

- `GET /reports/pdf`
- `GET /reports/excel`

## Testing Locally

1. **Install Netlify CLI** (if not already installed):

   ```bash
   npm install -g netlify-cli
   ```

2. **Run Netlify Dev**:

   ```bash
   netlify dev
   ```

   This starts:
   - Frontend: `http://localhost:8888`
   - Functions: `http://localhost:8888/.netlify/functions`

3. **Test Login**:
   - Email: `admin@mmpz.org`
   - Password: `admin123`

## Next Steps

1. ✅ API configuration created
2. ✅ Frontend updated to use new config
3. ⏳ Test with Netlify Dev
4. ⏳ Fix any API compatibility issues
5. ⏳ Deploy to Netlify
6. ⏳ Delete old Express server files

## Notes

- The `netlify.toml` redirects handle the API routing automatically
- No changes needed to existing API calls in App.jsx
- Environment detection is automatic
- Offline mode functionality preserved
