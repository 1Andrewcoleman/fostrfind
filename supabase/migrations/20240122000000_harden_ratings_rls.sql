-- Wave 1 Fix 3: Strengthen INSERT RLS on both ratings tables and narrow
-- SELECT on the shelter→foster ratings table.
--
-- Problems:
--
-- A) `ratings` (shelter rates foster): INSERT WITH CHECK only verified
--    shelter ownership. A shelter could insert a rating with any valid
--    application_id / foster_id / dog_id combination, including another
--    shelter's application, as long as their shelter_id matched. The
--    server route blocks this, but the DB policy did not.
--
-- B) `shelter_ratings` (foster rates shelter): INSERT WITH CHECK only
--    verified `foster_id IN (get_my_foster_ids())`. A foster could insert
--    a rating tied to another foster's application by supplying that
--    application's IDs directly. The server route blocks this, but the DB
--    policy did not.
--
-- C) `ratings` SELECT: "authenticated users can read" means any logged-in
--    user can read all ratings (shelter→foster assessments). These contain
--    score + comment and are associated with specific fosters. Narrow to
--    participants only: the shelter on the application or the foster on it.
--
-- Fix: Both INSERT policies now validate via EXISTS that the supplied
-- application_id actually matches a completed placement and that all FK
-- columns (foster_id, shelter_id, dog_id) match the application row. The
-- `ratings` SELECT policy is narrowed to participants.

-- ================================================================
-- ratings (shelter → foster)
-- ================================================================

-- Narrow SELECT to participants only.
DROP POLICY IF EXISTS "ratings: authenticated users can read" ON public.ratings;
CREATE POLICY "ratings: participants can read"
  ON public.ratings FOR SELECT
  USING (
    shelter_id IN (SELECT public.get_my_shelter_ids())
    OR foster_id IN (SELECT public.get_my_foster_ids())
  );

-- Strengthen INSERT: all FK columns must match a real completed application
-- that belongs to the calling shelter.
DROP POLICY IF EXISTS "ratings: shelter can insert for their placements" ON public.ratings;
CREATE POLICY "ratings: shelter can insert for their placements"
  ON public.ratings FOR INSERT
  WITH CHECK (
    shelter_id IN (SELECT public.get_my_shelter_ids())
    AND EXISTS (
      SELECT 1
        FROM public.applications a
       WHERE a.id          = ratings.application_id
         AND a.shelter_id  = ratings.shelter_id
         AND a.foster_id   = ratings.foster_id
         AND a.dog_id      = ratings.dog_id
         AND a.status      = 'completed'
    )
  );

-- ================================================================
-- shelter_ratings (foster → shelter)
-- ================================================================

-- Strengthen INSERT: all FK columns must match a real completed application
-- that belongs to the calling foster.
DROP POLICY IF EXISTS "shelter_ratings: foster can insert for their placements" ON public.shelter_ratings;
CREATE POLICY "shelter_ratings: foster can insert for their placements"
  ON public.shelter_ratings FOR INSERT
  WITH CHECK (
    foster_id IN (SELECT public.get_my_foster_ids())
    AND EXISTS (
      SELECT 1
        FROM public.applications a
       WHERE a.id          = shelter_ratings.application_id
         AND a.foster_id   = shelter_ratings.foster_id
         AND a.shelter_id  = shelter_ratings.shelter_id
         AND a.dog_id      = shelter_ratings.dog_id
         AND a.status      = 'completed'
    )
  );

-- shelter_ratings SELECT remains public (USING (true)) — aggregate shelter
-- scores are displayed on the public /shelters/[slug] profile page.
-- Keeping this broad by design; individual comment privacy is acceptable
-- given the product's public shelter profile feature.
