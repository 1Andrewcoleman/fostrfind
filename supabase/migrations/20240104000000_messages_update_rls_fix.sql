-- Security fix: tighten the UPDATE policy on public.messages.
--
-- Migration 20240103000000 introduced a policy whose USING and WITH CHECK
-- clauses only validated application_id ownership. This allowed any
-- application participant to UPDATE every column on messages in their
-- threads via the browser Supabase client, enabling:
--
--   • Tampering with message bodies sent by the other party
--   • Rewriting sender_id / sender_role to impersonate the other party
--   • Toggling already-read messages back to unread
--
-- This migration applies three layered fixes:
--
-- 1. Column-level privilege
--    REVOKE the blanket UPDATE grant and re-GRANT only the `read` column.
--    PostgreSQL rejects UPDATE statements that reference any other column
--    before RLS evaluation, regardless of what the RLS policy allows.
--
-- 2. USING clause: sender_id != auth.uid()
--    A participant may only update messages they *received* (sent by the
--    other party). There is no legitimate reason to update the read flag on
--    your own sent messages.
--
-- 3. WITH CHECK: read = true
--    Enforces unread → read as the only permitted transition. Prevents a
--    participant from toggling another party's messages back to unread.

DROP POLICY IF EXISTS "messages: participants can mark as read" ON public.messages;

-- ── Column-level privilege ──────────────────────────────────────────────────
-- Remove the blanket UPDATE and grant back only the `read` column.
-- This affects the `authenticated` role (all logged-in users).
-- The `service_role` and `postgres` superuser are unaffected and retain full
-- access for administrative operations.
REVOKE UPDATE ON public.messages FROM authenticated;
GRANT  UPDATE (read) ON public.messages TO authenticated;

-- ── Tightened RLS policy ────────────────────────────────────────────────────
CREATE POLICY "messages: participants can mark as read"
  ON public.messages FOR UPDATE
  USING (
    -- Only messages sent by the other party may be marked as read.
    sender_id != auth.uid()
    AND application_id IN (
      SELECT id FROM public.applications
      WHERE shelter_id IN (SELECT public.get_my_shelter_ids())
         OR foster_id  IN (SELECT public.get_my_foster_ids())
    )
  )
  WITH CHECK (
    -- The only valid new state is read = true (unread → read).
    -- Combined with the column-level GRANT above, this means the UPDATE
    -- statement must be exactly: SET read = true WHERE ...
    read = true
    AND application_id IN (
      SELECT id FROM public.applications
      WHERE shelter_id IN (SELECT public.get_my_shelter_ids())
         OR foster_id  IN (SELECT public.get_my_foster_ids())
    )
  );
