-- Fix F-01: ratings table FK constraints are missing ON DELETE CASCADE.
--
-- Problem: The cascade chain auth.users → foster_parents → applications →
-- ratings fails with a FK violation because all four FK columns in `ratings`
-- were created without ON DELETE CASCADE. This prevents account deletion for
-- any foster or shelter who has at least one completed-placement rating:
--
--   auth.admin.deleteUser(user_id)
--     → CASCADE: delete foster_parents WHERE user_id = X
--     → CASCADE: delete applications WHERE foster_id = foster_parents.id
--     → FK VIOLATION: ratings.application_id references the to-be-deleted
--       application rows but has no CASCADE directive
--
-- The same violation blocks dog deletion when a dog has ratings.
--
-- Fix: Drop and re-add the four FK constraints with ON DELETE CASCADE,
-- matching the pattern already used by the `shelter_ratings` table
-- (migration 20240107), where all four columns correctly use CASCADE.
--
-- Note: The `ratings_application_unique` constraint added by migration
-- 20240111 is a separate named constraint and is unaffected by this change.

ALTER TABLE public.ratings
  DROP CONSTRAINT IF EXISTS ratings_application_id_fkey,
  DROP CONSTRAINT IF EXISTS ratings_shelter_id_fkey,
  DROP CONSTRAINT IF EXISTS ratings_foster_id_fkey,
  DROP CONSTRAINT IF EXISTS ratings_dog_id_fkey,
  ADD CONSTRAINT ratings_application_id_fkey
    FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE CASCADE,
  ADD CONSTRAINT ratings_shelter_id_fkey
    FOREIGN KEY (shelter_id) REFERENCES public.shelters(id) ON DELETE CASCADE,
  ADD CONSTRAINT ratings_foster_id_fkey
    FOREIGN KEY (foster_id) REFERENCES public.foster_parents(id) ON DELETE CASCADE,
  ADD CONSTRAINT ratings_dog_id_fkey
    FOREIGN KEY (dog_id) REFERENCES public.dogs(id) ON DELETE CASCADE;
