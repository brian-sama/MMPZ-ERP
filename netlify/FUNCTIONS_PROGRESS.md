# Netlify Functions Migration Progress

## Completed Functions ✅

### Authentication

- [x] `login.js` - User authentication with bcrypt

### Indicators

- [x] `get-indicators.js` - Get indicators with role-based filtering
- [x] `create-indicator.js` - Create new indicator
- [x] `update-indicator.js` - Update indicator with ownership check
- [x] `delete-indicator.js` - Delete indicator with ownership check

### Activities

- [x] `create-activity.js` - Create activity with budget tracking and warnings

### Users (Admin)

- [x] `get-users.js` - Get all users (admin only)
- [x] `create-user.js` - Create new user with password hashing

### Progress Updates

- [x] `create-progress.js` - Create progress update with approval workflow

### Notifications

- [x] `get-notifications.js` - Get user notifications

## Remaining Functions to Create

### Progress Updates

- [ ] `get-progress.js` - Get progress history for indicator
- [ ] `approve-progress.js` - Approve/reject progress updates
- [ ] `get-pending-approvals.js` - Get pending approvals (admin/director)

### Users (Admin)

- [ ] `update-user-role.js` - Update user role
- [ ] `delete-user.js` - Delete user

### Notifications

- [ ] `mark-notification-read.js` - Mark single notification as read
- [ ] `mark-all-notifications-read.js` - Mark all notifications as read

### Indicators

- [ ] `mark-indicator-complete.js` - Mark indicator as completed
- [ ] `search-indicators.js` - Search/filter indicators

### KoboToolbox Integration

- [ ] `get-kobo-config.js` - Get Kobo configuration
- [ ] `save-kobo-config.js` - Save/update Kobo config
- [ ] `disconnect-kobo.js` - Disconnect from Kobo
- [ ] `get-kobo-forms.js` - Get forms from KoboToolbox
- [ ] `link-kobo-form.js` - Link form to indicator
- [ ] `get-kobo-links.js` - Get all form links
- [ ] `delete-kobo-link.js` - Delete form link
- [ ] `sync-kobo-submissions.js` - Sync submissions for a form
- [ ] `sync-all-kobo.js` - Sync all linked forms
- [ ] `get-kobo-submissions.js` - Get synced submissions

### Reports

- [ ] `generate-pdf-report.js` - Generate PDF report
- [ ] `generate-excel-report.js` - Generate Excel report
- [ ] `export-indicators.js` - Export indicators data

## Notes

- All functions use Supabase client from `utils/supabase.js`
- All functions use response helpers from `utils/response.js`
- All functions handle CORS preflight requests
- Password hashing uses bcrypt from `utils/auth.js`
- Role-based access control implemented where needed

## Next Steps

1. Create remaining critical functions (progress, users, notifications)
2. Create KoboToolbox integration functions
3. Create report generation functions
4. Test all functions with Netlify CLI
5. Update frontend to use new function endpoints
