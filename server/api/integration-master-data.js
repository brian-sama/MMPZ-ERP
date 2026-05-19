import { sql } from "./utils/db.js";
import {
  corsResponse,
  errorResponse,
  successResponse,
} from "./utils/response.js";

const integrationToken = () =>
  process.env.ERP_INTEGRATION_TOKEN || process.env.INTEGRATION_TOKEN || "";

const headerValue = (headers, name) => {
  const lower = name.toLowerCase();
  return headers?.[name] || headers?.[lower] || "";
};

const bearerToken = (headers) => {
  const header = headerValue(headers, "authorization");
  return header.startsWith("Bearer ")
    ? header.slice("Bearer ".length).trim()
    : "";
};

const requireIntegrationToken = (event) => {
  const expected = integrationToken();
  const supplied =
    headerValue(event.headers, "x-integration-token") ||
    headerValue(event.headers, "x-erp-integration-token") ||
    bearerToken(event.headers);

  return Boolean(expected && supplied === expected);
};

const hasTable = async (tableName) => {
  const rows = await sql`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_name = ${tableName}
        ) AS exists
    `;
  return Boolean(rows[0]?.exists);
};

const loadIfPresent = async (tableName, loader) => {
  if (!(await hasTable(tableName))) return [];
  return loader();
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return corsResponse();
  if (event.httpMethod !== "GET")
    return errorResponse("Method not allowed", 405);

  if (!requireIntegrationToken(event)) {
    return errorResponse("Unauthorized integration request", 401);
  }

  try {
    const [
      roles,
      users,
      programs,
      projects,
      donors,
      grants,
      budgets,
      budgetLines,
      procurementRequests,
      expenseRequests,
    ] = await Promise.all([
      loadIfPresent(
        "roles",
        () => sql`
                SELECT
                    r.code,
                    r.name,
                    r.description,
                    r.is_executive,
                    r.created_at,
                    COALESCE(
                        ARRAY_AGG(rp.permission_code ORDER BY rp.permission_code)
                            FILTER (WHERE rp.permission_code IS NOT NULL),
                        ARRAY[]::varchar[]
                    ) AS permissions
                FROM roles r
                LEFT JOIN role_permissions rp ON rp.role_code = r.code
                GROUP BY r.code, r.name, r.description, r.is_executive, r.created_at
                ORDER BY r.name ASC
            `,
      ),
      loadIfPresent(
        "users",
        () => sql`
                SELECT
                    u.id,
                    u.name,
                    u.email,
                    u.role_code,
                    u.system_role,
                    u.job_title,
                    u.role_assignment_status,
                    u.created_at,
                    u.updated_at
                FROM users u
                ORDER BY u.name ASC
            `,
      ),
      loadIfPresent(
        "programs",
        () => sql`
                SELECT id, name, description, status, created_by_user_id, created_at, updated_at
                FROM programs
                ORDER BY name ASC
            `,
      ),
      loadIfPresent(
        "projects",
        () => sql`
                SELECT
                    id,
                    program_id,
                    name,
                    description,
                    donor,
                    start_date,
                    end_date,
                    status,
                    owner_user_id,
                    created_at,
                    updated_at
                FROM projects
                ORDER BY name ASC
            `,
      ),
      loadIfPresent(
        "donors",
        () => sql`
                SELECT id, name, code, created_at
                FROM donors
                ORDER BY name ASC
            `,
      ),
      loadIfPresent(
        "grants",
        () => sql`
                SELECT id, donor_id, name, code, total_amount, currency, start_date, end_date, created_at
                FROM grants
                ORDER BY name ASC
            `,
      ),
      loadIfPresent(
        "budgets",
        () => sql`
                SELECT id, grant_id, project_id, name, total_amount, created_at
                FROM budgets
                ORDER BY created_at DESC
            `,
      ),
      loadIfPresent(
        "budget_lines",
        () => sql`
                SELECT id, budget_id, code, description, allocated_amount, used_amount, created_at
                FROM budget_lines
                ORDER BY created_at DESC
            `,
      ),
      loadIfPresent(
        "procurement_requests",
        () => sql`
                SELECT
                    id,
                    requested_by_user_id,
                    project_id,
                    budget_line_id,
                    title,
                    justification,
                    total_estimated_cost,
                    bid_analysis_status,
                    status,
                    created_at
                FROM procurement_requests
                ORDER BY created_at DESC
                LIMIT 500
            `,
      ),
      loadIfPresent(
        "expense_requests",
        () => sql`
                SELECT
                    id,
                    project_id,
                    related_indicator_id,
                    requested_by_user_id,
                    description,
                    category,
                    amount,
                    currency,
                    status,
                    paid_at,
                    created_at,
                    updated_at
                FROM expense_requests
                ORDER BY updated_at DESC
                LIMIT 500
            `,
      ),
    ]);

    return successResponse({
      budgetLines,
      budgets,
      donors,
      expenseRequests,
      generatedAt: new Date().toISOString(),
      grants,
      procurementRequests,
      programs,
      projects,
      roles,
      users,
    });
  } catch (error) {
    console.error("Integration master-data error:", error);
    return errorResponse("Failed to load ERP master data", 500, error.message);
  }
};
