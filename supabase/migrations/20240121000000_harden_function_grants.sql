-- Wave 1 Fix 2: Explicitly revoke PUBLIC execute from all SECURITY DEFINER
-- helper functions.
--
-- Problem: PostgreSQL grants EXECUTE to PUBLIC by default when a function is
-- created (unless explicitly revoked). Helper functions like
-- get_my_foster_ids() bypass RLS as SECURITY DEFINER — while they only return
-- the caller's own data (scoped by auth.uid()), having them callable by the
-- anonymous role widens the callable surface unnecessarily.
--
-- Fix: REVOKE from PUBLIC, then GRANT to the minimum required role for each
-- function. All helpers here are session-aware (use auth.uid()) so anon
-- callers would get empty results anyway, but explicit revoke is defense in
-- depth and prevents any future logic drift.
--
-- distance_miles: pure math function with no auth context; restrict to
-- authenticated because it is only used in authenticated browse queries.
-- If a future public browse flow needs it, add the grant back.

-- ---- Ownership helpers (migration 20240102) --------------------------------
REVOKE ALL ON FUNCTION public.get_my_foster_ids()  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_my_shelter_ids() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_foster_ids()  TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_my_shelter_ids() TO authenticated;

-- ---- Dogs-applied helper (migration 20240119) ------------------------------
REVOKE ALL ON FUNCTION public.get_my_applied_dog_ids() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_my_applied_dog_ids() TO authenticated;

-- ---- Save-count aggregate (migration 20240115) -----------------------------
-- Already granted to authenticated in its original migration, but PUBLIC was
-- never explicitly revoked.
REVOKE ALL ON FUNCTION public.get_save_counts_for_my_dogs() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_save_counts_for_my_dogs() TO authenticated;

-- ---- Distance helper (migration 20240108) ----------------------------------
-- Invoker-security math function; restrict to authenticated.
REVOKE ALL ON FUNCTION public.distance_miles(double precision, double precision, double precision, double precision) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.distance_miles(double precision, double precision, double precision, double precision) TO authenticated;

-- ---- Updated-at trigger helper (initial schema) ----------------------------
-- handle_updated_at is called only by triggers (which run as the table owner),
-- not directly by clients. Revoke external execution.
REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC;
