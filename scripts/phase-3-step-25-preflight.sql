-- Phase 3 Step 25 — Pre-flight data audit.
--
-- Paste this block into the Supabase SQL editor BEFORE applying
-- supabase/migrations/20240111000000_unique_constraints.sql. Each query
-- below surfaces data that would cause the upcoming UNIQUE constraints
-- or the new INSERT RLS policy to fail or to rejected historical rows.
--
-- Expected healthy result for ALL five queries: zero rows.
--
-- If any query returns rows, STOP and resolve the duplicates (or the
-- user-id collisions) before applying the migration. A constraint
-- addition against live duplicates fails the whole ALTER TABLE and
-- leaves the migration in an inconsistent partial state.

-- 1) Duplicate applications (same foster applied to same dog more than once).
--    Cause: the Phase 1 dog-detail page has a client-side duplicate guard
--    that races. Phase 3 Step 25 adds a DB UNIQUE constraint that closes
--    the race.
SELECT dog_id, foster_id, COUNT(*) AS n
FROM public.applications
GROUP BY dog_id, foster_id
HAVING COUNT(*) > 1
ORDER BY n DESC;

-- 2) Duplicate foster ratings (more than one rating for a single application).
--    Cause: API-level idempotency is advisory; the DB never enforced it.
SELECT application_id, COUNT(*) AS n
FROM public.ratings
GROUP BY application_id
HAVING COUNT(*) > 1
ORDER BY n DESC;

-- 3) Duplicate foster_parents.user_id (multiple profile rows for one auth user).
--    Cause: Step 10 found that foster_parents had no UNIQUE(user_id) constraint,
--    which caused .upsert({..., onConflict: 'user_id'}) to silently fail and
--    (theoretically) allowed duplicate inserts in race conditions.
SELECT user_id, COUNT(*) AS n
FROM public.foster_parents
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY n DESC;

-- 4) Duplicate shelters.user_id (same auth user owns multiple shelter rows).
SELECT user_id, COUNT(*) AS n
FROM public.shelters
GROUP BY user_id
HAVING COUNT(*) > 1
ORDER BY n DESC;

-- 5) Applications that are currently 'submitted' or 'reviewing' but whose
--    dog is no longer 'available'. NOT a blocker for the migration (the
--    new RLS only gates future INSERTs), but a useful lifecycle-health
--    signal: these rows exist because a second foster applied while the
--    dog's status was still 'available' and the shelter has since
--    accepted someone else. With the new RLS they can't happen in the
--    future.
SELECT a.id, a.status AS app_status, d.status AS dog_status
FROM public.applications a
JOIN public.dogs d ON d.id = a.dog_id
WHERE d.status <> 'available'
  AND a.status IN ('submitted', 'reviewing');
