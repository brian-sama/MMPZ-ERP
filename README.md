# MMPZ System

**Million Memory Project Zimbabwe - Monitoring & Evaluation Platform**

A comprehensive web-based monitoring and evaluation system designed for tracking project indicators, managing activities, and facilitating data-driven decision-making for development projects in Zimbabwe.

![MMPZ System](./client/public/logo.jpg)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Getting Started](#getting-started)
- [User Roles & Permissions](#user-roles--permissions)
- [Core Modules](#core-modules)
- [Offline Capabilities](#offline-capabilities)
- [KoboToolbox Integration](#kobotoolbox-integration)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

The MMPZ System is a modern, full-stack web application built to streamline the monitoring and evaluation process for development projects. It provides real-time tracking of project indicators, budget management, activity logging, and seamless integration with KoboToolbox for field data collection.

### Why MMPZ System?

- **Real-time Monitoring**: Track project progress and indicators in real-time
- **Budget Transparency**: Monitor spending and budget allocation across activities
- **Approval Workflows**: Built-in approval system for progress updates
- **Offline-First**: Continue working even without internet connectivity
- **Data Integration**: Seamlessly sync with KoboToolbox field data
- **Role-Based Access**: Secure, hierarchical access control system

---

## ✨ Key Features

### 📊 Indicator Management
- Create and track custom project indicators
- Set target values and monitor progress percentage
- Priority-based indicator classification (Critical, High, Medium, Low)
- Status tracking (Active, Completed, Flagged)
- Visual progress bars and charts

### 💰 Budget Tracking
- Comprehensive budget allocation per indicator
- Real-time budget balance monitoring
- Activity-based expense tracking
- Budget warning notifications
- Detailed financial reporting

### 📝 Activity Logging
- Record project activities with detailed categorization
- Categories: Personnel, Materials, Travel, Training, Equipment, Other
- Cost tracking linked to indicator budgets
- Activity history and audit trails
- Delete activities with automatic budget restoration

### 🔔 Notifications System
- Real-time notifications for:
  - Progress updates
  - Approval requests
  - Budget warnings
  - System alerts
- Mark as read/unread functionality
- Notification center with filtering

### ✅ Approval Workflows
- Multi-level approval system for progress updates
- Director and Admin approval capabilities
- Approval history tracking
- Rejection with notes functionality

### 📱 Offline Mode
- Progressive Web App (PWA) capabilities
- Offline data caching with LocalForage
- Sync queue for offline operations
- Automatic synchronization when online
- Optimistic UI updates

### 🔗 KoboToolbox Integration
- Connect to KoboToolbox server
- Browse and link forms to indicators
- Automatic data synchronization
- Submission tracking
- Bulk sync capabilities

### 📈 Reports & Analytics
- Visual dashboards with charts
- Export data (CSV, JSON)
- Progress history visualization
- Budget utilization reports
- Activity breakdown by category

### 🌓 Dark Mode
- System-wide dark mode support
- Persistent theme preference
- Eye-friendly interface for extended use

---

## 🛠 Technology Stack

### Frontend
- **React 18.2** - Modern UI library with hooks
- **Vite 4.4** - Lightning-fast build tool and dev server
- **Recharts 3.6** - Composable charting library for data visualization
- **Axios 1.5** - Promise-based HTTP client
- **LocalForage 1.10** - Offline storage wrapper (IndexedDB, WebSQL, localStorage)
- **Workbox** - Service worker libraries for PWA functionality
- **Vite PWA Plugin** - Zero-config PWA support

### Backend
- **Netlify Functions** - Serverless backend functions
- **Node.js** - JavaScript runtime
- **esbuild** - Fast JavaScript bundler for functions

### Database
- **Supabase (PostgreSQL)** - Cloud-hosted PostgreSQL database
- **@supabase/supabase-js 2.89** - JavaScript client library

### Authentication & Security
- **bcryptjs 3.0** - Password hashing
- **Session-based authentication** - Secure user sessions
- **Row Level Security (RLS)** - Database-level access control

### External Integrations
- **KoboToolbox API** - Field data collection integration
- **Netlify** - Hosting and serverless functions

### Development Tools
- **Concurrently** - Run multiple npm scripts
- **Netlify CLI** - Local development and deployment

---

## 🏗 System Architecture

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   React SPA (Vite)                                   │   │
│  │   - Components & UI                                  │   │
│  │   - State Management                                 │   │
│  │   - Offline Storage (LocalForage)                    │   │
│  │   - Service Worker (PWA)                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTPS
┌─────────────────────────────────────────────────────────────┐
│                    Netlify Edge Layer                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   Redirects & Routing                                │   │
│  │   /api/* → /.netlify/functions/*                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                  Serverless Functions Layer                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   Netlify Functions (Node.js)                        │   │
│  │   - Authentication (login.js)                        │   │
│  │   - Indicators (indicators.js)                       │   │
│  │   - Activities (activities.js)                       │   │
│  │   - Progress (progress.js)                           │   │
│  │   - Approvals (approvals.js)                         │   │
│  │   - Users (users.js)                                 │   │
│  │   - Notifications (notifications.js)                 │   │
│  │   - Kobo Integration (kobo-*.js)                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                     Database Layer                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   Supabase (PostgreSQL)                              │   │
│  │   - users                                            │   │
│  │   - indicators                                       │   │
│  │   - progress_updates                                 │   │
│  │   - activities                                       │   │
│  │   - notifications                                    │   │
│  │   - kobo_config                                      │   │
│  │   - kobo_form_links                                  │   │
│  │   - kobo_submissions                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                  External Services                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │   KoboToolbox API                                    │   │
│  │   - Forms Management                                 │   │
│  │   - Submissions Sync                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema

The system uses a relational PostgreSQL database with the following main tables:

- **users** - User accounts and authentication
- **indicators** - Project indicators and targets
- **progress_updates** - Progress tracking with approval workflow
- **activities** - Activity logs with budget tracking
- **notifications** - User notifications
- **kobo_config** - KoboToolbox configuration
- **kobo_form_links** - Links between Kobo forms and indicators
- **kobo_submissions** - Synced submission data

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (v16 or higher)
- **npm** or **yarn**
- **Supabase Account** (for database)
- **Netlify Account** (for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/mmpz-system.git
   cd mmpz-system
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install

   # Install client dependencies
   cd client
   npm install
   cd ..
   ```

3. **Configure environment variables**
   
   Create a `.env` file in the root directory:
   ```env
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. **Set up the database**
   
   Run the SQL scripts in order:
   ```bash
   # In Supabase SQL Editor:
   # 1. Run database/schema.sql
   # 2. Run database/seed.sql (optional - for test data)
   # 3. Run database/create_admin.sql (create first admin user)
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:5173`

### Default Admin Credentials

After running `create_admin.sql`:
- **Email**: `admin@mmpz.org`
- **Password**: `Admin@123`

⚠️ **Important**: Change the default password immediately after first login!

---

## 👥 User Roles & Permissions

The system implements a hierarchical role-based access control system:

### 🔴 Admin
- Full system access
- User management (create, edit, delete users)
- Indicator management (create, edit, delete)
- Approve/reject progress updates
- View all indicators and activities
- Configure KoboToolbox integration
- Access all reports and analytics

### 🟠 Director
- View all indicators
- Approve/reject progress updates
- Create indicators
- Add activities
- View reports
- Cannot manage users

### 🟡 Officer
- View assigned indicators only
- Submit progress updates (requires approval)
- Add activities to assigned indicators
- View own activity history
- Cannot approve updates

### 🟢 Intern
- View assigned indicators (read-only)
- View activities (read-only)
- Cannot submit updates or add activities
- Limited reporting access

---

## 📦 Core Modules

### 1. Indicators Module
**File**: `netlify/functions/indicators.js`

Manages project indicators with full CRUD operations:
- Create new indicators with targets and budgets
- Update indicator details
- Track progress percentage
- Monitor budget utilization
- Set priority levels
- Mark as complete

### 2. Activities Module
**File**: `netlify/functions/activities.js`

Tracks project activities and expenses:
- Log activities with categories
- Link activities to indicators
- Track costs and update budgets
- Activity history and reporting
- Delete with budget restoration

### 3. Progress Module
**File**: `netlify/functions/progress.js`

Manages progress updates with approval workflow:
- Submit progress updates
- Track previous vs. new values
- Add notes and context
- Approval status tracking
- History visualization

### 4. Approvals Module
**File**: `netlify/functions/approvals.js`

Handles approval workflows:
- Fetch pending approvals
- Approve/reject updates
- Notification triggers
- Approval history

### 5. Users Module
**File**: `netlify/functions/users.js`

User management and authentication:
- Create users with roles
- Update user details
- Change roles (admin only)
- Delete users
- Password management

### 6. Notifications Module
**File**: `netlify/functions/notifications.js`

Real-time notification system:
- Create notifications
- Mark as read/unread
- Filter by type
- Auto-notifications for events

### 7. KoboToolbox Integration
**Files**: `kobo-config.js`, `kobo-actions.js`

Field data collection integration:
- Connect to Kobo server
- Browse available forms
- Link forms to indicators
- Sync submissions
- Auto-update indicator values

---

## 📴 Offline Capabilities

The MMPZ System is built as a Progressive Web App (PWA) with robust offline functionality:

### Features
- **Offline Data Access**: View cached indicators and activities
- **Sync Queue**: Queue operations when offline
- **Automatic Sync**: Sync when connection restored
- **Optimistic Updates**: Immediate UI feedback
- **Status Indicators**: Clear online/offline status

### How It Works

1. **Data Caching**: All fetched data is cached using LocalForage
2. **Operation Queuing**: Offline operations are queued with timestamps
3. **Background Sync**: Service worker syncs data when online
4. **Conflict Resolution**: Server data takes precedence on sync

### Offline Storage
**File**: `client/src/offlineStorage.js`

Uses IndexedDB via LocalForage for:
- Indicators cache
- Activities cache
- Sync queue management
- Sync status tracking

---

## 🔗 KoboToolbox Integration

### Setup

1. **Obtain API Token**
   - Log in to KoboToolbox
   - Go to Account Settings → Security
   - Generate API token

2. **Configure in MMPZ**
   - Navigate to KoboCollect tab
   - Enter server URL (default: `https://kf.kobotoolbox.org`)
   - Paste API token
   - Click "Connect"

3. **Link Forms**
   - Browse available forms
   - Select indicator to link
   - Click "Link Form"

4. **Sync Data**
   - Manual sync: Click "Sync" on individual forms
   - Bulk sync: Click "Sync All Forms"
   - Automatic: Configure auto-sync intervals

### Data Flow

```
KoboToolbox Form → API → MMPZ Functions → Database → UI Update
```

---

## 🌐 Deployment

### Netlify Deployment

The system is optimized for Netlify deployment:

1. **Connect Repository**
   ```bash
   netlify init
   ```

2. **Configure Build Settings**
   
   Build settings are in `netlify.toml`:
   - Build command: `cd client && npm install && npm run build`
   - Publish directory: `client/dist`
   - Functions directory: `netlify/functions`

3. **Set Environment Variables**
   
   In Netlify dashboard, add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

4. **Deploy**
   ```bash
   netlify deploy --prod
   ```

### Manual Deployment

Build the client:
```bash
cd client
npm run build
```

Deploy the `client/dist` folder to any static hosting service.

---

## 📊 Database Management

### Backup

Regular backups are recommended:
```bash
# Supabase provides automated backups
# Manual export via Supabase Dashboard → Database → Backups
```

### Reset Database

To reset the database (⚠️ **DESTRUCTIVE**):
```sql
-- Run database/clear_database.sql
-- Then run database/schema.sql
-- Then run database/seed.sql
```

### Migrations

Database changes should be:
1. Tested in development
2. Documented in SQL files
3. Applied via Supabase SQL Editor
4. Version controlled

---

## 🔒 Security

### Authentication
- Session-based authentication
- Password hashing with bcryptjs
- Secure session storage
- Auto-logout on browser close

### Authorization
- Role-based access control (RBAC)
- Row-level security (RLS) in database
- API endpoint protection
- Function-level permission checks

### Data Protection
- HTTPS encryption
- Environment variable protection
- SQL injection prevention
- XSS protection

---

## 🧪 Testing

### Local Testing

Test Netlify Functions locally:
```bash
netlify dev
```

### Database Testing

Test scripts are provided:
- `test_insert.js` - Test database inserts
- `test_join.js` - Test table joins
- `test_kobo_config.js` - Test Kobo integration

Run tests:
```bash
node test_insert.js
node test_join.js
node test_kobo_config.js
```

---

## 📝 API Documentation

### Base URL
```
Production: https://your-site.netlify.app/api
Local: http://localhost:8888/api
```

### Endpoints

#### Authentication
- `POST /api/login` - User login

#### Indicators
- `GET /api/indicators` - List indicators
- `POST /api/indicators` - Create indicator
- `PUT /api/indicators/:id` - Update indicator
- `DELETE /api/indicators/:id` - Delete indicator
- `PATCH /api/indicators/:id/complete` - Mark complete

#### Activities
- `GET /api/activities` - List all activities
- `GET /api/indicators/:id/activities` - List indicator activities
- `POST /api/activities` - Create activity
- `DELETE /api/activities/:id` - Delete activity

#### Progress
- `GET /api/indicators/:id/progress` - Get progress history
- `POST /api/indicators/:id/progress` - Submit progress update

#### Approvals
- `GET /api/approvals/pending` - Get pending approvals
- `PATCH /api/progress/:id/approve` - Approve/reject update

#### Users
- `GET /api/users` - List users (admin only)
- `POST /api/users` - Create user (admin only)
- `PUT /api/users/:id` - Update user (admin only)
- `DELETE /api/users/:id` - Delete user (admin only)
- `PATCH /api/users/:id/role` - Update role (admin only)

#### Notifications
- `GET /api/notifications` - Get user notifications
- `PATCH /api/notifications/:id/read` - Mark as read
- `PATCH /api/notifications/mark-all-read` - Mark all as read

#### KoboToolbox
- `GET /api/kobo/config` - Get Kobo configuration
- `POST /api/kobo/config` - Connect to Kobo
- `POST /api/kobo/disconnect` - Disconnect from Kobo
- `GET /api/kobo/forms` - List available forms
- `GET /api/kobo/links` - List form links
- `POST /api/kobo/link` - Link form to indicator
- `DELETE /api/kobo/link/:id` - Unlink form
- `POST /api/kobo/sync/:id` - Sync form submissions
- `POST /api/kobo/sync-all` - Sync all forms

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

### Code Style
- Use ES6+ JavaScript
- Follow React best practices
- Comment complex logic
- Write meaningful commit messages

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👨‍💻 Development Team

**Million Memory Project Zimbabwe**

For support or inquiries:
- Email: support@mmpz.org
- Website: https://mmpz.org

---

## 🙏 Acknowledgments

- KoboToolbox for field data collection
- Supabase for database infrastructure
- Netlify for hosting and serverless functions
- React and Vite communities

---

## 📚 Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Netlify Functions Guide](https://docs.netlify.com/functions/overview/)
- [KoboToolbox API Docs](https://support.kobotoolbox.org/api.html)
- [React Documentation](https://react.dev)
- [Vite Guide](https://vitejs.dev/guide/)

---

**Built with ❤️ for development projects in Zimbabwe**
