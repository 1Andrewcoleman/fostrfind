-- Wave 2 Fix 7: Transactional account deletion cleanup RPC.
--
-- Problem: /api/account/delete ran several service-role UPDATE calls in
-- sequence without checking individual errors. A transient DB failure after
-- partial cleanup could leave PII in some tables while the auth user was
-- still deleted (or vice versa). The route must prove every cleanup step
-- succeeded before deleting the auth user.
--
-- Fix: Encapsulate all pre-delete anonymization and application-decline
-- work in a single SECURITY DEFINER plpgsql function. Because plpgsql
-- wraps each function call in a transaction (when called as a standalone
-- statement), any error inside will roll back all changes automatically.
-- The Next.js route calls this function via service role, checks the result,
-- and only proceeds to auth.admin.deleteUser on success.
--
-- Called with the service-role client (not the anon client), so auth.uid()
-- inside the function returns the service role and CANNOT be used for
-- authorization — the user_id is passed as a parameter explicitly and
-- validated by the route layer.

CREATE OR REPLACE FUNCTION public.prepare_account_deletion(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 1. Decline any active applications for shelters this user owns.
  UPDATE public.applications
     SET status     = 'declined',
         updated_at = now()
   WHERE status IN ('submitted', 'reviewing', 'accepted')
     AND shelter_id IN (SELECT id FROM public.shelters WHERE user_id = p_user_id);

  -- 2. Decline any active applications for foster_parents this user owns.
  UPDATE public.applications
     SET status     = 'declined',
         updated_at = now()
   WHERE status IN ('submitted', 'reviewing', 'accepted')
     AND foster_id IN (SELECT id FROM public.foster_parents WHERE user_id = p_user_id);

  -- 3. Anonymise shelter rows. History rows (completed applications, ratings,
  --    messages) still reference the shelter_id FK and will be preserved with
  --    "Deleted Shelter" as the display name.
  UPDATE public.shelters
     SET name      = 'Deleted Shelter',
         email     = 'deleted@fostrfind.invalid',
         phone     = null,
         location  = 'Unknown',
         bio       = null,
         website   = null,
         instagram = null,
         ein       = null,
         logo_url  = null
   WHERE user_id = p_user_id;

  -- 4. Anonymise foster_parents rows. History rows preserved with placeholder
  --    name and invalid email so joins still render sensibly.
  UPDATE public.foster_parents
     SET first_name      = 'Deleted',
         last_name       = 'User',
         email           = 'deleted@fostrfind.invalid',
         phone           = null,
         bio             = null,
         avatar_url      = null,
         other_pets_info = null,
         children_info   = null
   WHERE user_id = p_user_id;
END;
$$;

-- REVOKE from PUBLIC: this function is called only via service role from the
-- server-side deletion route. No client role should be able to invoke it.
REVOKE ALL ON FUNCTION public.prepare_account_deletion(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.prepare_account_deletion(uuid) FROM authenticated;
-- service_role retains its superuser-level execute implicitly; no explicit
-- GRANT is needed for service_role.
