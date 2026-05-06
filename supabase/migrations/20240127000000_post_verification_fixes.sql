-- Post-verification fixes applied manually on 2026-05-05.
--
-- Two issues were discovered during database verification after the main
-- hardening migrations were applied:
--
-- 1. REVOKE SELECT (ein, user_id) FROM anon in migration 20240124 had no
--    effect because Supabase's bootstrap grants give anon a table-level
--    SELECT, and PostgreSQL does not support revoking individual columns
--    from a table-level grant. The fix is to revoke the table-level grant
--    and re-grant only the public-safe columns.
--
-- 2. REVOKE ALL ON FUNCTION prepare_account_deletion FROM PUBLIC (migration
--    20240125) revoked from the PUBLIC pseudo-role, but Supabase's bootstrap
--    grants had already given anon explicit EXECUTE, which persisted.

-- ================================================================
-- Fix 1: Shelter EIN — revoke table-level anon SELECT, re-grant
--         only columns that are safe for unauthenticated access.
-- ================================================================

REVOKE SELECT ON public.shelters FROM anon;

GRANT SELECT (
  id,
  created_at,
  name,
  slug,
  email,
  phone,
  location,
  latitude,
  longitude,
  logo_url,
  bio,
  website,
  instagram,
  is_verified
) ON public.shelters TO anon;

-- ================================================================
-- Fix 2: prepare_account_deletion — revoke from anon and
--         authenticated. Only service_role calls this function.
-- ================================================================

REVOKE EXECUTE ON FUNCTION public.prepare_account_deletion(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.prepare_account_deletion(uuid) FROM authenticated;
