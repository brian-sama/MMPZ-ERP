import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { functionToExpress } from './server/function-adapter.js';

// API handlers
import { handler as healthHandler } from './server/api/health.js';
import { handler as loginHandler } from './server/api/login.js';
import { handler as indicatorsHandler } from './server/api/indicators.js';
import { handler as activitiesHandler } from './server/api/activities.js';
import { handler as progressHandler } from './server/api/progress.js';
import { handler as approvalsHandler } from './server/api/approvals.js';
import { handler as notificationsHandler } from './server/api/notifications.js';
import { handler as usersHandler } from './server/api/users.js';
import { handler as volunteerHandler } from './server/api/volunteer.js';
import { handler as koboConfigHandler } from './server/api/kobo-config.js';
import { handler as koboActionsHandler } from './server/api/kobo-actions.js';
import { handler as rolesHandler } from './server/api/roles.js';
import { handler as pendingRoleAssignmentsHandler } from './server/api/governance-pending-role-assignments.js';
import { handler as financeThresholdHandler } from './server/api/settings-finance-threshold.js';
import { handler as programsHandler } from './server/api/programs.js';
import { handler as projectsHandler } from './server/api/projects.js';
import { handler as expensesHandler } from './server/api/expenses.js';
import { handler as governanceApprovalsHandler } from './server/api/governance-approvals.js';
import { handler as reportsHandler } from './server/api/reports.js';
import { handler as dashboardHandler } from './server/api/dashboard.js';
import { handler as outputsHandler } from './server/api/outputs.js';
import { handler as facilitatorsHandler } from './server/api/facilitators.js';
import { handler as facilitatorAssignmentsHandler } from './server/api/facilitator-assignments.js';
import { handler as facilitatorAttendanceHandler } from './server/api/facilitator-attendance.js';
import { handler as financeCoreHandler } from './server/api/finance-core.js';
import { handler as procurementHandler } from './server/api/procurement.js';
import { handler as meHandler } from './server/api/me.js';
import { handler as governanceHandler } from './server/api/governance.js';
import { handler as announcementsHandler } from './server/api/announcements.js';
import { handler as changePasswordHandler } from './server/api/change-password.js';
import { handler as userProfileHandler } from './server/api/user-profile.js';
import { handler as uploadAvatarHandler } from './server/api/upload-avatar.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

const clientBuildPath = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
} else {
    console.warn('Client build not found. Run `npm run build` to serve frontend from this server.');
}

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'uploads', 'avatars');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health
app.use('/api/health', functionToExpress(healthHandler));

// Auth
app.use('/api/login', functionToExpress(loginHandler));

// Indicators + Progress + Activities
app.use('/api/indicators/:id/progress', functionToExpress(progressHandler));
app.use('/api/indicators/:id/activities', functionToExpress(activitiesHandler));
app.use('/api/indicators', functionToExpress(indicatorsHandler));
app.use('/api/progress-updates', functionToExpress(progressHandler));
app.use('/api/activities/:id/outputs', functionToExpress(outputsHandler));
app.use('/api/activities', functionToExpress(activitiesHandler));
app.use('/api/outputs', functionToExpress(outputsHandler));

// Approvals
app.use('/api/approvals/pending', functionToExpress(approvalsHandler));
app.use('/api/approvals', functionToExpress(approvalsHandler));
app.use('/api/progress/:id/approve', functionToExpress(approvalsHandler));

// Notifications
app.use('/api/notifications', functionToExpress(notificationsHandler));
app.use('/api/announcements/:id', functionToExpress(announcementsHandler));
app.use('/api/announcements', functionToExpress(announcementsHandler));

// Users and roles
app.use('/api/users/:id/confirm-role', functionToExpress(usersHandler));
app.use('/api/users/:id/role', functionToExpress(usersHandler));
app.use('/api/users', functionToExpress(usersHandler));
app.use('/api/roles', functionToExpress(rolesHandler));
app.use('/api/governance/pending-role-assignments', functionToExpress(pendingRoleAssignmentsHandler));

// Dashboard
app.use('/api/dashboard/executive-summary', functionToExpress(dashboardHandler));

// Finance & Procurement
app.use('/api/finance/summary', functionToExpress(financeCoreHandler));
app.use('/api/finance/grants', functionToExpress(financeCoreHandler));
app.use('/api/finance/budget-lines', functionToExpress(financeCoreHandler));
app.use('/api/finance/budgets', functionToExpress(financeCoreHandler));
app.use('/api/procurement/:id', functionToExpress(procurementHandler));
app.use('/api/procurement', functionToExpress(procurementHandler));

app.use('/api/me/summary', functionToExpress(meHandler));
app.use('/api/me/progress', functionToExpress(meHandler));
app.use('/api/me/change-password', functionToExpress(changePasswordHandler));
app.use('/api/me/profile', functionToExpress(userProfileHandler));
app.use('/api/me/upload-avatar', uploadAvatarHandler); // Note: Multer handler doesn't need functionToExpress adapter if it's already an Express handler
app.use('/api/me', functionToExpress(meHandler));

app.use('/api/governance/queue', functionToExpress(governanceHandler));
app.use('/api/governance/action', functionToExpress(governanceHandler));
app.use('/api/governance/:id', functionToExpress(governanceHandler));

// Programs/projects/expenses/governance
app.use('/api/settings/finance-threshold', functionToExpress(financeThresholdHandler));
app.use('/api/programs', functionToExpress(programsHandler));
app.use('/api/projects/:id', functionToExpress(projectsHandler));
app.use('/api/projects', functionToExpress(projectsHandler));
app.use('/api/expenses/:id', functionToExpress(expensesHandler));
app.use('/api/expenses', functionToExpress(expensesHandler));
app.use('/api/governance/approvals/:id', functionToExpress(governanceApprovalsHandler));
app.use('/api/governance/approvals', functionToExpress(governanceApprovalsHandler));
app.use('/api/reports/pdf', functionToExpress(reportsHandler));
app.use('/api/reports/excel', functionToExpress(reportsHandler));
app.use('/api/export/indicators', functionToExpress(reportsHandler));

// Kobo
app.use('/api/kobo/config', functionToExpress(koboConfigHandler));
app.use('/api/kobo/disconnect', functionToExpress(koboActionsHandler));
app.use('/api/kobo/forms', functionToExpress(koboActionsHandler));
app.use('/api/kobo/link/:id', functionToExpress(koboActionsHandler));
app.use('/api/kobo/link', functionToExpress(koboActionsHandler));
app.use('/api/kobo/links', functionToExpress(koboActionsHandler));
app.use('/api/kobo/sync/:id', functionToExpress(koboActionsHandler));
app.use('/api/kobo/sync-all', functionToExpress(koboActionsHandler));
app.use('/api/kobo/import-participants', functionToExpress(koboActionsHandler));
app.use('/api/kobo/fields/:uid', functionToExpress(koboActionsHandler));

// Facilitators
app.use('/api/facilitators/:id', functionToExpress(facilitatorsHandler));
app.use('/api/facilitators', functionToExpress(facilitatorsHandler));
app.use('/api/facilitator-assignments', functionToExpress(facilitatorAssignmentsHandler));
app.use('/api/facilitator-attendance', functionToExpress(facilitatorAttendanceHandler));

// Volunteer
app.use('/api/volunteer', functionToExpress(volunteerHandler));

app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
});

app.use((req, res) => {
    if (fs.existsSync(clientBuildPath)) {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
    } else {
        res.send('MMPZ ERP API server is running.');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
