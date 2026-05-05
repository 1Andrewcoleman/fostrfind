-- Phase 7 hotfix — break dogs <-> applications RLS recursion.
--
-- Bug:
--   Migration 20240105 added `dogs: fosters can read dogs they applied to`
--   which references `applications` directly:
--     id IN (SELECT dog_id FROM applications WHERE foster_id IN (...))
--   Migration 20240111 then split the foster `applications` policies and
--   added a per-INSERT policy with a WITH CHECK that references `dogs`:
--     dog_id IN (SELECT id FROM dogs WHERE status = 'available')
--   Postgres detects the resulting cycle (`applications` -> `dogs` ->
--   `applications`) at plan time and aborts every foster INSERT with
--   `infinite recursion detected in policy for relation "applications"`.
--
-- Fix:
--   Mirror the `get_my_foster_ids()` / `get_my_shelter_ids()` pattern
--   from migration 20240102 — introduce a SECURITY DEFINER helper that
--   reads `applications` without triggering RLS, then rewrite the
--   recursive `dogs` policy to call the helper instead of querying
--   `applications` directly. Same row visibility, no cycle.
--
-- This migration is idempotent; safe to re-run.

CREATE OR REPLACE FUNCTION public.get_my_applied_dog_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT a.dog_id
    FROM public.applications a
   WHERE a.foster_id IN (SELECT public.get_my_foster_ids());
$$;

DROP POLICY IF EXISTS "dogs: fosters can read dogs they applied to" ON public.dogs;

CREATE POLICY "dogs: fosters can read dogs they applied to"
  ON public.dogs
  FOR SELECT
  USING (id IN (SELECT public.get_my_applied_dog_ids()));
