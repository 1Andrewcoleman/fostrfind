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
-- Implementation note (2026-04-20 rewrite):
--   The first cut of this migration used LANGUAGE plpgsql with
--   `DECLARE v_dog_id uuid; ... SELECT dog_id INTO v_dog_id FROM ...`.
--   That is valid PostgreSQL and works with `supabase db push` / psql /
--   anything that honours `$$ ... $$` dollar-quoting, but the Supabase
--   dashboard SQL editor (and some other splitters) can misread the body
--   and try to run `SELECT dog_id INTO v_dog_id FROM ...` as top-level
--   SQL — where `INTO v_dog_id` is parsed as `CREATE TABLE v_dog_id AS`
--   and everything downstream collapses with `42P01: relation "v_dog_id"
--   does not exist`.
--
--   To keep the migration runnable from every tool we ship, the three
--   functions are rewritten as LANGUAGE sql using data-modifying CTEs.
--   No DECLARE / BEGIN / END to confuse a naive splitter, identical
--   transactional semantics (a function call is always atomic with
--   respect to the caller's transaction), and data-modifying CTEs run
--   exactly once even if the outer statement doesn't reference them.
--
-- SECURITY DEFINER + `search_path = public` is pinned to prevent
-- search-path hijacks per the convention in
-- 20240102000000_fix_rls_recursion.sql. The API routes still do all
-- authn / ownership / idempotency checks before calling the function —
-- it's a data-layer atomicity primitive, not an authorization boundary.

-- ============================================================
-- Drop any previous definitions first. CREATE OR REPLACE cannot change
-- a function's LANGUAGE, and earlier versions of this migration shipped
-- a plpgsql body. A DROP + CREATE is the safest way to migrate forward
-- from a half-applied run.
-- ============================================================

DROP FUNCTION IF EXISTS public.accept_application(uuid);
DROP FUNCTION IF EXISTS public.complete_application(uuid);
DROP FUNCTION IF EXISTS public.relist_dog(uuid);

-- ============================================================
-- accept_application(app_id) — apps: submitted|reviewing -> accepted
--                              dogs: available|pending   -> pending
-- ============================================================

CREATE FUNCTION public.accept_application(app_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated_app AS (
    UPDATE public.applications
       SET status = 'accepted',
           updated_at = now()
     WHERE id = app_id
    RETURNING dog_id
  )
  UPDATE public.dogs
     SET status = 'pending',
         updated_at = now()
    FROM updated_app
   WHERE public.dogs.id = updated_app.dog_id;
$$;

-- ============================================================
-- complete_application(app_id) — apps: accepted -> completed
--                                dogs: pending  -> placed
-- ============================================================

CREATE FUNCTION public.complete_application(app_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated_app AS (
    UPDATE public.applications
       SET status = 'completed',
           updated_at = now()
     WHERE id = app_id
    RETURNING dog_id
  )
  UPDATE public.dogs
     SET status = 'placed',
         updated_at = now()
    FROM updated_app
   WHERE public.dogs.id = updated_app.dog_id;
$$;

-- ============================================================
-- relist_dog(p_dog_id) — dogs: pending -> available
--                       apps: (accepted for this dog) -> declined
--
-- Scope-expansion over the original Step 24 scope (which covered only
-- accept + complete). The re-list route added in Phase 1 Step 5 suffers
-- the same dual-update fragility: it declines the lingering accepted
-- application first and then sets the dog back to available. Bundling
-- them into one function closes the same atomicity gap.
--
-- The parameter is named `p_dog_id` (not `dog_id`) to avoid shadowing
-- the column of the same name in both `applications` and `dogs`, which
-- made the earlier version lean on qualified `relist_dog.dog_id`
-- references that some clients rejected.
-- ============================================================

CREATE FUNCTION public.relist_dog(p_dog_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH decline_accepted AS (
    UPDATE public.applications
       SET status = 'declined',
           updated_at = now()
     WHERE dog_id = p_dog_id
       AND status = 'accepted'
    RETURNING id
  )
  -- Per the PostgreSQL docs, data-modifying CTEs run exactly once and
  -- to completion even when the primary query doesn't reference them,
  -- so the `decline_accepted` UPDATE above fires regardless.
  UPDATE public.dogs
     SET status = 'available',
         updated_at = now()
   WHERE id = p_dog_id;
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
