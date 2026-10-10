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

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return corsResponse();
  }

  if (event.httpMethod !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  if (!requireIntegrationToken(event)) {
    return errorResponse("Unauthorized integration request", 401);
  }

  try {
    const body =
      typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};

    const {
      employeeEmail,
      employeeName,
      leaveType = "vacation",
      startDate,
      endDate,
      totalDays,
      contactAddress = "",
      reason = "",
      compassApplicationId = null,
    } = body;

    if (!startDate || !endDate) {
      return errorResponse("startDate and endDate are required", 400);
    }

    // Find ERP user matching by email or name, or fallback to first active admin
    let user = null;
    if (employeeEmail) {
      const [byEmail] = await sql`
        SELECT id, name, email FROM users
        WHERE LOWER(email) = LOWER(${employeeEmail})
        LIMIT 1
      `;
      user = byEmail;
    }

    if (!user && employeeName) {
      const [byName] = await sql`
        SELECT id, name, email FROM users
        WHERE LOWER(name) ILIKE ${'%' + employeeName.trim().toLowerCase() + '%'}
        LIMIT 1
      `;
      user = byName;
    }

    if (!user) {
      const [adminUser] = await sql`
        SELECT id, name, email FROM users
        WHERE is_active = true
        ORDER BY id ASC
        LIMIT 1
      `;
      user = adminUser;
    }

    if (!user) {
      return errorResponse("No active user found in ERP to attribute leave application", 400);
    }

    const calculatedDays =
      totalDays ||
      Math.max(
        1,
        Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / (24 * 60 * 60 * 1000)) + 1,
      );

    const title = `${employeeName || user.name} - ${leaveType.toUpperCase()} Leave (${new Date(startDate).toISOString().slice(0, 10)} to ${new Date(endDate).toISOString().slice(0, 10)})`;

    const metadata = {
      leave_type: leaveType.toLowerCase(),
      start_date: startDate,
      end_date: endDate,
      total_days: calculatedDays,
      contact_address: contactAddress,
      employee_name: employeeName || user.name,
      reason,
      source: "mobile_compass",
      compass_application_id: compassApplicationId,
    };

    const [submission] = await sql`
      INSERT INTO unified_submissions (
        submitter_user_id,
        submission_type,
        department_category,
        title,
        description,
        current_handler_role,
        status,
        metadata
      ) VALUES (
        ${user.id},
        'leave_application',
        'HR',
        ${title},
        ${reason || 'Leave application submitted from MMPZ Mobile'},
        'FINANCE_OFFICER',
        'submitted',
        ${sql.json(metadata)}
      ) RETURNING *
    `;

    // Ensure leave balance exists
    await sql`
      INSERT INTO leave_balances (user_id)
      VALUES (${user.id})
      ON CONFLICT (user_id) DO NOTHING
    `;

    return successResponse({
      success: true,
      submissionId: submission.id,
      title: submission.title,
      status: submission.status,
      erpUserId: user.id,
    });
  } catch (error) {
    console.error("Integration leave error:", error);
    return errorResponse(error?.message || "Failed to submit leave application to ERP", 500);
  }
};
