-- Fix: shelters cannot read foster_parents profiles for invite-based roster members.
--
-- The existing "foster_parents: shelters can read applicants" policy only
-- covers fosters who have submitted applications to that shelter. When a
-- foster is added via an invite (and has never applied), the shelter's user
-- cannot read their foster_parents row, so the PostgREST join in the fosters
-- roster page returns null — showing "Unknown foster" in the UI — and the
-- detail page falls through to a 404.
--
-- Fix: add a complementary SELECT policy that allows shelters to read the
-- foster_parents profile for any foster currently on their shelter_fosters
-- roster, regardless of whether that foster ever submitted an application.

CREATE POLICY "foster_parents: shelters can read roster members"
  ON public.foster_parents FOR SELECT
  USING (
    id IN (
      SELECT foster_id
        FROM public.shelter_fosters
       WHERE shelter_id IN (SELECT public.get_my_shelter_ids())
    )
  );
