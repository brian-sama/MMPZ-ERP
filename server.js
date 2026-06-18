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
import { handler as vaultHandler } from "./server/api/vault.js";
import { handler as pushSubscriptionsHandler } from "./server/api/push-subscriptions.js";
import { handler as submissionsHandler } from "./server/api/submissions.js";
import { handler as fundingRequestsHandler } from "./server/api/funding-requests.js";
import { handler as leaveHandler } from "./server/api/leave.js";
import { handler as integrationMasterDataHandler } from "./server/api/integration-master-data.js";
import { handler as integrationMeSummariesHandler } from "./server/api/integration-me-summaries.js";
import { handler as operationsHandler } from "./server/api/operations.js";
import { subscribeRealtime } from "./server/api/utils/notification-center.js";
import crypto from "crypto";
import {
  getBearerTokenFromHeaders,
  issueSessionToken,
  verifySessionToken,
} from "./server/api/utils/session-token.js";

// Short-lived single-use tickets for EventSource connections (60 second TTL).
// Keyed by ticket string → { userId, expiresAt }.
const sseTickets = new Map();
const SSE_TICKET_TTL_MS = 60_000;

function issueSseTicket(userId) {
  const ticket = crypto.randomBytes(24).toString("hex");
  sseTickets.set(ticket, { userId, expiresAt: Date.now() + SSE_TICKET_TTL_MS });
  return ticket;
}

function redeemSseTicket(ticket) {
  const entry = sseTickets.get(ticket);
  if (!entry) return null;
  sseTickets.delete(ticket);
  if (Date.now() > entry.expiresAt) return null;
  return entry.userId;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of sseTickets) {
    if (now > entry.expiresAt) sseTickets.delete(key);
  }
}, 5 * 60 * 1000);

// Handoff token helpers — 60-second single-use tokens for cross-app SSO.
// ERP signs with ERP_INTEGRATION_TOKEN; M&E verifies with the same key (and vice versa).
const HANDOFF_TTL_MS = 60_000;

function createHandoffToken(email, signingKey) {
  const payload = Buffer.from(
    JSON.stringify({ email, exp: Date.now() + HANDOFF_TTL_MS }),
    "utf8",
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", signingKey).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifyHandoffToken(token, signingKey) {
  const dot = token.indexOf(".");
  if (dot < 0) return null;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = crypto.createHmac("sha256", signingKey).update(payload).digest("base64url");
  const expectedBuf = Buffer.from(expected);
  const sigBuf = Buffer.from(sig);
  if (expectedBuf.length !== sigBuf.length || !crypto.timingSafeEqual(expectedBuf, sigBuf))
    return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!data.email || !data.exp || data.exp < Date.now()) return null;
    return { email: data.email };
  } catch {
    return null;
  }
}

function handoffErrorHtml(message) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sign-in failed</title></head>
<body style="font-family:sans-serif;max-width:480px;margin:64px auto;padding:0 16px">
<h2>Sign-in failed</h2><p>${message}</p>
<p><a href="/login">Return to login</a></p></body></html>`;
}

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

  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, 5 * 60 * 1000);

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
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: [
          "'self'",
          "https://mmpzmne.co.zw",
          "https://monitoring.mmpzmne.co.zw",
        ],
        fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
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

// Exchange a session token for a short-lived SSE-only ticket.
// The client calls this first, then connects to /stream with the ticket.
app.post("/api/notifications/stream-token", (req, res) => {
  const token = getBearerTokenFromHeaders(req.headers);
  const session = verifySessionToken(token);
  if (!session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  res.json({ ticket: issueSseTicket(session.userId) });
});

// Notifications
app.get("/api/notifications/stream", (req, res) => {
  // Prefer the short-lived SSE ticket; fall back to Bearer header for
  // backwards-compatibility. Raw session tokens in query strings are no
  // longer accepted — use the /stream-token endpoint instead.
  let userId;
  const ticket = req.query.ticket;
  if (ticket) {
    userId = redeemSseTicket(ticket);
  } else {
    const session = verifySessionToken(getBearerTokenFromHeaders(req.headers));
    userId = session?.userId ?? null;
  }
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const numericUserId = Number(userId);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.write("retry: 15000\n\n");
  res.socket?.setKeepAlive?.(true);
  res.flushHeaders?.();

  const send = (payload) => {
    if (payload?.user_id && Number(payload.user_id) !== numericUserId) return;
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send({ kind: "connected", user_id: numericUserId });
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
app.use("/api/operations", functionToExpress(operationsHandler));
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
// Issues a 60-second handoff token the M&E server can verify to establish a Compass session.
app.post("/api/auth/handoff", async (req, res) => {
  const token = getBearerTokenFromHeaders(req.headers);
  const session = verifySessionToken(token);
  if (!session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const signingKey = process.env.ERP_INTEGRATION_TOKEN;
  if (!signingKey) {
    res.status(503).json({ error: "Cross-app handoff is not configured on this server." });
    return;
  }

  const rows = await sql`SELECT email FROM users WHERE id = ${session.userId} LIMIT 1`;
  if (!rows[0]?.email) {
    res.status(404).json({ error: "User not found." });
    return;
  }

  const meBaseUrl = (process.env.ME_PUBLIC_URL ?? "https://monitoring.mmpzmne.co.zw").replace(
    /\/+$/,
    "",
  );
  const handoffToken = createHandoffToken(rows[0].email, signingKey);
  res.json({
    handoffUrl: `${meBaseUrl}/api/auth/accept-handoff?token=${encodeURIComponent(handoffToken)}`,
  });
});

// Accepts a 60-second handoff token from M&E and returns an HTML page that sets sessionStorage
// and redirects to the dashboard. The AuthContext will re-verify via /api/me/session on mount.
app.get("/api/auth/accept-handoff", async (req, res) => {
  const rawToken = typeof req.query.token === "string" ? req.query.token : "";

  const signingKey = process.env.ME_INTEGRATION_TOKEN;
  if (!signingKey) {
    res.status(503).send(handoffErrorHtml("Cross-app handoff is not configured on this server."));
    return;
  }

  const claims = verifyHandoffToken(rawToken, signingKey);
  if (!claims) {
    res
      .status(401)
      .send(
        handoffErrorHtml(
          "This sign-in link has expired or is invalid. Please try switching apps again.",
        ),
      );
    return;
  }

  const rows = await sql`SELECT id FROM users WHERE email = ${claims.email} LIMIT 1`;
  if (!rows[0]) {
    res.status(403).send(handoffErrorHtml("Your account was not found in the ERP system."));
    return;
  }

  const sessionToken = issueSessionToken(rows[0].id);
  // Encode token as base64 so it is safe to embed in a JS string literal.
  const encodedToken = Buffer.from(sessionToken, "utf8").toString("base64");

  res.setHeader("Content-Type", "text/html; charset=utf-8").send(
    `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Signing in…</title></head>
