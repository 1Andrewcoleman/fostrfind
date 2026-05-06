-- Wave 1 Fix 5: Restrict sensitive columns from anonymous access and tighten
-- storage upload path enforcement.
--
-- Problems:
--
-- A) The `shelters: anyone can read` policy (added in migration 20240105)
--    exposes the full shelters row including `ein` (IRS EIN, a tax identifier)
--    and `user_id` (the shelter owner's auth UUID) to anonymous API requests.
--    The app's public pages already request narrow projections, but any party
--    with the anon key can query the REST API for all columns.
--
--    Fix: Revoke SELECT on `ein` and `user_id` from the `anon` role at the
--    column level. The `authenticated` role retains full access; the shelter
--    owner policy already allows full CRUD via auth.uid() = user_id.
--
-- B) The storage INSERT policy allows any authenticated user to upload any
--    object name to the three public buckets. The Next.js upload route enforces
--    the `{userId}/{uuid}.{ext}` path convention, but direct Storage API calls
--    bypass the route.
--
--    Fix: Replace the INSERT policy to enforce that the uploader's uid matches
--    the first path segment, and the filename matches the expected UUID.ext
--    pattern.

-- ================================================================
-- A) Column-level revoke on shelters for anonymous role
-- ================================================================

-- Revoke sensitive columns from anonymous. PostgREST uses the `anon` role for
-- requests authenticated only with the public anon key (no user JWT).
REVOKE SELECT (ein, user_id) ON public.shelters FROM anon;

-- ================================================================
-- B) Harden storage INSERT policy (path enforcement)
-- ================================================================

DROP POLICY IF EXISTS "storage.objects: authenticated users can upload to public buckets"
  ON storage.objects;

-- New policy: authenticated users can upload only to their own uid-prefixed
-- folder, with a UUID filename and allowed extension. Mirrors exactly what the
-- /api/upload/photo route enforces, closing the direct-bypass gap.
CREATE POLICY "storage.objects: authenticated users upload own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('dog-photos', 'shelter-logos', 'foster-avatars')
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND name ~ ('^' || auth.uid()::text || '/[0-9a-fA-F\-]{36}\.(jpg|png|webp)$')
  );

-- Note on storage SELECT / DELETE: existing policies are unchanged.
-- SELECT: anyone can read objects in public buckets (intended — public images).
-- DELETE: owner can delete their own folder's objects (enforced by uid match).
