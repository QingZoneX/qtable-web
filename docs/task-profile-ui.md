# QTable Task Profile UI

QTable uses an explicit per-table Task Profile to describe business semantics. Runtime consumers must use saved field IDs and must not infer semantics from field names.

## Entry points

- Every SmartTable page exposes **业务语义** in the table header.
- Kanban shows a setup / repair state when no valid profile or status mapping exists.

## Supported mappings

Field semantics:

- record title
- status
- assignee
- priority
- start date
- due date
- progress
- parent task
- dependency
- workload

Status semantics:

- not started
- completed
- blocked

The three status-value groups are mutually exclusive.

## Editing model

- `read` / `update`: inspect only.
- `edit` / `manage`: update or clear the profile and create recommended standard fields.
- AI-style suggestions are fetched from `suggestTaskProfile`, applied to a local draft only, and never saved without explicit confirmation.
- Deleted or type-incompatible mapped fields remain visible as invalid mappings until the user explicitly repairs them.

## Kanban contract

Kanban consumes the saved `statusFieldId`, `titleFieldId`, `assigneeFieldId`, and `dueDateFieldId` / `startDateFieldId`. It does not fall back to regex field-name matching or the first text/select/date field.

Generic tables may remain profile-free; QTable only asks for configuration when a semantic consumer such as Kanban needs it.
