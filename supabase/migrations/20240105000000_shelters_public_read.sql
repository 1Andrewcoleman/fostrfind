-- RLS gaps discovered during foster-side preview testing.
--
-- 1) Shelters
--    The initial schema only had `shelters: owner can manage own row`
--    (auth.uid() = user_id), so fosters could not read shelter information
--    via nested joins (applications with `shelter:shelters(*)` returned
--    null shelter rows, crashing the foster dashboard). Shelter profiles
--    are public-facing by design — names and logos appear on foster browse
--    cards, and Phase 1 Step 16 introduces a public `/shelter/[slug]`
--    profile page — so public read is the correct policy, not a security
--    relaxation.

CREATE POLICY "shelters: anyone can read"
  ON public.shelters
  FOR SELECT
  USING (true);

-- 2) Dogs
--    The initial schema only let fosters read dogs with `status = 'available'`
--    (plus the shelter owner's own dogs). Once a dog is accepted → pending
--    or completed → placed, the foster who applied to it can no longer
--    read the row, so foster dashboard / applications / history / message
--    threads all silently render with "Unknown dog" or broken joins.
--
--    Fix: let fosters read any dog they have an application on, regardless
--    of the dog's current status. Uses the existing SECURITY DEFINER helper
--    `get_my_foster_ids()` (migration 20240102) to avoid RLS recursion.

CREATE POLICY "dogs: fosters can read dogs they applied to"
  ON public.dogs
  FOR SELECT
  USING (
    id IN (
      SELECT dog_id FROM public.applications
      WHERE foster_id IN (SELECT public.get_my_foster_ids())
    )
  );
