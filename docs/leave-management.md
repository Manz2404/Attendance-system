# Leave management rollout and rollback

Baseline: `1d7d6551d62fc95f104f919c653d8a82b534b3e2`.
Backup branch: `backup/before-leave-2026-11-22`.
Feature branch: `feature/leave-management`.

Before installing, stop the Hadir app (not MySQL or cloudflared). Export the entire attendance database with SQLyog, including structure and data, and verify the export completed. Keep `.env.local` and any uncommitted laptop source changes in a separate private backup. Git backup branches contain committed code only; they are not database or local-file backups.

Use a separate test database restored from your backup to validate the feature first. Never run automated tests against your attendance database.

After pulling the feature branch: install dependencies with `npm install`, run `npm run db:migrate`, then `npm run build`. Start with `npm start` only after the build succeeds and port 3000 is free. Do not build over a running production server.

## Configuration

Admin: Leave → Entitlements & policy. Choose a year, a type and either all active staff or one employee. Save the allocated total. Repeat for Annual, Inpatient, Outpatient, Maternity, Exam and MC. A zero allocation blocks requests. Existing approved and pending leave cannot be reduced below the reserved total. New staff require allocation separately.

The six types have separate balances. MC and Outpatient do not share a pool. No statutory entitlements are assumed: Admin must configure the company policy. There is no automatic accrual, carry-forward or prorating in this release. Calendar-year requests only; split cross-year periods.

Working-day types count assigned schedule weekdays and exclude configured holidays. Calendar-day types count every day. Inpatient and Maternity default to calendar days. Admin can change these settings; submitted requests retain their original charged dates. Half-day AM/PM requests must use one date.

MC, Inpatient and Outpatient default to requiring a private PDF/JPEG/PNG document, maximum 2 MB. Documents are served as authenticated downloads and never appear in the calendar or audit log. No malware scanning is included; use trusted supporting documents.

Admin can assign active workspace users as leave managers per employee. This does not grant attendance administration. Admin/HR or an assigned manager can make a single final approval decision; there is no sequential two-stage approval. Self-approval is blocked by applicant user and linked employee identity. Admin/HR may submit on behalf of employees; another authorized approver must review those submissions. Staff who are managers use My leave from their staff portal.

Pending requests reserve balance. Rejected/cancelled requests restore it. Staff can cancel pending requests immediately; approved leave needs a cancellation decision. Duplicate/overlapping requests are rejected. Approved cancellations are retained for audit. Concurrent writes are serialized per workspace.

Calendar shows approved and cancellation-pending leave visible to the viewer: own leave for staff, assigned employees for managers, whole workspace for Admin/HR. It hides medical type/reason. This module does not yet change attendance absence calculations or payroll.

## Rollback

Stop the Hadir server first. With local edits safely backed up, switch to `backup/before-leave-2026-11-22`. Run `npm install`, remove only the generated `.next` folder, run `npm run build`, then `npm start`. Hard-refresh the browser.

Migration 009 adds four tables and does not alter existing tables. A code-only rollback leaves leave records stored but unavailable through the old UI; do not drop these tables. The old migrator ignores the new migration entry. Returning to the feature branch restores access to those records.

Restoring the full database backup is a separate operation and loses ALL records added since that backup, including attendance. Export the current database first and decide explicitly whether that loss is intended. Prefer code-only rollback for UI issues.
