import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { functionToExpress } from "./server/function-adapter.js";

// API handlers
import { handler as healthHandler } from "./server/api/health.js";
import { handler as loginHandler } from "./server/api/login.js";
import { handler as indicatorsHandler } from "./server/api/indicators.js";
import { handler as activitiesHandler } from "./server/api/activities.js";
import { handler as progressHandler } from "./server/api/progress.js";
import { handler as approvalsHandler } from "./server/api/approvals.js";
import { handler as notificationsHandler } from "./server/api/notifications.js";
import { handler as usersHandler } from "./server/api/users.js";
import { handler as volunteerHandler } from "./server/api/volunteer.js";
import { handler as koboConfigHandler } from "./server/api/kobo-config.js";
import { handler as koboActionsHandler } from "./server/api/kobo-actions.js";
import { handler as rolesHandler } from "./server/api/roles.js";
import { handler as pendingRoleAssignmentsHandler } from "./server/api/governance-pending-role-assignments.js";
import { handler as financeThresholdHandler } from "./server/api/settings-finance-threshold.js";
import { handler as programsHandler } from "./server/api/programs.js";
import { handler as projectsHandler } from "./server/api/projects.js";
import { handler as expensesHandler } from "./server/api/expenses.js";
import { handler as governanceApprovalsHandler } from "./server/api/governance-approvals.js";
import { handler as reportsHandler } from "./server/api/reports.js";
import { handler as dashboardHandler } from "./server/api/dashboard.js";
import { handler as budgetHandler } from "./server/api/budget.js";
import { handler as analyticsHandler } from "./server/api/analytics.js";
import { handler as outputsHandler } from "./server/api/outputs.js";
import { handler as facilitatorsHandler } from "./server/api/facilitators.js";
import { handler as facilitatorAssignmentsHandler } from "./server/api/facilitator-assignments.js";
import { handler as facilitatorAttendanceHandler } from "./server/api/facilitator-attendance.js";
import { handler as financeCoreHandler } from "./server/api/finance-core.js";
import { handler as procurementHandler } from "./server/api/procurement.js";
import { handler as programLifecycleHandler } from "./server/api/program-lifecycle.js";
import { handler as meHandler } from "./server/api/me.js";
import { handler as governanceHandler } from "./server/api/governance.js";
import { handler as announcementsHandler } from "./server/api/announcements.js";
import { handler as changePasswordHandler } from "./server/api/change-password.js";
import { handler as userProfileHandler } from "./server/api/user-profile.js";
import { handler as uploadAvatarHandler } from "./server/api/upload-avatar.js";
import { handler as calendarEventsHandler } from "./server/api/calendar-events.js";
import { handler as documentLibraryHandler } from "./server/api/document-library.js";
import { handler as pushSubscriptionsHandler } from "./server/api/push-subscriptions.js";
import { handler as submissionsHandler } from "./server/api/submissions.js";
import { handler as leaveHandler } from "./server/api/leave.js";
import { handler as integrationMasterDataHandler } from "./server/api/integration-master-data.js";
import { handler as integrationMeSummariesHandler } from "./server/api/integration-me-summaries.js";
import { subscribeRealtime } from "./server/api/utils/notification-center.js";
import {
  getBearerTokenFromHeaders,
  verifySessionToken,
} from "./server/api/utils/session-token.js";
import { sql } from "./server/api/utils/db.js";
import { buildIdentity } from "./server/api/utils/identity.js";
import { resolveSystemRole, toLegacyRole } from "./server/api/utils/rbac.js";
import { startCalendarReminderScheduler } from "./server/jobs/calendar-reminders.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const defaultCorsOrigins = [
  "https://mmpzmne.co.zw",
  "https://monitoring.mmpzmne.co.zw",
];
const configuredCorsOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedCorsOrigins = new Set(
  configuredCorsOrigins.length > 0 ? configuredCorsOrigins : defaultCorsOrigins,
);
const localOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

const isAllowedOrigin = (origin) => {
  if (!origin) return true;
  if (localOriginPattern.test(origin)) return true;
  return allowedCorsOrigins.has(origin);
};

const getClientIp = (req) =>
  String(req.headers["x-forwarded-for"] || req.headers["x-real-ip"] || req.ip || "unknown")
    .split(",")[0]
    .trim();

