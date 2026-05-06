-- Wave 1 Fix 4: Invite update integrity and schema drift correction.
--
-- Problems:
--
-- A) Foster-side UPDATE on shelter_foster_invites was limited by RLS USING
--    (visibility match), but the WITH CHECK clause allowed any column to be
--    modified — including shelter_id, email, and message — as long as the row
--    remained visible to the foster after the update. A malicious foster could
--    reassign an invite to a different shelter.
--
--    Fix: A BEFORE UPDATE trigger raises when a foster (non-shelter-owner)
--    attempts to change any of the immutable columns: shelter_id, email, or
--    message. Shelter owners bypass the check so their legitimate management
--    operations (create, cancel, etc.) are unaffected.
--
-- B) shelter_foster_notes.author_user is declared NOT NULL but its FK has
--    ON DELETE SET NULL — this is contradictory and will error when a
--    referenced auth user is deleted. Fix: drop the NOT NULL constraint so
--    the SET NULL can fire cleanly. Notes remain for audit history; the
--    author field becomes NULL when the author's account is removed.

-- ================================================================
-- A) Immutable-column trigger for foster-side invite updates
-- ================================================================

CREATE OR REPLACE FUNCTION public.shelter_foster_invites_guard_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- Shelter owners are trusted — they can change any column on their own invites.
  IF EXISTS (
    SELECT 1 FROM public.shelters
     WHERE id = OLD.shelter_id
       AND user_id = auth.uid()
  ) THEN
    RETURN NEW;
  END IF;

  -- For all other callers (foster responses): only status, responded_at, and
  -- foster_id may change. Raise on any other modification.
  IF NEW.shelter_id IS DISTINCT FROM OLD.shelter_id THEN
    RAISE EXCEPTION 'shelter_foster_invites: shelter_id is immutable'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'shelter_foster_invites: email is immutable'
      USING ERRCODE = '42501';
  END IF;
  IF NEW.message IS DISTINCT FROM OLD.message THEN
    RAISE EXCEPTION 'shelter_foster_invites: message is immutable'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shelter_foster_invites_guard_immutable
  ON public.shelter_foster_invites;

CREATE TRIGGER trg_shelter_foster_invites_guard_immutable
  BEFORE UPDATE ON public.shelter_foster_invites
  FOR EACH ROW
  EXECUTE FUNCTION public.shelter_foster_invites_guard_immutable();

-- ================================================================
-- B) Fix NOT NULL + ON DELETE SET NULL contradiction on author_user
-- ================================================================

-- Make author_user nullable so the FK SET NULL can work when the staff
-- member's auth.users row is deleted. Existing NOT-NULL rows are unaffected;
-- future deletions of the author will null out the column rather than failing.
ALTER TABLE public.shelter_foster_notes
  ALTER COLUMN author_user DROP NOT NULL;
