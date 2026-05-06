# Incident Runbook

> Hardening audit finding 9.2 — defines backup/PITR, incident ownership,
> rollback procedures, and Realtime/migration safety controls.

## Roles

| Role | Responsibility |
|---|---|
| On-call engineer | First responder, triage, communicate to support |
| Support contact | User-facing status updates, SUPPORT_EMAIL inbox |
| Admin (Supabase access) | Service-role DB queries, backup restore |

## Supabase Backup and PITR

**Supabase Free tier**: Daily backups, 7-day retention. No PITR.
**Supabase Pro**: PITR enabled. Restore to any second within the retention window.

### Backup Restore Procedure (to staging)

```bash
# 1. Log into Supabase Dashboard → project → Backups
# 2. Select the backup timestamp to restore
# 3. Click "Restore to new project" — choose a staging project
# 4. Verify data integrity by running:
#    SELECT count(*) FROM public.shelters;
#    SELECT count(*) FROM public.applications;
#    SELECT count(*) FROM public.messages;
# 5. Run the application against the restored project to verify core flows
```

**REQUIRED:** Run a restore drill to staging before public launch and after
any major schema migration. A backup that has never been restored is not a
verified backup.

## Realtime Messages

The `messages` table is added to the `supabase_realtime` publication in
migration `20240106`. Supabase Realtime enforces RLS by default for
`postgres_changes` events when "Realtime RLS" is enabled in the project.

**Verify in Supabase Dashboard:**
1. Go to Database → Replication → `supabase_realtime`
2. Confirm `messages` is listed
3. Go to Database → Row Level Security → confirm `messages` has RLS enabled
4. Test: subscribe to `messages:application_id=<id>` from a foster account
   and confirm you cannot receive messages from a different application

## Rollback Procedure

### Single Route Hotfix

```bash
# 1. Identify the bad commit
git log --oneline -20

# 2. Create a revert commit
git revert <bad-commit-sha>

# 3. Push to trigger Vercel redeploy
git push origin main
```

### Database Migration Rollback

Supabase migrations are **not automatically reversible**. Each migration must
be planned with a rollback note.

Rollback pattern for additive migrations (columns, indexes, policies):

```sql
-- Example: undo a new column
ALTER TABLE public.reports DROP COLUMN IF EXISTS triage_notes;

-- Example: restore a dropped policy
-- (re-run the original CREATE POLICY statement)
```

For destructive migrations (DROP TABLE, DROP COLUMN), restore from backup.

## Common Failure Modes

### 1. Supabase Auth Service Unavailable

**Symptom:** API routes return 503 with "Authentication service unavailable"
**Action:**
- Check [status.supabase.com](https://status.supabase.com)
- Implement graceful degraded UI (loading spinner vs hard error)
- No rollback needed; wait for Supabase to recover

### 2. Resend Email Failure

**Symptom:** Application accept emails not sent; `[email] send failed` in logs
**Action:**
- Check Resend dashboard for API errors
- Emails are fire-and-forget — no retry mechanism yet. Users are unaffected
  operationally; inform them via in-app notification (already saved in DB)
- Add email queue as next hardening step

### 3. RPC Transition Failure

**Symptom:** 500 from accept/complete/relist routes; `rpc error` in Sentry
**Action:**
- Check Sentry for full error context
- Verify the migration `20240120` was applied: `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'accept_application'`
- Manually run the transition via Supabase Dashboard SQL editor if urgent

### 4. Storage Upload Failure

**Symptom:** 500 from `/api/upload/photo`; `upload failed` in Sentry
**Action:**
- Check Supabase Storage bandwidth / quota in dashboard
- Verify storage bucket policy applied from migration `20240124`
- Temporary fix: increase quota or remove old objects

## User Communication Template

```
Subject: Temporary issue with Fostr Find

We're aware of an issue affecting [feature]. Our team is working to resolve it.

Estimated resolution: [time or TBD]

In the meantime, [workaround if any].

We'll update you when service is restored.

— The Fostr Find Team
```

Post status updates to: [insert status page URL when configured]

## Unique Constraint Preflight Template

Before any `ALTER TABLE ... ADD CONSTRAINT UNIQUE` migration:

```sql
-- Run this FIRST. If it returns rows, deduplicate before applying migration.
-- Replace table/column names as appropriate.
SELECT column1, column2, count(*)
FROM public.table_name
GROUP BY column1, column2
HAVING count(*) > 1;
```
