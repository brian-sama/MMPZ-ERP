# MMPZ Program Lifecycle Architecture

## Product Thesis

MMPZ does not operate as isolated ERP, M&E, finance, and mobile modules. It operates through governed programmatic operational cycles.

The platform should therefore behave as an Integrated Program Lifecycle Management Ecosystem where each activity moves through:

```text
Plan -> Budget -> Approve -> Release -> Prepare -> Implement -> Submit -> Liquidate -> Verify -> Publish -> Report -> Replan
```

## System Ownership

| Layer | Primary ownership | Responsibility |
| --- | --- | --- |
| ERP | Authorization, finance, procurement, document control | Owns the activity lifecycle, budget checks, approvals, fund release, procurement, liquidations, and operational audit trail. |
| Mobile / My Portal | Field execution | Owns assignments, checklists, participant lists, field forms, evidence capture, and sync. |
| Compass | Evidence validation and reporting | Owns QA, corrections, approval, publication, analytics, and learning feedback. |

## Canonical Activity Statuses

Activities should use one shared lifecycle vocabulary:

```text
draft
pending_review
pending_budget_verification
pending_director_approval
approved
funds_released
prepared
in_progress
submitted
under_review
liquidation_pending
liquidated
verified
published
archived
rejected
needs_correction
```

## Current Implementation Map

| Operational need | Current implementation | Integration gap |
| --- | --- | --- |
| Planning | `projects`, `field_activities`, legacy `activities` | No single activity lifecycle header from concept to reporting. |
| Budgeting | `grants`, `budgets`, `budget_lines` | Budget lines are project-linked but not activity-lifecycle-linked. |
| Approval | `approvals`, `unified_submissions`, governance queue | Multiple approval paths exist and need one workflow vocabulary. |
| Fund release | `expense_requests` | Funds are approved/paid but not linked as release events for activities. |
| Procurement | `procurement_requests`, `procurement_items` | Procurement is project/budget-line linked but not activity-triggered. |
| Field execution | `field_activities`, volunteer reports/submissions | Execution exists but begins too late in the lifecycle. |
| Liquidation | Partial through paid expenses | No first-class liquidation, receipt, voucher, or outstanding balance model. |
| Evidence | `volunteer_submissions`, `document_library_files` | Documents need linked entity, document type, verification, and physical-copy tracking. |
| Verification | `unified_submissions`, Compass sync | QA, correction, and publication states need to be explicit and shared. |
| Learning | dashboards and analytics | Report outputs need to feed the next planning cycle directly. |

## Target Data Model

The safest migration path is additive. Do not rename existing tables until production data is audited.

### `program_activities`

Canonical lifecycle header for planned operational activities.

Important fields:

- `id`
- `program_id`
- `project_id`
- `indicator_id`
- `title`
- `concept_note`
- `activity_plan`
- `status`
- `planned_start_date`
- `planned_end_date`
- `location`
- `owner_user_id`
- `assigned_facilitator_user_id`
- `assigned_reviewer_user_id`
- `created_by_user_id`
- `approved_by_user_id`
- `published_at`

### `program_activity_financial_profiles`

Financial accountability summary for an activity.

Important fields:

- `program_activity_id`
- `approved_budget`
- `funds_released`
- `procurement_committed`
- `actual_spend`
- `outstanding_balance`
- `liquidation_status`
- `finance_verified_by_user_id`
- `finance_verified_at`

### `program_activity_workflow_events`

Immutable status history.

Important fields:

- `program_activity_id`
- `from_status`
- `to_status`
- `action`
- `actor_user_id`
- `actor_role_code`
- `comment`
- `created_at`

### `activity_liquidations`

First-class financial closure.

Important fields:

- `program_activity_id`
- `expense_request_id`
- `submitted_by_user_id`
- `verified_by_user_id`
- `status`
- `total_released`
- `total_spent`
- `balance_returned`
- `outstanding_balance`
- `submitted_at`
- `verified_at`

### `activity_liquidation_lines`

Receipt/voucher lines.

Important fields:

- `liquidation_id`
- `budget_line_id`
- `description`
- `amount`
- `receipt_number`
- `voucher_number`
- `document_id`

### Document Traceability Fields

Extend `document_library_files` additively:

- `related_entity_type`
- `related_entity_id`
- `document_type`
- `approval_status`
- `verified_by_user_id`
- `verified_at`
- `physical_copy_received`
- `physical_copy_received_by_user_id`
- `physical_copy_received_at`

### Link Existing Tables

Add nullable `program_activity_id` to:

- `field_activities`
- `procurement_requests`
- `expense_requests`
- `unified_submissions`
- `volunteer_submissions`
- `volunteer_activity_reports`
- `document_library_files`

This allows the old modules to keep working while the ERP gains one operational spine.

## Implementation Phases

1. Lifecycle visibility
   - Add a Program Lifecycle workspace that reads existing modules as one cycle.
   - Surface current gaps honestly: liquidation, document traceability, publication states, and activity financial profiles.

2. Schema foundation
   - Add `program_activities`, workflow events, financial profiles, liquidations, and document traceability fields.
   - Backfill existing `field_activities`, requests for funds, procurement, and paid expenses where possible.

3. Workflow engine
   - Centralize status transitions through one service.
   - Enforce maker-checker rules, finance verification, Director approval, and correction loops.

4. Activity-coupled finance and procurement
   - Create budgets, fund releases, procurement requests, and expense requests from the activity record.
   - Show approved budget, committed procurement, released funds, actual spend, liquidation status, and outstanding balance on the activity.

5. Liquidation and hybrid document control
   - Build liquidation screens for receipts, vouchers, physical registers, and balances.
   - Require document verification and physical-copy acknowledgement where policy needs it.

6. Compass publication loop
   - Push approved field activities and evidence into Compass.
   - Pull publication/QA states back into ERP.
   - Mark data as reportable only after verification and publication.

7. Decision intelligence
   - Feed published data, liquidation findings, compliance issues, and performance signals into the next planning cycle.

## Design Rule

Every major object should answer five questions:

```text
Who owns it?
What stage is it in?
What money is attached to it?
What evidence proves it happened?
What decision should it influence next?
```
