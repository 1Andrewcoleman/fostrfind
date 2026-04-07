-- Fix infinite recursion in RLS policies.
--
-- The cycle: foster_parents policies query applications, whose policies
-- query foster_parents again. SECURITY DEFINER helper functions break
-- the loop by reading the identity tables without triggering RLS.

-- ============================================================
-- HELPER FUNCTIONS (bypass RLS to resolve ownership)
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_my_foster_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.foster_parents WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.get_my_shelter_ids()
RETURNS SETOF uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM public.shelters WHERE user_id = auth.uid();
$$;

-- ============================================================
-- DROP POLICIES INVOLVED IN THE CYCLE
-- ============================================================

DROP POLICY IF EXISTS "foster_parents: shelters can read applicants" ON public.foster_parents;
DROP POLICY IF EXISTS "applications: foster can manage own"          ON public.applications;
DROP POLICY IF EXISTS "applications: shelter can manage for their dogs" ON public.applications;

-- Also drop the messages policies that reference applications with
-- nested foster_parents/shelters subqueries (same recursion risk).
DROP POLICY IF EXISTS "messages: participants can read"   ON public.messages;
DROP POLICY IF EXISTS "messages: participants can insert"  ON public.messages;

-- ============================================================
-- RECREATE POLICIES USING HELPER FUNCTIONS
-- ============================================================

-- Foster parents: shelters can read profiles of fosters who applied
CREATE POLICY "foster_parents: shelters can read applicants"
  ON public.foster_parents FOR SELECT
  USING (
    id IN (
      SELECT foster_id FROM public.applications
      WHERE shelter_id IN (SELECT public.get_my_shelter_ids())
    )
  );

-- Applications: foster can manage their own applications
CREATE POLICY "applications: foster can manage own"
  ON public.applications FOR ALL
  USING (foster_id IN (SELECT public.get_my_foster_ids()));

-- Applications: shelter can manage applications for their dogs
CREATE POLICY "applications: shelter can manage for their dogs"
  ON public.applications FOR ALL
  USING (shelter_id IN (SELECT public.get_my_shelter_ids()));

-- Messages: participants (shelter or foster) can read
CREATE POLICY "messages: participants can read"
  ON public.messages FOR SELECT
  USING (
    application_id IN (
      SELECT id FROM public.applications
      WHERE shelter_id IN (SELECT public.get_my_shelter_ids())
         OR foster_id  IN (SELECT public.get_my_foster_ids())
    )
  );

-- Messages: participants can insert
CREATE POLICY "messages: participants can insert"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND application_id IN (
      SELECT id FROM public.applications
      WHERE shelter_id IN (SELECT public.get_my_shelter_ids())
         OR foster_id  IN (SELECT public.get_my_foster_ids())
    )
  );
