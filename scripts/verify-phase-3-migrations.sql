-- Phase 3 migration verification — single-result consolidated report.
--
-- The Supabase SQL editor only surfaces results from the LAST statement,
-- so the previous multi-SELECT version was hiding blocks 1-5. This
-- rewrite returns one labelled result set: each row is one check, with
-- expected/actual counts and a PASS/FAIL column.
--
-- Everything is read-only. Safe to run any time.
--
-- HOW TO READ: every row should show status = 'PASS'. If any row is
-- 'FAIL', see the block reference to know which migration to re-apply.

WITH
-- ============================================================
-- Step 23 — indexes (9 expected)
-- ============================================================
step_23 AS (
  SELECT
    'step-23: indexes'                                 AS block,
    '9 rows: the index names listed in migration file' AS expected,
    (
      SELECT COUNT(*)::text
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN (
           'idx_dogs_status',
           'idx_dogs_shelter_id',
           'idx_applications_foster_id',
           'idx_applications_shelter_id',
           'idx_applications_dog_id',
           'idx_applications_status',
           'idx_messages_application_id_read',
           'idx_shelters_user_id',
           'idx_foster_parents_user_id'
         )
    )                                                  AS actual,
    (
      SELECT CASE WHEN COUNT(*) = 9 THEN 'PASS' ELSE 'FAIL' END
        FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname IN (
           'idx_dogs_status',
           'idx_dogs_shelter_id',
           'idx_applications_foster_id',
           'idx_applications_shelter_id',
           'idx_applications_dog_id',
           'idx_applications_status',
           'idx_messages_application_id_read',
           'idx_shelters_user_id',
           'idx_foster_parents_user_id'
         )
    )                                                  AS status
),

-- ============================================================
-- Step 24 — atomic RPC functions (3 expected, all LANGUAGE sql,
-- SECURITY DEFINER, search_path=public)
-- ============================================================
step_24_funcs AS (
  SELECT
    p.proname::text                                AS function_name,
    l.lanname::text                                AS language,
    p.prosecdef                                    AS security_definer,
    COALESCE(array_to_string(p.proconfig, ','), '') AS config
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  JOIN pg_language  l ON l.oid = p.prolang
  WHERE n.nspname = 'public'
    AND p.proname IN ('accept_application', 'complete_application', 'relist_dog')
),
step_24 AS (
  SELECT
    'step-24: atomic RPC functions' AS block,
    '3 funcs, each language=sql, secdef=true, search_path=public'::text AS expected,
    (SELECT COUNT(*)::text FROM step_24_funcs)      AS actual,
    (
      SELECT CASE
        WHEN COUNT(*) = 3
          AND bool_and(language = 'sql')
          AND bool_and(security_definer = true)
          AND bool_and(config ILIKE '%search_path=public%')
        THEN 'PASS'
        ELSE 'FAIL'
      END
      FROM step_24_funcs
    )                                               AS status
),

-- ============================================================
-- Step 25a — unique constraints (4 expected)
-- ============================================================
step_25_constraints AS (
  SELECT tc.constraint_name
    FROM information_schema.table_constraints tc
   WHERE tc.constraint_type = 'UNIQUE'
     AND tc.table_schema    = 'public'
     AND tc.constraint_name IN (
       'applications_dog_foster_unique',
       'ratings_application_unique',
       'foster_parents_user_id_unique',
       'shelters_user_id_unique'
     )
),
step_25a AS (
  SELECT
    'step-25: unique constraints'                       AS block,
    '4 constraints: applications(dog,foster), ratings(app), fosters(user), shelters(user)'::text AS expected,
    (SELECT COUNT(*)::text FROM step_25_constraints)    AS actual,
    (SELECT CASE WHEN COUNT(*) = 4 THEN 'PASS' ELSE 'FAIL' END FROM step_25_constraints) AS status
),

-- ============================================================
-- Step 25b — applications foster RLS split into 4 command-scoped
-- policies (SELECT / INSERT / UPDATE / DELETE)
-- ============================================================
step_25_policies AS (
  SELECT policyname, cmd, with_check
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename  = 'applications'
     AND policyname LIKE 'applications: foster%'
),
step_25b AS (
  SELECT
    'step-25: foster RLS policies'                                       AS block,
    '4 policies (SELECT/INSERT/UPDATE/DELETE); INSERT has available check' AS expected,
    (SELECT COUNT(*)::text FROM step_25_policies)                        AS actual,
    (
      SELECT CASE
        WHEN COUNT(*) = 4
          AND COUNT(*) FILTER (WHERE cmd = 'SELECT') = 1
          AND COUNT(*) FILTER (WHERE cmd = 'INSERT') = 1
          AND COUNT(*) FILTER (WHERE cmd = 'UPDATE') = 1
          AND COUNT(*) FILTER (WHERE cmd = 'DELETE') = 1
          AND bool_or(cmd = 'INSERT' AND with_check ILIKE '%status%=%available%')
        THEN 'PASS'
        ELSE 'FAIL'
      END
      FROM step_25_policies
    )                                                                    AS status
),

-- ============================================================
-- Step 25c — old "foster can manage own" FOR ALL policy removed
-- ============================================================
step_25c AS (
  SELECT
    'step-25: legacy FOR ALL policy dropped' AS block,
    '0 rows (legacy policy must not exist)'  AS expected,
    (
      SELECT COUNT(*)::text
        FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename  = 'applications'
         AND policyname = 'applications: foster can manage own'
    )                                        AS actual,
    (
      SELECT CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END
        FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename  = 'applications'
         AND policyname = 'applications: foster can manage own'
    )                                        AS status
),

-- ============================================================
-- Integrity smoke — zero pre-existing duplicates that would block
-- the Step 25 UNIQUE constraints. Aggregated into a single row.
-- ============================================================
integrity_smoke AS (
  SELECT
    'integrity: no duplicate rows anywhere' AS block,
    '0 (sum across 4 duplicate classes)'    AS expected,
    (
      (SELECT COUNT(*)::int FROM (SELECT dog_id, foster_id FROM public.applications GROUP BY 1,2 HAVING COUNT(*) > 1) d) +
      (SELECT COUNT(*)::int FROM (SELECT application_id FROM public.ratings GROUP BY 1 HAVING COUNT(*) > 1) d) +
      (SELECT COUNT(*)::int FROM (SELECT user_id FROM public.shelters GROUP BY 1 HAVING COUNT(*) > 1) d) +
      (SELECT COUNT(*)::int FROM (SELECT user_id FROM public.foster_parents GROUP BY 1 HAVING COUNT(*) > 1) d)
    )::text                                 AS actual,
    CASE
      WHEN (
        (SELECT COUNT(*) FROM (SELECT dog_id, foster_id FROM public.applications GROUP BY 1,2 HAVING COUNT(*) > 1) d) +
        (SELECT COUNT(*) FROM (SELECT application_id FROM public.ratings GROUP BY 1 HAVING COUNT(*) > 1) d) +
        (SELECT COUNT(*) FROM (SELECT user_id FROM public.shelters GROUP BY 1 HAVING COUNT(*) > 1) d) +
        (SELECT COUNT(*) FROM (SELECT user_id FROM public.foster_parents GROUP BY 1 HAVING COUNT(*) > 1) d)
      ) = 0
      THEN 'PASS' ELSE 'FAIL'
    END                                     AS status
)

SELECT * FROM step_23
UNION ALL SELECT * FROM step_24
UNION ALL SELECT * FROM step_25a
UNION ALL SELECT * FROM step_25b
UNION ALL SELECT * FROM step_25c
UNION ALL SELECT * FROM integrity_smoke
ORDER BY block;
