-- Phase 3 Step 25 — Unique constraints + tightened application INSERT RLS.
--
-- CRITICAL: run scripts/phase-3-step-25-preflight.sql in the Supabase
-- SQL editor FIRST. If any of the duplicate-row checks return rows,
-- STOP and dedupe before applying this migration. Running ALTER TABLE
-- ADD CONSTRAINT UNIQUE against existing duplicates fails the whole
-- migration and leaves the database in a partial state.
--
-- This migration fixes four classes of data-integrity holes:
--
-- 1. Duplicate applications (same dog + same foster) — the UI-layer
--    guard on the dog detail page races.
-- 2. Duplicate ratings per application — API idempotency is advisory.
-- 3. Multiple profile rows per auth user — traced during Step 10 to a
--    silent upsert failure when no matching UNIQUE constraint existed.
-- 4. INSERT RLS permits applying to non-available dogs — the UI
--    hides the Apply button but a determined actor can bypass it.
--
-- The RLS tightening is the most surgical change. The current
-- applications table has a single `FOR ALL` policy per role combining
-- all commands. A naive approach (add a new `FOR INSERT` policy that
-- requires dog.status = 'available') would NOT work because Postgres
-- ORs policies of the same command, so the existing FOR ALL foster
-- policy would keep permitting INSERTs without the dog-status check.
-- Instead, this migration splits the FOR ALL foster policy into four
-- command-scoped policies and adds the dog-availability check ONLY to
-- INSERT. UPDATE is NOT gated on dog status because a foster row may
-- legitimately reference a dog whose status transitions to pending
-- or placed after acceptance — blocking UPDATE in that case would
-- prevent withdrawal cleanup on accepted applications.

-- ============================================================
-- UNIQUE CONSTRAINTS
-- ============================================================

ALTER TABLE public.applications
  ADD CONSTRAINT applications_dog_foster_unique UNIQUE (dog_id, foster_id);

ALTER TABLE public.ratings
  ADD CONSTRAINT ratings_application_unique UNIQUE (application_id);

-- Single profile row per auth user. Discovered during Step 10 when
-- .upsert({...}, { onConflict: 'user_id' }) on the foster profile form
-- was silently failing with 42P10 "no unique or exclusion constraint
-- matching the ON CONFLICT specification". Same reasoning applied
-- to shelters even though no bug surfaced there yet.
ALTER TABLE public.foster_parents
  ADD CONSTRAINT foster_parents_user_id_unique UNIQUE (user_id);

ALTER TABLE public.shelters
  ADD CONSTRAINT shelters_user_id_unique UNIQUE (user_id);

-- ============================================================
-- APPLICATION INSERT RLS — split FOR ALL foster policy into
-- command-scoped policies, tighten INSERT with the dog-available check.
-- ============================================================

DROP POLICY IF EXISTS "applications: foster can manage own" ON public.applications;

-- SELECT — foster can see their own applications.
CREATE POLICY "applications: foster can view own"
  ON public.applications FOR SELECT
  USING (foster_id IN (SELECT public.get_my_foster_ids()));

-- UPDATE — foster can update their own applications (no dog-status
-- gate, for the same reason documented in the header: UPDATE of an
-- accepted application whose dog is now 'pending' is legitimate).
CREATE POLICY "applications: foster can update own"
  ON public.applications FOR UPDATE
  USING (foster_id IN (SELECT public.get_my_foster_ids()))
  WITH CHECK (foster_id IN (SELECT public.get_my_foster_ids()));

-- DELETE — foster withdrawal path.
CREATE POLICY "applications: foster can delete own"
  ON public.applications FOR DELETE
  USING (foster_id IN (SELECT public.get_my_foster_ids()));

-- INSERT — foster ownership AND dog must be available at apply time.
-- This is the new protection: the UI-level "Apply" button hide is no
-- longer the only line of defense against applying to a pending/placed dog.
CREATE POLICY "applications: foster can insert for available dogs"
  ON public.applications FOR INSERT
  WITH CHECK (
    foster_id IN (SELECT public.get_my_foster_ids())
    AND dog_id IN (SELECT id FROM public.dogs WHERE status = 'available')
  );
