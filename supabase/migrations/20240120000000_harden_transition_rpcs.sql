-- Wave 1 Fix 1: Harden lifecycle transition RPCs.
--
-- Problem: accept_application, complete_application, and relist_dog are
-- SECURITY DEFINER and callable by any authenticated JWT via the Supabase
-- REST RPC endpoint. Their bodies did not verify auth.uid() ownership, so any
-- authenticated user who knew an application/dog UUID could mutate lifecycle
-- state without going through the Next.js API layer.
--
-- Fix: REVOKE PUBLIC execute, add auth.uid() shelter-ownership check and
-- valid-state assertions inside each function. On authorization failure the
-- function raises a permission-denied exception so the caller gets a clear
-- error rather than a silent no-op.
--
-- The Next.js API routes continue to work because they call these functions as
-- the shelter's authenticated Supabase client and already verify ownership
-- before calling the RPC. The in-function checks are defense-in-depth that
-- also close the direct-RPC attack surface.
--
-- Note: REVOKE FROM PUBLIC is idempotent even if PUBLIC never had explicit
-- EXECUTE (it removes the default inherited grant).

-- Revoke default PUBLIC access from all three functions.
REVOKE EXECUTE ON FUNCTION public.accept_application(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_application(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.relist_dog(uuid) FROM PUBLIC;

-- ============================================================
-- accept_application(app_id)
-- Transition: application submitted|reviewing -> accepted
--             dog available|pending           -> pending
-- Authorization: caller must own the shelter on the application
-- ============================================================

CREATE OR REPLACE FUNCTION public.accept_application(app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_dog_count integer;
BEGIN
  -- Update application only when caller owns the shelter and status allows it.
  -- The inner CTE returns the dog_id if the update was authorized and executed.
  -- We then update the dog and count affected rows.
  WITH authorized_app AS (
    UPDATE public.applications a
       SET status     = 'accepted',
           updated_at = now()
      FROM public.shelters s
     WHERE a.id        = app_id
       AND a.shelter_id = s.id
       AND s.user_id   = auth.uid()
       AND a.status   IN ('submitted', 'reviewing')
     RETURNING a.dog_id
  ),
  updated_dog AS (
    UPDATE public.dogs d
       SET status     = 'pending',
           updated_at = now()
      FROM authorized_app aa
     WHERE d.id      = aa.dog_id
       AND d.status IN ('available', 'pending')
     RETURNING d.id
  )
  SELECT count(*) INTO updated_dog_count FROM updated_dog;

  IF updated_dog_count <> 1 THEN
    RAISE EXCEPTION 'accept_application: not authorized or invalid transition for application %', app_id
      USING ERRCODE = '42501';
  END IF;
END;
$$;

-- ============================================================
-- complete_application(app_id)
-- Transition: application accepted -> completed
--             dog pending           -> placed
-- Authorization: caller must own the shelter on the application
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_application(app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_dog_count integer;
BEGIN
  WITH authorized_app AS (
    UPDATE public.applications a
       SET status     = 'completed',
           updated_at = now()
      FROM public.shelters s
     WHERE a.id        = app_id
       AND a.shelter_id = s.id
       AND s.user_id   = auth.uid()
       AND a.status    = 'accepted'
     RETURNING a.dog_id
  ),
  updated_dog AS (
    UPDATE public.dogs d
       SET status     = 'placed',
           updated_at = now()
      FROM authorized_app aa
     WHERE d.id     = aa.dog_id
       AND d.status = 'pending'
     RETURNING d.id
  )
  SELECT count(*) INTO updated_dog_count FROM updated_dog;

  IF updated_dog_count <> 1 THEN
    RAISE EXCEPTION 'complete_application: not authorized or invalid transition for application %', app_id
      USING ERRCODE = '42501';
  END IF;
END;
$$;

-- ============================================================
-- relist_dog(p_dog_id)
-- Transition: dog pending        -> available
--             accepted app (if any) -> declined
-- Authorization: caller must own the shelter that owns the dog
-- ============================================================

CREATE OR REPLACE FUNCTION public.relist_dog(p_dog_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_dog_count integer;
BEGIN
  WITH authorized_dog AS (
    UPDATE public.dogs d
       SET status     = 'available',
           updated_at = now()
      FROM public.shelters s
     WHERE d.id         = p_dog_id
       AND d.shelter_id  = s.id
       AND s.user_id    = auth.uid()
       AND d.status     = 'pending'
     RETURNING d.id
  ),
  declined_apps AS (
    UPDATE public.applications a
       SET status     = 'declined',
           updated_at = now()
      FROM authorized_dog ad
     WHERE a.dog_id  = ad.id
       AND a.status  = 'accepted'
     RETURNING a.id
  )
  SELECT count(*) INTO updated_dog_count FROM authorized_dog;

  IF updated_dog_count <> 1 THEN
    RAISE EXCEPTION 'relist_dog: not authorized or invalid transition for dog %', p_dog_id
      USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Re-grant to authenticated only (no PUBLIC).
GRANT EXECUTE ON FUNCTION public.accept_application(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.relist_dog(uuid)           TO authenticated;
