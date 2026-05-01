-- Phase 7 Step 46 — Structured application form columns.
--
-- Replaces the single free-text `note` apply flow with a structured
-- application capturing availability window, why-this-dog reasoning,
-- emergency contact, and a responsibilities acknowledgment. The
-- existing `note` column is preserved — the new UI relabels it as
-- "Anything else you need us to know?" and treats it as optional.
--
-- All columns are added IF NOT EXISTS so this migration is idempotent
-- across local and production environments. `responsibilities_acknowledged`
-- defaults to false so legacy rows remain valid; the API enforces it
-- as `true` on insert via Zod.

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS available_from                DATE,
  ADD COLUMN IF NOT EXISTS available_until               DATE,
  ADD COLUMN IF NOT EXISTS why_this_dog                  TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name        TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone       TEXT,
  ADD COLUMN IF NOT EXISTS responsibilities_acknowledged BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.applications.available_from
  IS 'Date the foster is available to start caring for the dog (required on submission)';
COMMENT ON COLUMN public.applications.available_until
  IS 'Date the foster expects the placement to end; NULL means open-ended';
COMMENT ON COLUMN public.applications.why_this_dog
  IS 'Foster explanation of why they want to foster this specific dog';
COMMENT ON COLUMN public.applications.emergency_contact_name
  IS 'Full name of the foster''s emergency contact';
COMMENT ON COLUMN public.applications.emergency_contact_phone
  IS 'Phone number of the foster''s emergency contact';
COMMENT ON COLUMN public.applications.responsibilities_acknowledged
  IS 'True when the foster has checked the responsibility acknowledgment checkbox';
