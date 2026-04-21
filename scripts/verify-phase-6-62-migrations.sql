-- Phase 6.2 migration verification — single consolidated report.
--
-- The Supabase SQL editor only surfaces results from the LAST statement,
-- so this script returns one labelled result set: each row is one check,
-- with expected/actual counts and a PASS/FAIL column.
--
-- Everything is read-only. Safe to run any time.
--
-- HOW TO READ: every row should show status = 'PASS'. If any row is
-- 'FAIL', see the block reference to know which migration to re-apply.
-- Reference migration: supabase/migrations/20240113000000_shelter_foster_roster.sql

WITH
-- ============================================================
-- Tables — three expected
-- ============================================================
tables_expected AS (
  SELECT unnest(array[
    'shelter_fosters',
    'shelter_foster_invites',
    'shelter_foster_notes'
  ]) AS tablename
),
tables_present AS (
  SELECT c.relname::text AS tablename
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND c.relname IN ('shelter_fosters', 'shelter_foster_invites', 'shelter_foster_notes')
),
check_tables AS (
  SELECT
    '6.2: three tables exist' AS block,
    '3 (shelter_fosters, shelter_foster_invites, shelter_foster_notes)' AS expected,
    (SELECT COUNT(*)::text FROM tables_present) AS actual,
    (SELECT CASE WHEN COUNT(*) = 3 THEN 'PASS' ELSE 'FAIL' END FROM tables_present) AS status
),

-- ============================================================
-- RLS enabled on all three
-- ============================================================
check_rls AS (
  SELECT
    '6.2: RLS enabled on all three tables' AS block,
    '3 rows, all rowsecurity=true' AS expected,
    (
      SELECT COUNT(*)::text
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname IN ('shelter_fosters', 'shelter_foster_invites', 'shelter_foster_notes')
         AND c.relrowsecurity = true
    ) AS actual,
    (
      SELECT CASE WHEN COUNT(*) = 3 THEN 'PASS' ELSE 'FAIL' END
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = 'public'
         AND c.relname IN ('shelter_fosters', 'shelter_foster_invites', 'shelter_foster_notes')
         AND c.relrowsecurity = true
    ) AS status
),

-- ============================================================
-- Indexes — 4 expected beyond the implicit PK indexes
-- ============================================================
index_expected AS (
  SELECT unnest(array[
    'shelter_fosters_foster_idx',
    'shelter_foster_invites_pending_uniq',
    'shelter_foster_invites_foster_idx',
    'shelter_foster_invites_email_idx'
  ]) AS indexname
),
indexes_present AS (
  SELECT indexname::text
    FROM pg_indexes
   WHERE schemaname = 'public'
     AND indexname IN (
       'shelter_fosters_foster_idx',
       'shelter_foster_invites_pending_uniq',
       'shelter_foster_invites_foster_idx',
       'shelter_foster_invites_email_idx'
     )
),
check_indexes AS (
  SELECT
    '6.2: explicit indexes present' AS block,
    '4 (roster foster lookup, invite pending uniq, invite foster idx, invite email idx)' AS expected,
    (SELECT COUNT(*)::text FROM indexes_present) AS actual,
    (SELECT CASE WHEN COUNT(*) = 4 THEN 'PASS' ELSE 'FAIL' END FROM indexes_present) AS status
),

-- ============================================================
-- Partial unique index on pending invites — shape check
-- ============================================================
check_partial_uniq AS (
  SELECT
    '6.2: pending-invite uniq is partial on status=pending' AS block,
    '1 (index defined WHERE status = ''pending'')' AS expected,
    (
      SELECT COUNT(*)::text
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'shelter_foster_invites_pending_uniq'
         AND indexdef ILIKE '%WHERE%status%=%pending%'
    ) AS actual,
    (
      SELECT CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'shelter_foster_invites_pending_uniq'
         AND indexdef ILIKE '%WHERE%status%=%pending%'
    ) AS status
),

