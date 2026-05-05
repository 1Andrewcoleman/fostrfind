-- Phase 7 hotfix — Public-readable dog rows for ALL listed statuses.
--
-- Background:
--   The original `dogs: fosters can read available` policy (initial schema)
--   is permissive to anonymous viewers because it has no auth predicate,
--   but it filters on `status = 'available'`. That means the public
--   "/foster/dog/[id]" teaser page returns 404 the moment a dog moves to
--   `pending`, `placed`, or `adopted` — which breaks every share link
--   the moment the shelter accepts an application.
--
--   `DOG_STATUSES` (src/lib/constants.ts) is exactly:
--     ['available', 'pending', 'placed', 'adopted']
--   None of those are draft / internal — every status is a marketing-safe
--   state we already surface elsewhere (status badges on browse cards,
--   shelter profile pages, foster history, etc.). Widening the policy to
--   the explicit list keeps least-privilege for any future draft status
--   that might be introduced (which would default to NOT being readable).
--
--   Only SELECT is widened. INSERT / UPDATE / DELETE remain locked to
--   the shelter-owner policy.

DROP POLICY IF EXISTS "dogs: fosters can read available" ON public.dogs;

CREATE POLICY "dogs: anyone can read listed statuses"
  ON public.dogs
  FOR SELECT
  USING (status IN ('available', 'pending', 'placed', 'adopted'));
