import { sql } from "./utils/db.js";
import {
  corsResponse,
  errorResponse,
  parseBody,
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

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const uuidOrNull = (value) => {
  const id = value == null ? "" : String(value).trim();
  return uuidPattern.test(id) ? id : null;
};

const textOrNull = (value) => {
  const text = value == null ? "" : String(value).trim();
  return text || null;
};

const numberOrZero = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const dateOrNull = (value) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const upsertIndicator = async (indicator) => {
  const rows = await sql`
    INSERT INTO me_indicator_summaries (
      me_indicator_id,
      code,
      title,
      erp_program_id,
      erp_project_id,
      erp_budget_line_id,
      target_value,
      reached_value,
      approved_activity_count,
      participant_total,
      status,
      payload,
      last_synced_at,
      updated_at
    )
    VALUES (
      ${String(indicator.id)},
      ${textOrNull(indicator.code)},
      ${textOrNull(indicator.title)},
      ${uuidOrNull(indicator.erpProgramId)},
      ${uuidOrNull(indicator.erpProjectId)},
      ${uuidOrNull(indicator.erpBudgetLineId)},
      ${numberOrZero(indicator.target)},
      ${numberOrZero(indicator.reached)},
      ${numberOrZero(indicator.approvedActivityCount)},
      ${numberOrZero(indicator.participantTotal)},
      ${textOrNull(indicator.status)},
      ${JSON.stringify(indicator)}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (me_indicator_id) DO UPDATE SET
      code = EXCLUDED.code,
      title = EXCLUDED.title,
      erp_program_id = EXCLUDED.erp_program_id,
      erp_project_id = EXCLUDED.erp_project_id,
      erp_budget_line_id = EXCLUDED.erp_budget_line_id,
      target_value = EXCLUDED.target_value,
      reached_value = EXCLUDED.reached_value,
      approved_activity_count = EXCLUDED.approved_activity_count,
      participant_total = EXCLUDED.participant_total,
      status = EXCLUDED.status,
      payload = EXCLUDED.payload,
      last_synced_at = NOW(),
      updated_at = NOW()
    RETURNING id
  `;

  return {
    erpSummaryId: String(rows[0].id),
    meIndicatorId: String(indicator.id),
    status: "synced",
  };
};

const upsertActivity = async (activity) => {
  const rows = await sql`
    INSERT INTO me_activity_summaries (
      me_activity_id,
      me_indicator_id,
      code,
      name,
      activity_type,
      activity_date,
      district_code,
      district_name,
      erp_program_id,
      erp_project_id,
      erp_budget_line_id,
      male_participants,
      female_participants,
      total_participants,
      evidence_count,
      logsheet_count,
      participant_summary_count,
      status,
      qa_status,
      payload,
      last_synced_at,
      updated_at
    )
    VALUES (
      ${String(activity.id)},
      ${textOrNull(activity.indicator?.id)},
      ${textOrNull(activity.code)},
      ${textOrNull(activity.name)},
      ${textOrNull(activity.type)},
      ${dateOrNull(activity.date)},
      ${textOrNull(activity.district?.code)},
      ${textOrNull(activity.district?.name)},
      ${uuidOrNull(activity.erpProgramId)},
      ${uuidOrNull(activity.erpProjectId)},
      ${uuidOrNull(activity.erpBudgetLineId)},
      ${numberOrZero(activity.participants?.male)},
      ${numberOrZero(activity.participants?.female)},
      ${numberOrZero(activity.participants?.total)},
      ${numberOrZero(activity.evidenceCount)},
      ${numberOrZero(activity.logsheetCount ?? activity.logsheetsCount)},
      ${numberOrZero(activity.participantSummaryCount)},
      ${textOrNull(activity.status)},
      ${textOrNull(activity.qaStatus)},
      ${JSON.stringify(activity)}::jsonb,
      NOW(),
      NOW()
    )
    ON CONFLICT (me_activity_id) DO UPDATE SET
      me_indicator_id = EXCLUDED.me_indicator_id,
      code = EXCLUDED.code,
      name = EXCLUDED.name,
      activity_type = EXCLUDED.activity_type,
      activity_date = EXCLUDED.activity_date,
      district_code = EXCLUDED.district_code,
      district_name = EXCLUDED.district_name,
      erp_program_id = EXCLUDED.erp_program_id,
      erp_project_id = EXCLUDED.erp_project_id,
      erp_budget_line_id = EXCLUDED.erp_budget_line_id,
      male_participants = EXCLUDED.male_participants,
      female_participants = EXCLUDED.female_participants,
      total_participants = EXCLUDED.total_participants,
      evidence_count = EXCLUDED.evidence_count,
      logsheet_count = EXCLUDED.logsheet_count,
      participant_summary_count = EXCLUDED.participant_summary_count,
      status = EXCLUDED.status,
      qa_status = EXCLUDED.qa_status,
      payload = EXCLUDED.payload,
      last_synced_at = NOW(),
      updated_at = NOW()
    RETURNING id
  `;

  return {
    erpSummaryId: String(rows[0].id),
    meActivityId: String(activity.id),
    status: "synced",
  };
};

export const handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return corsResponse();
  if (event.httpMethod !== "POST")
    return errorResponse("Method not allowed", 405);

  if (!requireIntegrationToken(event)) {
    return errorResponse("Unauthorized integration request", 401);
  }

  const body = parseBody(event);
  const activities = Array.isArray(body.activities) ? body.activities : [];
  const indicators = Array.isArray(body.indicators) ? body.indicators : [];

  try {
    const [indicatorResults, activityResults] = await Promise.all([
      Promise.all(indicators.filter((indicator) => indicator?.id).map(upsertIndicator)),
      Promise.all(activities.filter((activity) => activity?.id).map(upsertActivity)),
    ]);

    return successResponse({
      activities: activityResults,
      indicators: indicatorResults,
      ok: true,
      received: {
        activities: activities.length,
        indicators: indicators.length,
      },
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("M&E approved-summary integration error:", error);
    return errorResponse(
      "Failed to store M&E approved summaries",
      500,
      error.message,
    );
  }
};
