-- Fix infinite RLS recursion introduced in 20240131000000_fix_roster_member_visibility.sql
--
-- Root cause: the policy added in migration 20240131 queries shelter_fosters directly.
-- shelter_fosters has a "foster read own" policy that subqueries foster_parents (with RLS).
-- That re-enters the new foster_parents policy, which queries shelter_fosters again → loop.
-- PostgreSQL detects this and throws "infinite recursion detected in policy for relation".
--
-- Fix: introduce a SECURITY DEFINER helper that reads shelter_fosters bypassing its RLS
-- policies, then use it in the foster_parents policy instead of a raw subquery.

-- Drop the problematic policy
DROP POLICY IF EXISTS "foster_parents: shelters can read roster members" ON public.foster_parents;

-- SECURITY DEFINER: reads shelter_fosters without triggering its RLS policies.
-- Uses get_my_shelter_ids() (also SECURITY DEFINER) to resolve the caller's shelters.
-- Neither function re-enters foster_parents with RLS, so no cycle is possible.
CREATE OR REPLACE FUNCTION public.get_roster_foster_ids_for_my_shelters()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT sf.foster_id
    FROM public.shelter_fosters sf
   WHERE sf.shelter_id IN (SELECT public.get_my_shelter_ids())
$$;

REVOKE ALL ON FUNCTION public.get_roster_foster_ids_for_my_shelters() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_roster_foster_ids_for_my_shelters() TO authenticated;

-- Recreate the policy using the SECURITY DEFINER helper — no RLS recursion possible.
CREATE POLICY "foster_parents: shelters can read roster members"
  ON public.foster_parents FOR SELECT
  USING (
    id IN (SELECT public.get_roster_foster_ids_for_my_shelters())
  );