-- ============================================================
-- shelter_fosters composite PK on (shelter_id, foster_id)
-- ============================================================
check_roster_pk AS (
  SELECT
    '6.2: shelter_fosters composite PK' AS block,
    '1 PK covering (shelter_id, foster_id)' AS expected,
    (
      SELECT COUNT(*)::text
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = 'shelter_fosters'
         AND c.contype = 'p'
         AND c.conkey @> (
           SELECT array_agg(a.attnum ORDER BY a.attnum)
             FROM pg_attribute a
            WHERE a.attrelid = t.oid
              AND a.attname IN ('shelter_id', 'foster_id')
         )
    ) AS actual,
    (
      SELECT CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'public'
         AND t.relname = 'shelter_fosters'
         AND c.contype = 'p'
    ) AS status
),

-- ============================================================
-- Policies — five expected
--   shelter_fosters: 3 (shelter read / foster read / foster delete)
--   shelter_foster_invites: 3 (shelter manage / foster read / foster update)
--   shelter_foster_notes: 1 (shelter manage)
-- ============================================================
policy_expected AS (
  SELECT unnest(array[
    'shelter_fosters: shelter read own',
    'shelter_fosters: foster read own',
    'shelter_fosters: foster delete own',
    'shelter_foster_invites: shelter manage own',
    'shelter_foster_invites: foster read own',
    'shelter_foster_invites: foster respond to own',
    'shelter_foster_notes: shelter manage own'
  ]) AS policyname
),
policies_present AS (
  SELECT policyname::text
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename  IN ('shelter_fosters', 'shelter_foster_invites', 'shelter_foster_notes')
     AND policyname IN (
       'shelter_fosters: shelter read own',
       'shelter_fosters: foster read own',
       'shelter_fosters: foster delete own',
       'shelter_foster_invites: shelter manage own',
       'shelter_foster_invites: foster read own',
       'shelter_foster_invites: foster respond to own',
       'shelter_foster_notes: shelter manage own'
     )
),
check_policies AS (
  SELECT
    '6.2: RLS policies present' AS block,
    '7 (3 roster, 3 invites, 1 notes)' AS expected,
    (SELECT COUNT(*)::text FROM policies_present) AS actual,
    (SELECT CASE WHEN COUNT(*) = 7 THEN 'PASS' ELSE 'FAIL' END FROM policies_present) AS status
),

-- ============================================================
-- No INSERT policy on shelter_fosters (service-role only)
-- ============================================================
check_no_insert_policy AS (
  SELECT
    '6.2: shelter_fosters has NO insert policy (service-role only)' AS block,
    '0 rows' AS expected,
    (
      SELECT COUNT(*)::text
        FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename  = 'shelter_fosters'
         AND cmd        = 'INSERT'
    ) AS actual,
    (
      SELECT CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END
        FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename  = 'shelter_fosters'
         AND cmd        = 'INSERT'
    ) AS status
),

-- ============================================================
-- updated_at trigger on shelter_foster_notes
-- ============================================================
check_notes_trigger AS (
  SELECT
    '6.2: shelter_foster_notes updated_at trigger' AS block,
    '1 trigger (shelter_foster_notes_updated_at)' AS expected,
    (
      SELECT COUNT(*)::text
        FROM pg_trigger
       WHERE tgrelid = 'public.shelter_foster_notes'::regclass
         AND tgname  = 'shelter_foster_notes_updated_at'
         AND NOT tgisinternal
    ) AS actual,
    (
      SELECT CASE WHEN COUNT(*) = 1 THEN 'PASS' ELSE 'FAIL' END
        FROM pg_trigger
       WHERE tgrelid = 'public.shelter_foster_notes'::regclass
         AND tgname  = 'shelter_foster_notes_updated_at'
         AND NOT tgisinternal
    ) AS status
)

SELECT * FROM check_tables
UNION ALL SELECT * FROM check_rls
UNION ALL SELECT * FROM check_indexes
UNION ALL SELECT * FROM check_partial_uniq
UNION ALL SELECT * FROM check_roster_pk
UNION ALL SELECT * FROM check_policies
UNION ALL SELECT * FROM check_no_insert_policy
UNION ALL SELECT * FROM check_notes_trigger
ORDER BY block;
