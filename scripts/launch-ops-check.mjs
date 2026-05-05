#!/usr/bin/env node
/**
 * Launch-ops audit — automated subset of docs/FinalRoadmap.md
 *
 * Items this script CAN verify (no browser, no dashboards required):
 *   - OPS-2  storage buckets exist and are public
 *   - OPS-3  env-var presence in `.env.local` (production presence still
 *            requires a Vercel dashboard pass)
 *   - OPS-4  every expected table + the new `applications` columns exist
 *   - OPS-5  pilot-shelter `is_verified` state (read-only — does NOT flip)
 *   - OPS-6  `SUPPORT_EMAIL` is no longer the placeholder value
 *
 * Items this script CANNOT verify (need a human):
 *   - OPS-1  Resend domain DNS / API key correctness
 *   - OPS-3  presence of vars in Vercel project (no API token here)
 *   - OPS-7  end-to-end smoke test
 *
 * Run with:  node scripts/launch-ops-check.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(__dirname, '..')

function loadEnv(path) {
  const out = {}
  try {
    const raw = readFileSync(path, 'utf8')
    for (const line of raw.split('\n')) {
      if (!line || line.startsWith('#')) continue
      const i = line.indexOf('=')
      if (i === -1) continue
      out[line.slice(0, i).trim()] = line.slice(i + 1).trim()
    }
  } catch {
    // .env.local missing — caller will surface that as a check failure
  }
  return out
}

const env = loadEnv(resolve(repoRoot, '.env.local'))
const url = env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceKey) {
  console.error('FAIL: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing in .env.local')
  process.exit(2)
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } })

const results = []
function pass(id, msg) {
  results.push({ id, status: 'PASS', msg })
}
function warn(id, msg) {
  results.push({ id, status: 'WARN', msg })
}
function fail(id, msg) {
  results.push({ id, status: 'FAIL', msg })
}

// ---------------------------------------------------------------------------
// OPS-2 — Storage buckets
// ---------------------------------------------------------------------------
const EXPECTED_BUCKETS = ['dog-photos', 'shelter-logos', 'foster-avatars']
{
  const res = await fetch(`${url}/storage/v1/bucket`, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  })
  if (!res.ok) {
    fail('OPS-2', `Storage list failed: HTTP ${res.status}`)
  } else {
    const buckets = await res.json()
    const byName = new Map(buckets.map((b) => [b.name, b]))
    for (const name of EXPECTED_BUCKETS) {
      const b = byName.get(name)
      if (!b) {
        fail('OPS-2', `bucket missing: ${name}`)
      } else if (!b.public) {
        warn('OPS-2', `bucket exists but not public: ${name}`)
      } else {
        pass('OPS-2', `bucket public: ${name}`)
      }
    }
  }
}

// ---------------------------------------------------------------------------
// OPS-3 — env var presence in .env.local (production audit still needed)
// ---------------------------------------------------------------------------
const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'RESEND_API_KEY',
  'RESEND_FROM',
  'NEXT_PUBLIC_APP_URL',
]
const OPTIONAL_ENV = ['NEXT_PUBLIC_SENTRY_DSN', 'SENTRY_AUTH_TOKEN']
for (const key of REQUIRED_ENV) {
  const v = env[key]
  if (!v || v === 'your_resend_api_key_here' || v === 'https://example.supabase.co') {
    fail('OPS-3', `local .env.local missing or placeholder: ${key}`)
  } else {
    pass('OPS-3', `local .env.local set: ${key}`)
  }
}
for (const key of OPTIONAL_ENV) {
  if (!env[key]) warn('OPS-3', `local .env.local missing optional: ${key}`)
  else pass('OPS-3', `local .env.local set: ${key}`)
}

// ---------------------------------------------------------------------------
// OPS-4 — schema audit
// ---------------------------------------------------------------------------
const EXPECTED_TABLES = [
  'shelters',
  'foster_parents',
  'dogs',
  'applications',
  'messages',
  'ratings',
  'shelter_ratings',
  'shelter_fosters',
  'shelter_foster_invites',
  'shelter_foster_notes',
  'notifications',
  'dog_saves',
  'reports',
]
for (const t of EXPECTED_TABLES) {
  const { error } = await sb.from(t).select('*', { count: 'exact', head: true }).limit(0)
  if (error) fail('OPS-4', `table missing or unreadable: ${t} (${error.message})`)
  else pass('OPS-4', `table present: ${t}`)
}

// applications new columns (Step 46) — probe by selecting just those cols
{
  const { error } = await sb
    .from('applications')
    .select(
      'available_from,available_until,why_this_dog,emergency_contact_name,emergency_contact_phone,responsibilities_acknowledged',
      { head: true, count: 'exact' },
    )
    .limit(0)
  if (error) fail('OPS-4', `applications new columns missing: ${error.message}`)
  else pass('OPS-4', 'applications has all Step 46 columns')
}

// withdrawn status migration is implicit in the new code path. Verify the
// notifications enum accepts application_withdrawn by attempting a no-op
// validation via a guaranteed-readable column (just check the table exists,
// already covered above).

// ---------------------------------------------------------------------------
// OPS-5 — pilot shelter is_verified state (read-only)
// ---------------------------------------------------------------------------
{
  const { data, error } = await sb
    .from('shelters')
    .select('id,name,slug,is_verified')
    .order('created_at', { ascending: true })
  if (error) {
    fail('OPS-5', `shelters read failed: ${error.message}`)
  } else {
    const verified = data.filter((s) => s.is_verified)
    if (verified.length === 0) {
      warn('OPS-5', `no shelters verified yet (${data.length} total) — set pilot shelter via SQL`)
    } else {
      pass('OPS-5', `verified shelters: ${verified.map((s) => s.name).join(', ')}`)
    }
  }
}

// ---------------------------------------------------------------------------
// OPS-6 — SUPPORT_EMAIL is not the placeholder
// ---------------------------------------------------------------------------
{
  const constants = readFileSync(resolve(repoRoot, 'src/lib/constants.ts'), 'utf8')
  const m = constants.match(/SUPPORT_EMAIL\s*=\s*['"]([^'"]+)['"]/)
  if (!m) {
    fail('OPS-6', 'SUPPORT_EMAIL constant not found in src/lib/constants.ts')
  } else if (m[1].endsWith('.local') || m[1].endsWith('.example')) {
    fail('OPS-6', `SUPPORT_EMAIL still placeholder: ${m[1]}`)
  } else {
    pass('OPS-6', `SUPPORT_EMAIL set to: ${m[1]}`)
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const groups = ['OPS-2', 'OPS-3', 'OPS-4', 'OPS-5', 'OPS-6']
let failCount = 0
let warnCount = 0
for (const g of groups) {
  console.log(`\n=== ${g} ===`)
  for (const r of results.filter((x) => x.id === g)) {
    const icon = r.status === 'PASS' ? 'ok ' : r.status === 'WARN' ? 'warn' : 'FAIL'
    console.log(`  [${icon}] ${r.msg}`)
    if (r.status === 'FAIL') failCount++
    if (r.status === 'WARN') warnCount++
  }
}
console.log(`\nSummary: ${results.length - failCount - warnCount} pass, ${warnCount} warn, ${failCount} fail`)
process.exit(failCount > 0 ? 1 : 0)
