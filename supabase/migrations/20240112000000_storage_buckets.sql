-- Create the three public storage buckets used by the app and their
-- RLS policies. Matches the constants in src/lib/constants.ts
-- (STORAGE_BUCKETS) and the path convention enforced by the shared
-- upload route: `{userId}/{uuid}.{ext}`.
--
-- Path convention matters for the DELETE policy: we rely on
-- `storage.foldername(name)[1]` returning the userId folder so an
-- uploader can only remove their own files.

-- ---- Buckets ------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('dog-photos', 'dog-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('shelter-logos', 'shelter-logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('foster-avatars', 'foster-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- ---- SELECT — public read ----------------------------------------------
-- Dog photos, shelter logos, and foster avatars are user-facing in the
-- product (browse cards, dashboards, public shelter profiles in Step 16)
-- so anyone — signed in or not — can read the object. Buckets are also
-- marked `public` above, which controls URL-based fetch; this policy
-- authorizes the list/select path.

CREATE POLICY "storage.objects: anyone can read public buckets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id IN ('dog-photos', 'shelter-logos', 'foster-avatars')
  );

-- ---- INSERT — any authenticated user can upload ------------------------
-- The app's custom upload route (`/api/upload/photo`) is what applies
-- ownership rules: it forces the storage path to `{userId}/…` before
-- calling storage.from().upload(). This policy just blocks anonymous
-- writes.

CREATE POLICY "storage.objects: authenticated users can upload to public buckets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('dog-photos', 'shelter-logos', 'foster-avatars')
  );

-- ---- DELETE — owner can delete their own uploads -----------------------
-- Relies on the path convention `{userId}/{uuid}.{ext}` so
-- storage.foldername(name)[1] returns the uploader's auth.uid().

CREATE POLICY "storage.objects: owner can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id IN ('dog-photos', 'shelter-logos', 'foster-avatars')
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- ---- UPDATE ------------------------------------------------------------
-- We explicitly do NOT grant UPDATE. The app performs "replace" operations
-- as delete + upload-new-uuid, which also cleans up the old file and
-- keeps CDN caches consistent. If future UX needs in-place overwrite,
-- add a policy here mirroring the DELETE one.
