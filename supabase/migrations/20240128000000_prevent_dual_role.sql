-- Phase 7 hardening — prevent a single user from holding both
-- a shelter and a foster_parents row.
--
-- Enforcement is two-layer:
--   1. API layer: onboarding routes check the other table before INSERT.
--   2. DB layer (this migration): BEFORE INSERT triggers on both tables
--      raise an exception if a cross-role row already exists, closing
--      any race-condition window between the API check and insert.

DROP FUNCTION IF EXISTS public.prevent_dual_role() CASCADE;

CREATE OR REPLACE FUNCTION public.prevent_dual_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'shelters' THEN
    IF EXISTS (SELECT 1 FROM public.foster_parents WHERE user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'User already has a foster profile; cannot also create a shelter'
        USING ERRCODE = '23505';
    END IF;
  ELSIF TG_TABLE_NAME = 'foster_parents' THEN
    IF EXISTS (SELECT 1 FROM public.shelters WHERE user_id = NEW.user_id) THEN
      RAISE EXCEPTION 'User already has a shelter profile; cannot also create a foster profile'
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS shelters_prevent_dual_role ON public.shelters;
CREATE TRIGGER shelters_prevent_dual_role
  BEFORE INSERT ON public.shelters
  FOR EACH ROW EXECUTE FUNCTION public.prevent_dual_role();

DROP TRIGGER IF EXISTS foster_parents_prevent_dual_role ON public.foster_parents;
CREATE TRIGGER foster_parents_prevent_dual_role
  BEFORE INSERT ON public.foster_parents
  FOR EACH ROW EXECUTE FUNCTION public.prevent_dual_role();
