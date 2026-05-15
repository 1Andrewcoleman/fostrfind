-- Fix: shelter_foster_notes.author_user was declared NOT NULL with ON DELETE SET NULL,
-- which causes auth.admin.deleteUser to fail with "Database error deleting user"
-- because Postgres attempts to SET NULL but the NOT NULL constraint rejects it.
-- Drop the NOT NULL constraint so the ON DELETE SET NULL cascade works correctly.

ALTER TABLE public.shelter_foster_notes
  ALTER COLUMN author_user DROP NOT NULL;