<body>
<script>
try {
  sessionStorage.setItem('mmpz_auth_token', atob('${encodedToken}'));
  window.location.replace('/dashboard');
} catch (e) {
  window.location.replace('/login?error=handoff_failed');
}
</script>
<noscript><meta http-equiv="refresh" content="0;url=/login?error=handoff_noscript"></noscript>
</body>
</html>`,
  );
});

// Aggregated health status for the System Health panel in Settings.
// Queries ERP DB for the last M&E summary sync and calls M&E's lightweight health endpoint.
app.get("/api/admin/system-health", async (req, res) => {
  const token = getBearerTokenFromHeaders(req.headers);
  const session = verifySessionToken(token);
  if (!session?.userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  // ERP-side: last time M&E summaries were received
  const summaryRows = await sql`
    SELECT COUNT(*) AS total, MAX(last_synced_at) AS last_received_at
    FROM me_activity_summaries
  `.catch(() => []);
  const summaryStats = summaryRows[0] ?? { total: 0, last_received_at: null };

  // M&E-side: call M&E health endpoint (5-second timeout, non-fatal if unreachable)
  let meHealth = null;
  const meInternalUrl = (process.env.ME_INTERNAL_API_URL ?? "").replace(/\/api\/?$/, "").replace(/\/+$/, "");
  const meToken = process.env.ME_INTEGRATION_TOKEN;
  if (meInternalUrl && meToken) {
    try {
      const ac = new AbortController();
      const tid = setTimeout(() => ac.abort(), 5000);
      const r = await fetch(`${meInternalUrl}/api/integration/health`, {
        headers: { Authorization: `Bearer ${meToken}` },
        signal: ac.signal,
      });
      clearTimeout(tid);
      if (r.ok) meHealth = await r.json();
    } catch {
      // M&E unreachable — frontend will show "offline"
    }
  }

  res.json({
    checkedAt: new Date().toISOString(),
    erp: {
      lastReceivedMeSummaryAt: summaryStats.last_received_at ?? null,
      totalMeSummariesStored: Number(summaryStats.total ?? 0),
    },
    me: meHealth,
  });
});

app.post("/api/upload-avatar", uploadAvatarHandler);
app.post("/api/me/upload-avatar", uploadAvatarHandler);
app.use("/api/me/change-password", functionToExpress(changePasswordHandler));
app.use("/api/me/profile", functionToExpress(userProfileHandler));
app.use("/api/me/leave", functionToExpress(leaveHandler));
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

// Finance Vault — restricted to finance/admin roles; vault documents are
// excluded from the public document library above.
app.use("/api/vault/:id/download", functionToExpress(vaultHandler));
app.use("/api/vault/:id", functionToExpress(vaultHandler));
app.use("/api/vault", functionToExpress(vaultHandler));

app.use("/api/submissions/:id/action", functionToExpress(submissionsHandler));
app.use("/api/submissions", functionToExpress(submissionsHandler));

app.use("/api/funding-requests/:id/excel", functionToExpress(fundingRequestsHandler));
app.use("/api/funding-requests/:id/print", functionToExpress(fundingRequestsHandler));
app.use("/api/funding-requests/:id/liquidate/verify", functionToExpress(fundingRequestsHandler));
app.use("/api/funding-requests/:id/liquidate", functionToExpress(fundingRequestsHandler));
app.use("/api/funding-requests/:id", functionToExpress(fundingRequestsHandler));
app.use("/api/funding-requests", functionToExpress(fundingRequestsHandler));

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
