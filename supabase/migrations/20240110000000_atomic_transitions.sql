-- Phase 3 Step 24 — Atomic status transitions.
--
-- The accept, complete, and re-list flows each mutate two rows that must
-- stay in lockstep: the application status AND the dog status (or, in the
-- re-list case, the dog status AND any accepted application for that dog).
-- Before this migration the API routes ran those as two sequential
-- UPDATEs. If the second query failed for any reason (transient network,
-- RLS surprise, timeout) the first had already committed, leaving the
-- database in an inconsistent state — e.g. application `accepted` but dog
-- still `available`.
--
-- Each function below runs both UPDATEs inside a single implicit
-- transaction (PL/pgSQL function body), so either both succeed or neither
-- does. SECURITY DEFINER means the function runs with the function
-- owner's (postgres) permissions, bypassing RLS. This is safe because
-- the API routes still perform the authentication, ownership, and
-- idempotency checks before calling the function — the function is a
-- data-layer atomicity primitive, not an authorization boundary.
--
-- `search_path = public` is pinned to prevent search_path hijacks per
-- the same convention used in 20240102000000_fix_rls_recursion.sql.

-- ============================================================
-- accept_application(app_id) — apps: submitted|reviewing -> accepted
--                              dogs: available|pending   -> pending
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_application(app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dog_id uuid;
BEGIN
  SELECT dog_id INTO v_dog_id FROM public.applications WHERE id = app_id;
  IF v_dog_id IS NULL THEN
    RAISE EXCEPTION 'Application % not found', app_id;
  END IF;

  UPDATE public.applications
     SET status = 'accepted', updated_at = now()
   WHERE id = app_id;

  UPDATE public.dogs
     SET status = 'pending', updated_at = now()
   WHERE id = v_dog_id;
END;
$$;

-- ============================================================
-- complete_application(app_id) — apps: accepted -> completed
--                                dogs: pending  -> placed
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_application(app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dog_id uuid;
BEGIN
  SELECT dog_id INTO v_dog_id FROM public.applications WHERE id = app_id;
  IF v_dog_id IS NULL THEN
    RAISE EXCEPTION 'Application % not found', app_id;
  END IF;

  UPDATE public.applications
     SET status = 'completed', updated_at = now()
   WHERE id = app_id;

  UPDATE public.dogs
     SET status = 'placed', updated_at = now()
   WHERE id = v_dog_id;
END;
$$;

-- ============================================================
-- relist_dog(dog_id) — dogs: pending -> available
--                     apps: (accepted for this dog) -> declined
--
-- Scope-expansion over the original Step 24 scope (which covered only
-- accept + complete). The re-list route added in Phase 1 Step 5 suffers
-- the same dual-update fragility: it declines the lingering accepted
-- application first and then sets the dog back to available. Bundling
-- them into one function closes the same atomicity gap.
-- ============================================================

CREATE OR REPLACE FUNCTION public.relist_dog(dog_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.applications
     SET status = 'declined', updated_at = now()
   WHERE dog_id = relist_dog.dog_id
     AND status = 'accepted';

  UPDATE public.dogs
     SET status = 'available', updated_at = now()
   WHERE id = relist_dog.dog_id;
END;
$$;

-- ============================================================
-- GRANTS — the API routes call these via supabase-js with the caller's
-- authenticated role. `authenticated` gets EXECUTE so RPC works; the
-- function body's SECURITY DEFINER escalates to postgres for the actual
-- UPDATE statements.
-- ============================================================

GRANT EXECUTE ON FUNCTION public.accept_application(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.relist_dog(uuid)           TO authenticated;
