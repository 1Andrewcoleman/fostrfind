#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * One-shot smoke test that the three Phase 2 migrations applied correctly.
 * Runs against whatever Supabase project `.env.local` points at.
 *
 *   node scripts/verify-phase-2-migrations.mjs
 */

import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.trim() && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]
    }),
)

const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const results = []
function record(name, ok, detail) {
  results.push({ name, ok, detail })
  console.log(`${ok ? '✓' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

// --- §17 Realtime: messages in supabase_realtime publication ----------------
{
  const { data, error } = await admin
    .from('pg_publication_tables')
    .select('pubname, tablename')
    .eq('pubname', 'supabase_realtime')
    .eq('tablename', 'messages')
  if (error) {
    // pg_publication_tables is not exposed via PostgREST by default.
    // Note the failure and keep going; a positive signal will come from
    // Realtime functional testing in two browser windows.
    record(
      '§17 messages in supabase_realtime publication',
      false,
      `cannot introspect via PostgREST: ${error.message}. Verify manually in Supabase Dashboard → Database → Publications.`,
    )
  } else {
    record('§17 messages in supabase_realtime publication', (data?.length ?? 0) > 0)
  }
}

// --- §20 shelter_ratings table + RLS ----------------------------------------
{
  const { error } = await admin.from('shelter_ratings').select('id').limit(1)
  if (error) {
    record('§20 shelter_ratings table readable via service role', false, error.message)
  } else {
    record('§20 shelter_ratings table readable via service role', true)
  }
}

// Quick column shape check: try inserting with bogus FKs; we expect a FK
// error, which proves the column set + types are correct.
{
  const { error } = await admin.from('shelter_ratings').insert({
    application_id: '00000000-0000-0000-0000-000000000000',
    shelter_id: '00000000-0000-0000-0000-000000000000',
    foster_id: '00000000-0000-0000-0000-000000000000',
    dog_id: '00000000-0000-0000-0000-000000000000',
    score: 3,
    comment: 'verify',
  })
  // 23503 = foreign_key_violation. That's the WIN case — schema is correct,
  // only reason the row can't land is that the IDs don't exist.
  const fkViolation = error?.code === '23503'
  record(
    '§20 shelter_ratings columns + types (FK violation proves schema)',
    fkViolation,
    error ? `code=${error.code} ${error.message.slice(0, 80)}` : 'unexpectedly succeeded',
  )
}

// --- §20 anon can SELECT shelter_ratings (public read policy) ---------------
{
  const anon = createClient(url, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  })
  const { error } = await anon.from('shelter_ratings').select('id').limit(1)
  record('§20 anon can SELECT shelter_ratings', !error, error?.message)
}

// --- §22 distance_miles function --------------------------------------------
// ATX (30.27, -97.74) -> NYC (40.71, -74.00) is ~1510 miles.
{
  const { data, error } = await admin.rpc('distance_miles', {
    lat_a: 30.27,
    lon_a: -97.74,
    lat_b: 40.71,
    lon_b: -74.0,
  })
  if (error) {
    record('§22 distance_miles(ATX, NYC) callable', false, error.message)
  } else {
    const miles = Number(data)
    const ok = miles > 1400 && miles < 1600
    record('§22 distance_miles(ATX, NYC) ≈ 1510', ok, `got ${miles.toFixed(1)}`)
  }
}

// --- §22 distance_miles null-safety -----------------------------------------
{
  const { data, error } = await admin.rpc('distance_miles', {
    lat_a: null,
    lon_a: null,
    lat_b: 40.71,
    lon_b: -74.0,
  })
  record(
    '§22 distance_miles returns null on null input',
    !error && data === null,
    error?.message ?? `got ${data}`,
  )
}

// --- §20 helper functions (get_my_foster_ids / get_my_shelter_ids) ----------
// These should already exist from Phase 1's 20240102000000_fix_rls_recursion
// but Step 20's RLS depends on them; verify they're still callable.
{
  const { error } = await admin.rpc('get_my_foster_ids')
  // As service role there's no auth.uid(); expect it to return empty or error.
  // Success = function is callable at all.
  record(
    'Phase 1 helper get_my_foster_ids callable',
    !error,
    error?.message.slice(0, 80),
  )
}

// ---------------------------------------------------------------------------

const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length} / ${results.length} checks passed`)
if (failed.length > 0) {
  console.log('\nFailures:')
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`)
  process.exit(1)
}
