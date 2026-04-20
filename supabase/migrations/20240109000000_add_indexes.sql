-- Phase 3 Step 23 — Database indexes on frequently queried columns.
--
-- Every index below is additive and idempotent via IF NOT EXISTS, so this
-- migration is safe to re-run.
--
-- Covers the hot paths identified during Phase 1 + Phase 2:
--   * browse                 -> dogs(status), dogs(shelter_id)
--   * shelter dogs list       -> dogs(shelter_id)
--   * applications tabs       -> applications(status), applications(foster_id|shelter_id|dog_id)
--   * thread load + unread    -> messages(application_id, read)
--   * auth role resolution    -> shelters(user_id), foster_parents(user_id)
--
-- Note on shelters(slug): the column is already declared UNIQUE in the
-- initial schema (see 20240101000000_initial_schema.sql), which implicitly
-- creates a unique index. No separate slug index is created here because
-- it would be a redundant duplicate.

-- ============================================================
-- DOGS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_dogs_status     ON public.dogs(status);
CREATE INDEX IF NOT EXISTS idx_dogs_shelter_id ON public.dogs(shelter_id);

-- ============================================================
-- APPLICATIONS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_applications_foster_id  ON public.applications(foster_id);
CREATE INDEX IF NOT EXISTS idx_applications_shelter_id ON public.applications(shelter_id);
CREATE INDEX IF NOT EXISTS idx_applications_dog_id     ON public.applications(dog_id);
CREATE INDEX IF NOT EXISTS idx_applications_status     ON public.applications(status);

-- ============================================================
-- MESSAGES
-- ============================================================

-- Composite index for the common "count/select unread rows for a thread"
-- pattern used by the messages layout unread badge + thread mark-as-read.
CREATE INDEX IF NOT EXISTS idx_messages_application_id_read
  ON public.messages(application_id, read);

-- ============================================================
-- AUTH ROLE LOOKUPS
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_shelters_user_id        ON public.shelters(user_id);
CREATE INDEX IF NOT EXISTS idx_foster_parents_user_id  ON public.foster_parents(user_id);
