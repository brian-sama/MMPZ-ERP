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
  if (event.httpMethod === "OPTIONS") return corsResponse();
  if (event.httpMethod !== "POST") return errorResponse("Method not allowed", 405);
  if (!requireIntegrationToken(event)) return errorResponse("Unauthorized integration request", 401);

  try {
    const body = typeof event.body === "string" ? JSON.parse(event.body || "{}") : event.body || {};
    const { email, erpUserId, avatarUrl } = body;

    if (!avatarUrl || (!email && !erpUserId)) {
      return errorResponse("Missing required fields (avatarUrl and email/erpUserId)", 400);
    }

    const meBaseUrl = (
      process.env.ME_PUBLIC_URL ||
      process.env.MMPZ_ME_PUBLIC_URL ||
      "https://monitoring.mmpzmne.co.zw"
    ).replace(/\/+$/, "");
    const resolvedAvatarUrl = avatarUrl.startsWith("http")
      ? avatarUrl
      : `${meBaseUrl}${avatarUrl.startsWith("/") ? "" : "/"}${avatarUrl}`;

    if (erpUserId && !isNaN(Number(erpUserId))) {
      await sql`
        UPDATE users
        SET profile_picture_url = ${resolvedAvatarUrl}, updated_at = CURRENT_TIMESTAMP
        WHERE id = ${Number(erpUserId)} OR (email IS NOT NULL AND LOWER(email) = LOWER(${email ? email.trim() : ''}))
      `;
    } else if (email) {
      await sql`
        UPDATE users
        SET profile_picture_url = ${resolvedAvatarUrl}, updated_at = CURRENT_TIMESTAMP
        WHERE LOWER(email) = LOWER(${email.trim()})
      `;
    }

    return successResponse({ success: true, avatarUrl: resolvedAvatarUrl });
  } catch (err) {
    console.error("integration-avatar error:", err);
    return errorResponse("Internal server error", 500, err.message);
  }
};
