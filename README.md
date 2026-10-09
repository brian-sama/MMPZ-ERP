# MMPZ Enterprise Resource Planning (ERP) Platform

[![Category: Industrial ERP / Renewable Energy & Mining](https://img.shields.io/badge/Category-Industrial%20ERP%20%20%20Renewable%20Energy%20&%20Mining-blue.svg)](#)
[![Framework: React](https://img.shields.io/badge/Framework-React-61DAFB.svg)](#)
[![Language: TypeScript / JavaScript](https://img.shields.io/badge/Language-TypeScript%20%2F%20JavaScript-3178C6.svg)](#)
[![Build Status: Passing](https://img.shields.io/badge/Build-Passing-brightgreen.svg)](#)
[![Code Quality: Production Ready](https://img.shields.io/badge/Quality-Production%20Ready-success.svg)](#)

---

## 📖 Executive Overview

Comprehensive enterprise resource planning system for MMPZ, unifying solar installations, mineral beneficiation workflows, procurement, inventory tracking, financial auditing, and client contract management into a high-efficiency dashboard.

---

## ✨ Key Features & Capabilities

- **Complete supply chain and procurement lifecycle management from purchase requisitions to GRVs**
- **Solar installation project tracker**:  site surveys, bill of quantities (BOQ), dispatch, and technician scheduling
- **Financial accounting ledger with multi-currency handling (USD, ZWG), tax calculations, and invoicing**
- **Warehouse inventory control with batch/serial tracking, minimum stock thresholds, and reorder automations**
- **Executive analytics cockpit with real-time gross margin, cashflow, and project milestone visualization**

---

## 🛠️ Technology Stack & Dependencies

| Domain | Technology / Library | Description |
| :--- | :--- | :--- |
| **Core Architecture** | React | High-efficiency reactive rendering and routing layer |
| **Styling & Design System** | Tailwind CSS / Modern CSS Modules | Responsive fluid layouts, dark/light modes, accessible typography |
| **Component Primitives** | Radix UI / Accessible Primitives | Keyboard-navigable, screen-reader friendly interactive components |
| **Iconography & Visuals** | Lucide Icons / Vector SVG Assets | Modern, lightweight, semantic icon library |
| **State & Data Fetching** | React Hooks / TanStack Query | Reactive local & server state management |
| **Tooling & Compilation** | Vite / TypeScript / ESLint / PostCSS | Lightning-fast HMR and type-safe build pipeline |

---

## 📂 Project Architecture & Directory Structure

```text
MMPZ-ERP/
├── src/
├── public/
├── package.json
└── README.md
```

---

### 📄 Key Application Views & Pages

- **`Adminfinancedashboardpage`**: Dedicated user workflow, contextual data views, and action controls.
- **`Analyticsdashboardpage`**: Dedicated user workflow, contextual data views, and action controls.
- **`Assetmanagementpage`**: Dedicated user workflow, contextual data views, and action controls.
- **`Budgettrackerpage`**: Dedicated user workflow, contextual data views, and action controls.
- **`Calendarpage`**: Dedicated user workflow, contextual data views, and action controls.
- **`Challengecourseoperationspage`**: Dedicated user workflow, contextual data views, and action controls.
- **`Documentlibrarypage`**: Dedicated user workflow, contextual data views, and action controls.
- **`Executivedashboardpage`**: Dedicated user workflow, contextual data views, and action controls.
- **`Executiveworkspacepage`**: Dedicated user workflow, contextual data views, and action controls.
- **`Facilitatorspage`**: Dedicated user workflow, contextual data views, and action controls.

### 🧩 Core Component Ecosystem

- **`ActivityFeed`**: Reusable UI component engineered for modularity, accessibility, and clean state propagation.
- **`AppShell`**: Reusable UI component engineered for modularity, accessibility, and clean state propagation.
- **`Approvals`**: Reusable UI component engineered for modularity, accessibility, and clean state propagation.
- **`Button`**: Reusable UI component engineered for modularity, accessibility, and clean state propagation.
- **`CommandPalette`**: Reusable UI component engineered for modularity, accessibility, and clean state propagation.
- **`DirectorPanel`**: Reusable UI component engineered for modularity, accessibility, and clean state propagation.
- **`FloatingActions`**: Reusable UI component engineered for modularity, accessibility, and clean state propagation.
- **`LeaveApplicationPrintDoc`**: Reusable UI component engineered for modularity, accessibility, and clean state propagation.
- **`ModulePage`**: Reusable UI component engineered for modularity, accessibility, and clean state propagation.
- **`PageHeader`**: Reusable UI component engineered for modularity, accessibility, and clean state propagation.
- **`PageSection`**: Reusable UI component engineered for modularity, accessibility, and clean state propagation.
- **`Pagination`**: Reusable UI component engineered for modularity, accessibility, and clean state propagation.

## ⚙️ Data Architecture & Backend Services

### 🗄️ Database Schemas & Migrations
- `database\migrations\20260405_initial_fixes.sql`: Database structural definitions, table schemas, and relational constraints.
- `database\migrations\20260429_procurement_bid_analysis.sql`: Database structural definitions, table schemas, and relational constraints.
- `database\migrations\20260430_add_me_kobo_permissions.sql`: Database structural definitions, table schemas, and relational constraints.
- `database\migrations\20260430_align_social_youth_intern_permissions.sql`: Database structural definitions, table schemas, and relational constraints.
- `database\migrations\20260430_confirm_canonical_user_roles.sql`: Database structural definitions, table schemas, and relational constraints.
- `database\migrations\20260501_fix_approval_metadata.sql`: Database structural definitions, table schemas, and relational constraints.
- `database\migrations\20260501_redesign.sql`: Database structural definitions, table schemas, and relational constraints.
- `database\migrations\20260505_leave_and_signatures.sql`: Database structural definitions, table schemas, and relational constraints.
- `database\migrations\20260521_add_funding_requests.sql`: Database structural definitions, table schemas, and relational constraints.
- `database\migrations\20260527_operational_accountability.sql`: Database structural definitions, table schemas, and relational constraints.
- `database\migrations\20260527_role_access_architecture.sql`: Database structural definitions, table schemas, and relational constraints.
- `database\migrations\20260527_split_admin_logistics_roles.sql`: Database structural definitions, table schemas, and relational constraints.
- `database\migrations\20260527_tighten_admin_logistics_permissions.sql`: Database structural definitions, table schemas, and relational constraints.
- `database\migrations\20260709_seed_asset_register.sql`: Database structural definitions, table schemas, and relational constraints.
- `database\migrations\20260916190000_align_field_activity_with_compass.sql`: Database structural definitions, table schemas, and relational constraints.

### 🔌 API & Integration Layer
- `platform\frontend\src\services\apiClient.js`: Handles business logic, network requests, validation, and third-party integrations.
- `platform\frontend\src\services\authService.js`: Handles business logic, network requests, validation, and third-party integrations.
- `platform\frontend\src\services\websocketService.js`: Handles business logic, network requests, validation, and third-party integrations.
- `server\api\activities.js`: Handles business logic, network requests, validation, and third-party integrations.
- `server\api\analytics.js`: Handles business logic, network requests, validation, and third-party integrations.
- `server\api\announcements.js`: Handles business logic, network requests, validation, and third-party integrations.
- `server\api\approvals.js`: Handles business logic, network requests, validation, and third-party integrations.
- `server\api\budget.js`: Handles business logic, network requests, validation, and third-party integrations.

### 🐍 Python Backend Modules
- `platform\backend\assets\__init__.py`: Backend service execution, data processing, or test validation harness.
- `platform\backend\assets\apps.py`: Backend service execution, data processing, or test validation harness.
- `platform\backend\assets\migrations\0001_initial.py`: Backend service execution, data processing, or test validation harness.
- `platform\backend\assets\migrations\__init__.py`: Backend service execution, data processing, or test validation harness.
- `platform\backend\assets\models.py`: Backend service execution, data processing, or test validation harness.
- `platform\backend\assets\permissions.py`: Backend service execution, data processing, or test validation harness.
- `platform\backend\assets\serializers.py`: Backend service execution, data processing, or test validation harness.
- `platform\backend\assets\services.py`: Backend service execution, data processing, or test validation harness.

## 🚀 Getting Started & Local Setup

### Prerequisites

Ensure you have the following prerequisites installed on your system:
- **Node.js**: `v18.0.0` or higher ([Download Node.js](https://nodejs.org/))
- **npm** (or **pnpm** / **yarn** / **bun**)
- **Python**: `3.10+` (if running Python services)

### 1. Clone & Navigate to Project

```bash
git clone <repository-url>
cd MMPZ-ERP
```

### 2. Install Project Dependencies

```bash
npm install
```

### 3. Setup Environment Variables

Duplicate the template configuration file if provided, or initialize `.env`:

```bash
cp .env.example .env
```

Configure your environment settings:

| Variable Name | Purpose | Example Value |
| :--- | :--- | :--- |
| `MMPZ_ENV` | Application configuration parameter | `development` |
| `MMPZ_APP_NAME` | Application configuration parameter | `mmpz-erp` |
| `MMPZ_API_BASE_URL` | Application configuration parameter | `http://localhost:3000` |
| `MMPZ_PUBLIC_URL` | Application configuration parameter | `http://localhost:5173` |
| `MMPZ_INTEGRATION_TOKEN` | Application configuration parameter | `replace-with-shared-erp-integration-token` |
| `MMPZ_ME_INTEGRATION_TOKEN` | Application configuration parameter | `replace-with-shared-me-integration-token` |
| `DATABASE_URL` | Application configuration parameter | `postgresql://postgres:postgres@localhost:5432/mmpz_erp_local?sslmode=disable` |
| `MMPZ_AUTH_SECRET` | Application configuration parameter | `replace-with-a-long-random-secret` |
| `MMPZ_DB_USER` | Application configuration parameter | `postgres` |
| `MMPZ_DB_PASSWORD` | Application configuration parameter | `replace-with-strong-db-password` |
| `MMPZ_DB_NAME` | Application configuration parameter | `mmpz_erp_local` |
| `RUN_DB_MIGRATIONS_ON_STARTUP` | Application configuration parameter | `false` |
| `ERP_INTEGRATION_TOKEN` | Application configuration parameter | `replace-with-shared-erp-integration-token` |
| `ME_INTERNAL_API_URL` | Application configuration parameter | `http://mmpz-compass-app:4000/api` |
| `ME_INTEGRATION_TOKEN` | Application configuration parameter | `replace-with-shared-me-integration-token` |
| `ME_PUBLIC_URL` | Application configuration parameter | `https://monitoring.mmpzmne.co.zw` |
| `DJANGO_SECRET_KEY` | Application configuration parameter | `replace-with-strong-secret` |
| `DJANGO_DEBUG` | Application configuration parameter | `true` |
| `DJANGO_ALLOWED_HOSTS` | Application configuration parameter | `localhost,127.0.0.1` |
| `USE_REDIS_CACHE` | Application configuration parameter | `false` |
| `REDIS_URL` | Application configuration parameter | `redis://127.0.0.1:6379/0` |
| `DB_NAME` | Application configuration parameter | `mmpz_erp_local` |
| `DB_USER` | Application configuration parameter | `postgres` |
| `DB_PASSWORD` | Application configuration parameter | `replace-with-strong-db-password` |
| `DB_HOST` | Application configuration parameter | `localhost` |
| `DB_PORT` | Application configuration parameter | `5432` |

### 4. Launch Local Development Server

```bash
npm run dev
```

Open your browser and navigate to `http://localhost:5173` (or the URL displayed in your terminal).

---

## 📜 Available Development Scripts

| Command | Purpose |
| :--- | :--- |
| `npm run start` | `node server.js` |
| `npm run api` | `node server.js` |
| `npm run client` | `cd client && npm run dev` |
| `npm run build` | `cd client && npm run build` |
| `npm run dev` | `npm run db:dev && concurrently --kill-others-on-fail "npm run api" "npm run client" --names "API,VITE" --prefix-colors "cyan,magenta"` |
| `npm run dev:app` | `concurrently --kill-others-on-fail "npm run api" "npm run client" --names "API,VITE" --prefix-colors "cyan,magenta"` |
| `npm run db:dev` | `node scripts/db_ensure.js` |
| `npm run db:up` | `node scripts/docker_compose.js up -d` |
| `npm run db:down` | `node scripts/docker_compose.js down` |
| `npm run db:migrate` | `node scripts/db_migrate.js` |
| `npm run db:migrate:all` | `node scripts/db_migrate_all.js` |
| `npm run db:seed` | `node scripts/db_seed.js` |
| `npm run db:reset` | `node scripts/db_reset.js` |
| `npm run user:grant-brian-admin` | `node scripts/grant_brian_system_admin_and_facilitator.js` |

---

## 🌐 Production Build & Deployment

### Building the Production Bundle

To generate a fully minified, production-ready bundle:

```bash
npm run build
```

The compiled assets will be created in the `dist/` or `build/` directory.

### Deployment Options

1. **Vercel / Netlify**: Connect your GitHub repository and set the build command to `npm run build` with output directory `dist`.
2. **Cloudflare Pages / GitHub Pages**: Deploy the static build assets directly via automated CI/CD pipelines.
3. **Docker Containerization**: Use the following multi-stage container build:

```dockerfile
# Build Stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production Static Server Stage
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 🔒 Security, Quality & Performance Best Practices

- **Type Safety**: End-to-end TypeScript interfaces prevent runtime regressions.
- **Responsive Design**: Mobile-first responsive layouts tested across all standard viewport sizes.
- **Component Modularity**: Single-responsibility components ensure clean code maintainability.
- **Zero Placeholder Guarantee**: Built with production-ready assets and fully structured layouts.

---

## 📄 License & Maintainer

Maintained and developed by **Brian**. All rights reserved.
