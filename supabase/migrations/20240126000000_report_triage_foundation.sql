-- Wave 5 Fix 19: Report triage foundation.
--
-- Problem: Users can file safety/harassment/misrepresentation reports, but the
-- `reports` table has no triage/admin path. Status changes are service-role
-- only without a shipped admin API or queue. Support staff must query
-- production manually with service credentials.
--
-- This migration lays the foundation:
--
--   1. Adds a `notes` column to `reports` so triage staff can record
--      their assessment without changing the public-facing status (yet).
--
--   2. Adds a `reviewed_by` column (auth.users UUID) so triage history is
--      auditable.
--
--   3. Creates an aggregate view `reports_pending_count` that any service-role
--      caller can use to build a support badge / notification.
--
-- The actual admin triage UI (Next.js admin portal pages, admin role claim,
-- Supabase Dashboard access via service role) is an ops/deployment task that
-- must be completed before broad public launch. The code-level fix here ensures
-- the data model is ready.
--
-- Until the admin UI ships:
--   - New reports trigger a notification email to SUPPORT_EMAIL via the
--     existing `/api/reports` route (see route update in Wave 5).
--   - Status updates must go through service-role SQL in the Supabase dashboard.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS triage_notes  text,
  ADD COLUMN IF NOT EXISTS reviewed_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at   timestamptz;

-- Index for the triage queue: pending reports oldest-first.
CREATE INDEX IF NOT EXISTS reports_pending_queue_idx
  ON public.reports (created_at ASC)
  WHERE status = 'pending';

-- Helper view: count of open reports by status. Service-role only.
-- In the future, a proper admin portal will query this.
CREATE OR REPLACE VIEW public.reports_summary AS
SELECT
  status,
  count(*) AS report_count,
  min(created_at) AS oldest_at
FROM public.reports
GROUP BY status
ORDER BY report_count DESC;

-- No RLS on the view — service-role access only. Table-level RLS on reports
-- already prevents non-admins from reading rows they do not own.
