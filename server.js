import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { netlifyToExpress } from './netlify-adapter.js';

// Import Netlify Functions
import { handler as indicatorsHandler } from './netlify/functions/indicators.js';
import { handler as activitiesHandler } from './netlify/functions/activities.js';
import { handler as approvalsHandler } from './netlify/functions/approvals.js';
import { handler as notificationsHandler } from './netlify/functions/notifications.js';
import { handler as usersHandler } from './netlify/functions/users.js';
import { handler as loginHandler } from './netlify/functions/login.js';
import { handler as koboConfigHandler } from './netlify/functions/kobo-config.js';
import { handler as koboActionsHandler } from './netlify/functions/kobo-actions.js';
import { handler as progressHandler } from './netlify/functions/progress.js';
import { handler as volunteerHandler } from './netlify/functions/volunteer.js';

// __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the React frontend build
const clientBuildPath = path.join(__dirname, 'client', 'dist');
if (fs.existsSync(clientBuildPath)) {
    app.use(express.static(clientBuildPath));
} else {
    console.warn('⚠️  Client build not found. Run "npm run build" in client/ directory.');
}

/**
 * Route Mapping
 * In Express 5, app.use(path, handler) acts as a prefix matcher.
 * This is the safest way to map API routes to Netlify functions.
 */

// Indicators
app.use('/api/indicators', netlifyToExpress(indicatorsHandler));

// Activities
app.use('/api/activities', netlifyToExpress(activitiesHandler));

// Progress
app.use('/api/progress', netlifyToExpress(progressHandler));

// Users
app.use('/api/users', netlifyToExpress(usersHandler));

// Login (Exact match is fine for app.use too)
app.use('/api/login', netlifyToExpress(loginHandler));

// Approvals
app.use('/api/approvals', netlifyToExpress(approvalsHandler));

// Notifications
app.use('/api/notifications', netlifyToExpress(notificationsHandler));

// Kobo
app.use('/api/kobo/config', netlifyToExpress(koboConfigHandler));
app.use('/api/kobo/links', netlifyToExpress(koboActionsHandler));
app.use('/api/kobo/actions', netlifyToExpress(koboActionsHandler));
app.use('/api/kobo/sync', netlifyToExpress(koboActionsHandler));

// Volunteer
app.use('/api/volunteer', netlifyToExpress(volunteerHandler));

// Catch-all for other /api routes
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API route not found' });
});

// SPA routing for non-API requests
app.use((req, res) => {
    if (fs.existsSync(clientBuildPath)) {
        res.sendFile(path.join(clientBuildPath, 'index.html'));
    } else {
        res.send('MMPZ System API Server. Frontend not built.');
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
