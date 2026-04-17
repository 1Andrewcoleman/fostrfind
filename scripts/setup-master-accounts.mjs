#!/usr/bin/env node
/**
 * setup-master-accounts.mjs
 *
 * Creates two master dev accounts in the connected Supabase project —
 * one shelter, one foster — with auto-confirmed emails and matching
 * profile rows in the `shelters` / `foster_parents` tables.
 *
 * Idempotent: re-running checks for existing users by email and will
 * not duplicate. Missing profile rows are created on subsequent runs.
 *
 * Appends the generated credentials to `.env.local` only if the keys
 * are not already present. Passwords are printed to stdout ONCE so you
 * can capture them to a password manager; on subsequent runs, existing
 * .env.local values are re-used and no new passwords are generated.
 *
 * Requirements in .env.local:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Usage:
 *   node scripts/setup-master-accounts.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')

// ---- Load .env.local -----------------------------------------------------

if (!existsSync(envPath)) {
  console.error(`[setup] .env.local not found at ${envPath}`)
  process.exit(1)
}

const rawEnv = readFileSync(envPath, 'utf8')
/** @type {Record<string, string>} */
const envMap = {}
for (const line of rawEnv.split(/\r?\n/)) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  envMap[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
}

const SUPABASE_URL = envMap.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = envMap.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL?.startsWith('http')) {
  console.error('[setup] NEXT_PUBLIC_SUPABASE_URL missing or invalid')
  process.exit(1)
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.length < 20) {
  console.error('[setup] SUPABASE_SERVICE_ROLE_KEY missing or invalid')
  process.exit(1)
}

// ---- Account definitions -------------------------------------------------

const SHELTER_EMAIL = 'dev-shelter@fostrfix.local'
const FOSTER_EMAIL = 'dev-foster@fostrfix.local'

function generatePassword() {
  // 24 url-safe chars of entropy; hard to type but we never type it.
  return randomBytes(18).toString('base64url')
}

const shelterPassword = envMap.DEV_MASTER_SHELTER_PASSWORD || generatePassword()
const fosterPassword = envMap.DEV_MASTER_FOSTER_PASSWORD || generatePassword()
const shelterPasswordWasGenerated = !envMap.DEV_MASTER_SHELTER_PASSWORD
const fosterPasswordWasGenerated = !envMap.DEV_MASTER_FOSTER_PASSWORD

// ---- Supabase admin client ----------------------------------------------

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/**
 * Return the existing auth user for the given email, or null.
 * Supabase's admin.listUsers pages through results; we walk enough pages
 * to cover reasonable dev projects.
 */
async function findUserByEmail(email) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const match = data.users.find((u) => u.email === email)
    if (match) return match
    if (data.users.length < 200) break
  }
  return null
}

async function upsertAuthUser(email, password) {
  const existing = await findUserByEmail(email)
  if (existing) {
    console.log(`[setup]   user exists — id=${existing.id}`)
    return { userId: existing.id, created: false }
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  console.log(`[setup]   user created — id=${data.user.id}`)
  return { userId: data.user.id, created: true }
}

async function upsertShelterProfile(userId) {
  const { data: existing } = await admin
    .from('shelters')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) {
    console.log(`[setup]   shelter profile exists — id=${existing.id}`)
    return
  }
  const { error } = await admin.from('shelters').insert({
    user_id: userId,
    name: 'Dev Shelter (Master)',
    slug: `dev-shelter-master-${userId.slice(0, 8)}`,
    email: SHELTER_EMAIL,
    location: 'Austin, TX',
    bio: 'Master dev shelter account used for local UI previews and screenshots.',
  })
  if (error) throw error
  console.log('[setup]   shelter profile created')
}

async function upsertFosterProfile(userId) {
  const { data: existing } = await admin
    .from('foster_parents')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle()
  if (existing) {
    console.log(`[setup]   foster profile exists — id=${existing.id}`)
    return
  }
  const { error } = await admin.from('foster_parents').insert({
    user_id: userId,
    first_name: 'Dev',
    last_name: 'Foster',
    email: FOSTER_EMAIL,
    location: 'Austin, TX',
    bio: 'Master dev foster account used for local UI previews and screenshots.',
  })
  if (error) throw error
  console.log('[setup]   foster profile created')
}

// ---- Main ----------------------------------------------------------------

async function main() {
  console.log('[setup] connecting to', SUPABASE_URL)

  console.log('[setup] ensuring master shelter account')
  const shelter = await upsertAuthUser(SHELTER_EMAIL, shelterPassword)
  await upsertShelterProfile(shelter.userId)

  console.log('[setup] ensuring master foster account')
  const foster = await upsertAuthUser(FOSTER_EMAIL, fosterPassword)
  await upsertFosterProfile(foster.userId)

  // ---- Append credentials to .env.local (only missing keys) --------------

  const toAppend = []
  if (!('DEV_MASTER_SHELTER_EMAIL' in envMap)) {
    toAppend.push(`DEV_MASTER_SHELTER_EMAIL=${SHELTER_EMAIL}`)
  }
  if (!('DEV_MASTER_SHELTER_PASSWORD' in envMap)) {
    toAppend.push(`DEV_MASTER_SHELTER_PASSWORD=${shelterPassword}`)
  }
  if (!('DEV_MASTER_FOSTER_EMAIL' in envMap)) {
    toAppend.push(`DEV_MASTER_FOSTER_EMAIL=${FOSTER_EMAIL}`)
  }
  if (!('DEV_MASTER_FOSTER_PASSWORD' in envMap)) {
    toAppend.push(`DEV_MASTER_FOSTER_PASSWORD=${fosterPassword}`)
  }

  if (toAppend.length > 0) {
    const block =
      (rawEnv.endsWith('\n') ? '' : '\n') +
      '\n# Master dev accounts — created by scripts/setup-master-accounts.mjs\n' +
      toAppend.join('\n') +
      '\n'
    writeFileSync(envPath, rawEnv + block, 'utf8')
    console.log(`[setup] appended ${toAppend.length} new key(s) to .env.local`)
  } else {
    console.log('[setup] .env.local already has all master-account keys — no changes')
  }

  // ---- Summary ------------------------------------------------------------

  console.log('\n[setup] ===== summary =====')
  console.log(`[setup] shelter:  ${SHELTER_EMAIL}`)
  if (shelterPasswordWasGenerated) {
    console.log(`[setup] shelter password (NEW — save this): ${shelterPassword}`)
  } else {
    console.log('[setup] shelter password: (unchanged — see .env.local)')
  }
  console.log(`[setup] foster:   ${FOSTER_EMAIL}`)
  if (fosterPasswordWasGenerated) {
    console.log(`[setup] foster password  (NEW — save this): ${fosterPassword}`)
  } else {
    console.log('[setup] foster password:  (unchanged — see .env.local)')
  }
  console.log('[setup] done.')
}

main().catch((err) => {
  console.error('[setup] FAILED:', err?.message ?? err)
  process.exit(1)
})