const createRateLimiter = ({ windowMs, max, label }) => {
  const buckets = new Map();

  return (req, res, next) => {
    if (req.method === "OPTIONS") return next();

    const now = Date.now();
    const key = `${label}:${getClientIp(req)}`;
    const current = buckets.get(key);
    const bucket =
      current && current.resetAt > now ? current : { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "Too many requests. Please wait before trying again.",
      });
      return;
    }

    next();
  };
};

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(
  cors({
    allowedHeaders: ["Content-Type", "Authorization"],
    exposedHeaders: ["Content-Disposition"],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.use(
  "/api/login",
  createRateLimiter({ label: "erp-login", max: 8, windowMs: 15 * 60 * 1000 }),
);
app.use(
  ["/api/integration/master-data", "/api/integration/me/approved-summaries"],
  createRateLimiter({ label: "erp-integration", max: 60, windowMs: 60 * 1000 }),
);
app.use(
  "/api",
  createRateLimiter({ label: "erp-api", max: 900, windowMs: 15 * 60 * 1000 }),
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

const potentialPaths = [
  path.join(__dirname, "client", "dist"),
  path.join(process.cwd(), "client", "dist"),
  "/app/client/dist",
];

let clientBuildPath =
  potentialPaths.find((p) => fs.existsSync(p)) || potentialPaths[0];

if (fs.existsSync(clientBuildPath)) {
  console.log(`Serving static files from: ${clientBuildPath}`);
  app.use(express.static(clientBuildPath));
} else {
  console.warn("Client build not found. Tried paths:", potentialPaths);
}

// Ensure uploads directory exists
try {
  const uploadDirectories = [
    path.join(__dirname, "uploads", "avatars"),
    path.join(__dirname, "uploads", "documents"),
    path.join(__dirname, "uploads", "volunteer-submissions"),
  ];
  for (const uploadsDir of uploadDirectories) {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  }
  console.log("Ensured upload directories exist");
} catch (dirError) {
  console.warn(
    "Could not create uploads directory. File uploads may fail, but server will continue starting.",
    dirError.message,
  );
}
app.use(
  "/uploads/avatars",
  express.static(path.join(__dirname, "uploads", "avatars")),
);

// Health
app.use("/api/health", functionToExpress(healthHandler));

// Internal integration feed for monitoring.mmpzmne.co.zw.
app.use(
  "/api/integration/master-data",
  functionToExpress(integrationMasterDataHandler),
);
app.use(
  "/api/integration/me/approved-summaries",
  functionToExpress(integrationMeSummariesHandler),
);

// Auth
app.use("/api/login", functionToExpress(loginHandler));

// Indicators + Progress + Activities
app.use("/api/indicators/:id/progress", functionToExpress(progressHandler));
app.use("/api/indicators/:id/activities", functionToExpress(activitiesHandler));
app.use("/api/indicators", functionToExpress(indicatorsHandler));
app.use("/api/progress-updates", functionToExpress(progressHandler));
app.use("/api/activities/:id/outputs", functionToExpress(outputsHandler));
app.use("/api/activities", functionToExpress(activitiesHandler));
app.use("/api/outputs", functionToExpress(outputsHandler));

// Approvals
app.use("/api/approvals/pending", functionToExpress(approvalsHandler));
app.use("/api/approvals", functionToExpress(approvalsHandler));
app.use("/api/progress/:id/approve", functionToExpress(approvalsHandler));

// Notifications
app.get("/api/notifications/stream", (req, res) => {
  const token =
    req.query.token ||
    req.query.sessionToken ||
    getBearerTokenFromHeaders(req.headers);
  const session = verifySessionToken(token);
  if (!session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const userId = Number(session.userId);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.write("retry: 15000\n\n");
  res.socket?.setKeepAlive?.(true);
  res.flushHeaders?.();

  const send = (payload) => {
    if (payload?.user_id && Number(payload.user_id) !== userId) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send({ kind: "connected", user_id: userId });
  const unsubscribe = subscribeRealtime(send);
  const heartbeat = setInterval(() => {
    res.write("event: heartbeat\ndata: {}\n\n");
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
    res.end();
  });
});

app.use("/api/notifications", functionToExpress(notificationsHandler));
app.use("/api/announcements/:id", functionToExpress(announcementsHandler));
app.use("/api/announcements", functionToExpress(announcementsHandler));
app.use("/api/push/subscriptions", functionToExpress(pushSubscriptionsHandler));
app.use("/api/push/config", functionToExpress(pushSubscriptionsHandler));

// Users and roles
app.use("/api/users/:id/confirm-role", functionToExpress(usersHandler));
app.use("/api/users/:id/role", functionToExpress(usersHandler));
app.use("/api/users", functionToExpress(usersHandler));
app.use("/api/roles", functionToExpress(rolesHandler));
app.use(
  "/api/governance/pending-role-assignments",
  functionToExpress(pendingRoleAssignmentsHandler),
);
app.use("/api/governance/queue", functionToExpress(governanceHandler));
app.use("/api/governance/action", functionToExpress(governanceHandler));

// Dashboard
app.use(
  "/api/dashboard/executive-summary",
  functionToExpress(dashboardHandler),
);
app.use("/api/analytics/risk-summary", functionToExpress(analyticsHandler));
app.use("/api/analytics/multi-year", functionToExpress(analyticsHandler));
app.use(
  "/api/analytics/indicator-velocity",
  functionToExpress(analyticsHandler),
);

// Finance & Procurement
app.use("/api/finance/summary", functionToExpress(financeCoreHandler));
app.use("/api/finance/grants", functionToExpress(financeCoreHandler));
app.use("/api/finance/budget-lines", functionToExpress(financeCoreHandler));
app.use("/api/finance/budgets", functionToExpress(financeCoreHandler));
app.use("/api/budget/overview", functionToExpress(budgetHandler));
app.use("/api/budget/programs", functionToExpress(budgetHandler));
app.use("/api/budget/indicators", functionToExpress(budgetHandler));
app.use("/api/budget/activities", functionToExpress(budgetHandler));
app.use("/api/procurement/:id", functionToExpress(procurementHandler));
app.use("/api/program-lifecycle", functionToExpress(programLifecycleHandler));
// Programs/projects/expenses/governance
app.use(
  "/api/settings/finance-threshold",
  functionToExpress(financeThresholdHandler),
);
app.use("/api/programs", functionToExpress(programsHandler));
app.use("/api/projects/:id", functionToExpress(projectsHandler));
app.use("/api/projects", functionToExpress(projectsHandler));
app.use("/api/expenses/:id", functionToExpress(expensesHandler));
app.use("/api/expenses", functionToExpress(expensesHandler));
app.use(
  "/api/governance/approvals/:id",
  functionToExpress(governanceApprovalsHandler),
);
app.use(
  "/api/governance/approvals",
  functionToExpress(governanceApprovalsHandler),
);
app.use("/api/governance/:id", functionToExpress(governanceHandler));
app.use("/api/reports/pdf", functionToExpress(reportsHandler));
app.use("/api/reports/excel", functionToExpress(reportsHandler));
app.use("/api/export/indicators", functionToExpress(reportsHandler));
app.get("/api/me/session", async (req, res) => {
  const token = getBearerTokenFromHeaders(req.headers);
  const session = verifySessionToken(token);

  if (!session?.userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const users = await sql`
    SELECT
      id,
      name,
      email,
      role_code,
      system_role,
      job_title,
      short_bio,
      profile_picture_url,
      require_password_reset,
      role_assignment_status,
      role_confirmed_at
    FROM users
    WHERE id = ${session.userId}
    LIMIT 1
  `;

  if (users.length === 0) {
    res.status(401).json({ error: "Session is no longer valid" });
    return;
  }

  const user = users[0];
  const systemRole = resolveSystemRole(user.role_code, user.system_role);
  const identity = buildIdentity(user, { systemRole });

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role_code: user.role_code,
      system_role: systemRole,
      job_title: identity.displayTitle,
      department: identity.department,
      employment_type: identity.employmentType,
      identity,
      short_bio: user.short_bio || "",
      profile_picture_url: user.profile_picture_url || null,
      role_assignment_status: user.role_assignment_status || "pending_reassignment",
      role_confirmed_at: user.role_confirmed_at,
      role: toLegacyRole(user.role_code, systemRole),
      require_password_reset: user.require_password_reset,
    },
  });
});
app.use("/api/me", functionToExpress(meHandler));

// Kobo
app.use("/api/kobo/config", functionToExpress(koboConfigHandler));
app.use("/api/kobo/disconnect", functionToExpress(koboActionsHandler));
app.use("/api/kobo/forms", functionToExpress(koboActionsHandler));
app.use("/api/kobo/link/:id", functionToExpress(koboActionsHandler));
app.use("/api/kobo/link", functionToExpress(koboActionsHandler));
app.use("/api/kobo/links", functionToExpress(koboActionsHandler));
app.use("/api/kobo/sync/:id", functionToExpress(koboActionsHandler));
app.use("/api/kobo/sync-all", functionToExpress(koboActionsHandler));
app.use("/api/kobo/import-participants", functionToExpress(koboActionsHandler));
app.use("/api/kobo/fields/:uid", functionToExpress(koboActionsHandler));

// Facilitators
app.use("/api/facilitators/:id", functionToExpress(facilitatorsHandler));
app.use("/api/facilitators", functionToExpress(facilitatorsHandler));
app.use(
  "/api/facilitator-assignments",
  functionToExpress(facilitatorAssignmentsHandler),
);
app.use(
  "/api/facilitator-attendance",
  functionToExpress(facilitatorAttendanceHandler),
);

// Volunteer
app.use("/api/volunteer", functionToExpress(volunteerHandler));
app.use("/api/calendar/:id", functionToExpress(calendarEventsHandler));
app.use("/api/calendar", functionToExpress(calendarEventsHandler));
app.use(
  "/api/documents/:id/download",
  functionToExpress(documentLibraryHandler),
);
app.use("/api/documents/:id", functionToExpress(documentLibraryHandler));
app.use("/api/documents", functionToExpress(documentLibraryHandler));

app.use("/api/submissions/:id/action", functionToExpress(submissionsHandler));
app.use("/api/submissions", functionToExpress(submissionsHandler));

app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

app.use((req, res) => {
  if (fs.existsSync(clientBuildPath)) {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  } else {
    res.send("MMPZ ERP API server is running.");
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  startCalendarReminderScheduler();
});
