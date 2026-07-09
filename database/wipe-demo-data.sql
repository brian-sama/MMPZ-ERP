-- MMPZ ERP — Demo Data Wipe
-- Removes all transactional/demo data while preserving:
--   roles, permissions, role_permissions, users, system_settings, kobo_config
--
-- Run with:
--   psql -U <db_user> -d <db_name> -f database/wipe-demo-data.sql
-- Or from inside psql:
--   \i database/wipe-demo-data.sql

BEGIN;

TRUNCATE TABLE
  -- M&E summaries (no dependents)
  me_activity_summaries,
  me_indicator_summaries,

  -- Approval chain
  approval_logs,
  approvals,

  -- Procurement
  procurement_items,
  procurement_requests,

  -- Budget & funding
  budget_lines,
  budgets,
  grants,
  donors,

  -- Facilitators
  facilitator_attendance,
  facilitator_assignments,
  development_facilitators,

  -- Indicator progress
  indicator_progress,
  indicator_targets,
  outputs,

  -- Announcements & communications
  announcements,

  -- Finance requests
  expense_requests,

  -- Governance approvals
  approval_steps,
  approval_requests,

  -- Staff assignments & history
  project_assignments,
  user_role_history,
  user_supervisors,

  -- Document library (includes Finance Vault category)
  document_library_files,

  -- Calendar
  calendar_events,

  -- Volunteer & submissions
  volunteer_submission_recipients,
  volunteer_activity_reports,
  volunteer_participants,
  volunteer_submissions,

  -- KoboToolbox
  kobo_submissions,
  kobo_form_links,

  -- Activities
  activities,

  -- Notifications
  push_subscriptions,
  notifications,

  -- Audit trail
  audit_logs,

  -- M&E core
  progress_updates,
  indicators,
  projects,
  programs

RESTART IDENTITY CASCADE;

COMMIT;

-- Verify what remains
SELECT
  schemaname,
  tablename,
  n_live_tup AS row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY tablename;
