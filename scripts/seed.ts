#!/usr/bin/env tsx
/**
 * scripts/seed.ts
 *
 * Multi-shelter development seed. Creates a namespaced population of
 * realistic fixtures — 3 shelters, 5 foster parents, 10 dogs, 15
 * applications across all five statuses, 30 messages, and 5 ratings —
 * so manual QA reflects a production-like data shape (cross-city
 * distances, multiple shelters in browse, inbox with real threads,
 * rating badges on cards, etc).
 *
 * Every entity this script creates is namespaced with a `seed-`
 * prefix on its email and/or slug so the companion `--reset` path can
 * target ONLY the seeded data — never the master dev accounts created
 * by `scripts/setup-master-accounts.mjs` or any real production
 * content that might live in the same database.
 *
 * Usage (from project root, requires SUPABASE_SERVICE_ROLE_KEY in
 * .env.local so we can bypass RLS and touch auth.users via the
 * admin API):
 *
 *   SEED_I_UNDERSTAND=1 npm run seed             # insert seeded data
 *   SEED_I_UNDERSTAND=1 npm run seed -- --reset  # wipe then reinsert
 *
 * The SEED_I_UNDERSTAND gate is deliberate: applying data to any
 * remote Supabase project is a non-reversible action from the
 * developer's perspective; the env var makes accidental invocation
 * impossible.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')

// --- env loading ---------------------------------------------------------

if (!existsSync(envPath)) {
  console.error(`[seed] .env.local not found at ${envPath}`)
  process.exit(1)
}
const envMap: Record<string, string> = {}
for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eq = trimmed.indexOf('=')
  if (eq === -1) continue
  envMap[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
}

const SUPABASE_URL = envMap.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = envMap.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL?.startsWith('http')) {
  console.error('[seed] NEXT_PUBLIC_SUPABASE_URL missing or invalid in .env.local')
  process.exit(1)
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.length < 20) {
  console.error('[seed] SUPABASE_SERVICE_ROLE_KEY missing or invalid in .env.local')
  process.exit(1)
}
if (process.env.SEED_I_UNDERSTAND !== '1') {
  console.error(
    '[seed] refusing to run without SEED_I_UNDERSTAND=1.\n' +
      '       This script writes data to the Supabase project configured in\n' +
      '       .env.local. Confirm the target is safe, then re-run with\n' +
      '       SEED_I_UNDERSTAND=1 npm run seed',
  )
  process.exit(1)
}

const RESET = process.argv.includes('--reset')

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// --- constants -----------------------------------------------------------

const SEED_PREFIX = 'seed-'
const SEED_PASSWORD = 'seed-password-123'
const PHOTO_CDN = 'https://images.unsplash.com'

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}
function minutesAgo(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString()
}

// --- fixture data --------------------------------------------------------

type ShelterSeed = {
  slug: string
  email: string
  name: string
  location: string
  latitude: number
  longitude: number
  bio: string
}

const SHELTERS: ShelterSeed[] = [
  {
    slug: `${SEED_PREFIX}happy-tails-rescue`,
    email: `${SEED_PREFIX}shelter-a@fostrfind.local`,
    name: 'Happy Tails Rescue',
    location: 'Austin, TX',
    latitude: 30.2672,
    longitude: -97.7431,
    bio: 'Small-breed-focused rescue serving the greater Austin area. Pulling dogs from rural shelters at risk of euthanasia since 2018.',
  },
  {
    slug: `${SEED_PREFIX}paws-and-claws`,
    email: `${SEED_PREFIX}shelter-b@fostrfind.local`,
    name: 'Paws & Claws Sanctuary',
    location: 'Denver, CO',
    latitude: 39.7392,
    longitude: -104.9903,
    bio: 'Mountain-region rescue specializing in senior and medical-needs dogs. Every dog in our care has a vet-reviewed plan.',
  },
  {
    slug: `${SEED_PREFIX}second-chance-shelter`,
    email: `${SEED_PREFIX}shelter-c@fostrfind.local`,
    name: 'Second Chance Shelter',
    location: 'Portland, OR',
    latitude: 45.5152,
    longitude: -122.6784,
    bio: 'No-kill shelter focused on pit bulls, bully mixes, and large-breed rescues across the Pacific Northwest.',
  },
]

type FosterSeed = {
  email: string
  first_name: string
  last_name: string
  location: string
  latitude: number
  longitude: number
  housing_type: 'house' | 'apartment' | 'townhouse' | 'condo' | 'other'
  has_yard: boolean
  has_other_pets: boolean
  has_children: boolean
  experience: 'none' | 'some' | 'experienced'
  bio: string
}

const FOSTERS: FosterSeed[] = [
  {
    email: `${SEED_PREFIX}foster-a@fostrfind.local`,
    first_name: 'Mia',
    last_name: 'Rodriguez',
    location: 'Austin, TX',
    latitude: 30.3072,
    longitude: -97.7531,
    housing_type: 'house',
    has_yard: true,
    has_other_pets: false,
    has_children: false,
    experience: 'experienced',
    bio: 'Long-time foster with a fenced yard and flexible remote schedule. Comfortable with medical cases.',
  },
  {
    email: `${SEED_PREFIX}foster-b@fostrfind.local`,
    first_name: 'Eli',
    last_name: 'Park',
    location: 'Denver, CO',
    latitude: 39.7492,
    longitude: -104.9833,
    housing_type: 'apartment',
    has_yard: false,
    has_other_pets: true,
    has_children: false,
    experience: 'some',
    bio: 'Apartment-dwelling foster with an elderly cat. Prefer small, low-energy dogs that do well in condos.',
  },
  {
    email: `${SEED_PREFIX}foster-c@fostrfind.local`,
    first_name: 'Jordan',
    last_name: 'Walker',
    location: 'Portland, OR',
    latitude: 45.5252,
    longitude: -122.6684,
    housing_type: 'townhouse',
    has_yard: true,
    has_other_pets: false,
    has_children: true,
    experience: 'some',
    bio: 'Family home with kids ages 8 and 12. Looking for social, kid-friendly medium-large dogs.',
  },
  {
    email: `${SEED_PREFIX}foster-d@fostrfind.local`,
    first_name: 'Sam',
    last_name: 'Kim',
    location: 'Seattle, WA',
    latitude: 47.6062,
    longitude: -122.3321,
    housing_type: 'condo',
    has_yard: false,
    has_other_pets: false,
    has_children: false,
    experience: 'none',
    bio: 'First-time foster. Quiet building, work-from-home, excited to start with a confident adult dog.',
  },
  {
    email: `${SEED_PREFIX}foster-e@fostrfind.local`,
    first_name: 'Priya',
    last_name: 'Shah',
    location: 'Los Angeles, CA',
    latitude: 34.0522,
    longitude: -118.2437,
    housing_type: 'house',
    has_yard: true,
    has_other_pets: true,
    has_children: false,
    experience: 'experienced',
    bio: 'Trainer by day, foster by night. Specialize in reactive and under-socialized adolescents.',
  },
]

type DogSeed = {
  shelterIdx: 0 | 1 | 2
  name: string
  breed: string
  age: 'puppy' | 'young' | 'adult' | 'senior'
  size: 'small' | 'medium' | 'large' | 'xl'
  gender: 'male' | 'female'
  temperament: string
  description: string
  photo?: string
  medical_status?: string
  special_needs?: string
}

const DOGS: DogSeed[] = [
  { shelterIdx: 0, name: 'Buddy', breed: 'Labrador Retriever', age: 'adult', size: 'large', gender: 'male', temperament: 'Friendly, high energy', description: 'Loves swimming and fetch. Great with kids.', photo: `${PHOTO_CDN}/photo-1552053831-71594a27632d?w=800`, medical_status: 'Vaccinated, neutered' },
  { shelterIdx: 0, name: 'Luna', breed: 'Husky mix', age: 'young', size: 'medium', gender: 'female', temperament: 'Smart, vocal', description: 'Thrives on routine. Daily thyroid pill is all she needs.', photo: `${PHOTO_CDN}/photo-1583337130417-3346a1be7dee?w=800`, medical_status: 'On 0.5mg levothyroxine AM', special_needs: 'Daily thyroid medication' },
  { shelterIdx: 0, name: 'Rosie', breed: 'Chihuahua mix', age: 'puppy', size: 'small', gender: 'female', temperament: 'Shy but curious', description: '4-month-old found outside a grocery store.', photo: `${PHOTO_CDN}/photo-1558788353-f76d92427f16?w=800`, medical_status: 'Puppy vaccines, spay scheduled' },
  { shelterIdx: 1, name: 'Max', breed: 'Mastiff mix', age: 'senior', size: 'xl', gender: 'male', temperament: 'Gentle giant', description: 'A calm senior looking for a retirement couch.', medical_status: 'Hip dysplasia managed with daily joint supplement', special_needs: 'Joint support + gentle exercise' },
  { shelterIdx: 1, name: 'Charlie', breed: 'Beagle', age: 'adult', size: 'medium', gender: 'male', temperament: 'Nose-driven, food-motivated', description: 'Classic beagle — loud, loving, always hunting snacks.', medical_status: 'Vaccinated, neutered' },
  { shelterIdx: 1, name: 'Daisy', breed: 'Terrier mix', age: 'young', size: 'small', gender: 'female', temperament: 'Playful, cuddly', description: 'Bounces through life; gets along with everyone.', medical_status: 'Vaccinated, spayed' },
  { shelterIdx: 1, name: 'Finn', breed: 'Border Collie', age: 'adult', size: 'medium', gender: 'male', temperament: 'Highly intelligent', description: 'Finn needs a job — agility, fetch, or farm work.', photo: `${PHOTO_CDN}/photo-1561037404-61cd46aa615b?w=800`, medical_status: 'Vaccinated, neutered' },
  { shelterIdx: 2, name: 'Bella', breed: 'Golden Retriever', age: 'young', size: 'large', gender: 'female', temperament: 'Goofy, affectionate', description: 'Has not met a stranger. Full-body wags, every time.', photo: `${PHOTO_CDN}/photo-1587300003388-59208cc962cb?w=800`, medical_status: 'Vaccinated, spayed' },
  { shelterIdx: 2, name: 'Ollie', breed: 'German Shepherd', age: 'adult', size: 'large', gender: 'male', temperament: 'Loyal, protective', description: 'Classic shepherd with a big heart. Needs a confident handler.', photo: `${PHOTO_CDN}/photo-1548199973-03cce0bbc87b?w=800`, medical_status: 'Vaccinated, neutered' },
  { shelterIdx: 2, name: 'Piper', breed: 'Pit mix', age: 'young', size: 'medium', gender: 'female', temperament: 'Snuggly, velcro dog', description: '65 lbs of love. Best as an only dog.', medical_status: 'Vaccinated, spayed' },
]

/**
 * Declarative application plan. Index references into DOGS and FOSTERS.
 * Status distribution: 3 submitted, 2 reviewing, 3 accepted, 2 declined,
 * 5 completed = 15 total. The (dog_id, foster_id) UNIQUE constraint is
 * honored by this list. Dog-status side effects are derived below
 * (accepted → pending, completed → placed).
 */
type AppStatus = 'submitted' | 'reviewing' | 'accepted' | 'declined' | 'completed'
type AppSeed = { dogIdx: number; fosterIdx: number; status: AppStatus; daysAgoCreated: number; note: string }

const APPLICATIONS: AppSeed[] = [
  { dogIdx: 0, fosterIdx: 0, status: 'submitted', daysAgoCreated: 1, note: 'Buddy looks amazing. I have a fenced yard in south Austin.' },
  { dogIdx: 2, fosterIdx: 4, status: 'submitted', daysAgoCreated: 2, note: 'Happy to foster a shy puppy — patience is my specialty.' },
  { dogIdx: 5, fosterIdx: 1, status: 'submitted', daysAgoCreated: 2, note: 'Daisy would fit great in my condo.' },
  { dogIdx: 1, fosterIdx: 4, status: 'reviewing', daysAgoCreated: 4, note: 'Luna\'s medication routine sounds manageable. I work from home.' },
  { dogIdx: 4, fosterIdx: 2, status: 'reviewing', daysAgoCreated: 5, note: 'We have two kids who would adore a beagle.' },
  { dogIdx: 6, fosterIdx: 4, status: 'accepted', daysAgoCreated: 6, note: 'Finn is perfect — I have agility equipment and three acres.' },
  { dogIdx: 0, fosterIdx: 2, status: 'accepted', daysAgoCreated: 7, note: 'Buddy would love our kids.' },
  { dogIdx: 7, fosterIdx: 0, status: 'accepted', daysAgoCreated: 8, note: 'Goldens are my favorite breed. My yard is ready.' },
  { dogIdx: 3, fosterIdx: 3, status: 'declined', daysAgoCreated: 9, note: 'I could offer Max a quiet condo.' },
  { dogIdx: 1, fosterIdx: 2, status: 'declined', daysAgoCreated: 10, note: 'Would love to meet Luna.' },
  { dogIdx: 8, fosterIdx: 4, status: 'completed', daysAgoCreated: 30, note: 'Happy to work with Ollie — shepherd experience here.' },
  { dogIdx: 9, fosterIdx: 0, status: 'completed', daysAgoCreated: 45, note: 'Piper gets all the attention in my home.' },
  { dogIdx: 4, fosterIdx: 1, status: 'completed', daysAgoCreated: 60, note: 'Charlie sounds like the perfect apartment beagle.' },
  { dogIdx: 5, fosterIdx: 2, status: 'completed', daysAgoCreated: 75, note: 'Daisy was a delight.' },
  { dogIdx: 2, fosterIdx: 0, status: 'completed', daysAgoCreated: 90, note: 'Puppies welcome.' },
]

/**
 * Messages are only realistic on accepted/completed threads in the
 * product, so we only populate those. 8 threads × ~4 messages = ~30
 * messages. One unread message is left in each accepted thread so
 * nav badges show in QA.
 */
type MsgSeed = { appIdx: number; fromFoster: boolean; body: string; minutesAgo: number; read: boolean }

const MESSAGES: MsgSeed[] = [
  // app 5 - Finn accepted (idx=5)
  { appIdx: 5, fromFoster: true, body: 'So excited! When can I meet Finn?', minutesAgo: 60 * 24 * 5 + 30, read: true },
  { appIdx: 5, fromFoster: false, body: 'This Saturday morning, 10am work?', minutesAgo: 60 * 24 * 5, read: true },
  { appIdx: 5, fromFoster: true, body: 'Perfect — see you then!', minutesAgo: 60 * 3, read: false },
  { appIdx: 5, fromFoster: false, body: 'Bringing his medical records.', minutesAgo: 60 * 2, read: false },
  // app 6 - Buddy accepted
  { appIdx: 6, fromFoster: true, body: 'My kids are asking daily about Buddy.', minutesAgo: 60 * 24 * 6, read: true },
  { appIdx: 6, fromFoster: false, body: 'Home visit Tuesday afternoon?', minutesAgo: 60 * 24 * 5 + 60, read: true },
  { appIdx: 6, fromFoster: true, body: 'Tuesday at 3 works.', minutesAgo: 60 * 24 * 4, read: false },
  // app 7 - Bella accepted
  { appIdx: 7, fromFoster: true, body: 'Is Bella still available?', minutesAgo: 60 * 24 * 7, read: true },
  { appIdx: 7, fromFoster: false, body: 'Yes! Let\'s schedule a visit.', minutesAgo: 60 * 24 * 6 + 30, read: true },
  { appIdx: 7, fromFoster: true, body: 'Friday morning?', minutesAgo: 60 * 24 * 5, read: false },
  // app 10 - Ollie completed
  { appIdx: 10, fromFoster: true, body: 'Ollie has settled in beautifully.', minutesAgo: 60 * 24 * 25, read: true },
  { appIdx: 10, fromFoster: false, body: 'So happy to hear. Photos?', minutesAgo: 60 * 24 * 24, read: true },
  { appIdx: 10, fromFoster: true, body: 'Attached. He loves the backyard.', minutesAgo: 60 * 24 * 23, read: true },
  { appIdx: 10, fromFoster: false, body: 'Wonderful. He found his person.', minutesAgo: 60 * 24 * 20, read: true },
  // app 11 - Piper completed
  { appIdx: 11, fromFoster: true, body: 'Piper is the sweetest.', minutesAgo: 60 * 24 * 40, read: true },
  { appIdx: 11, fromFoster: false, body: 'Told you she was velcro.', minutesAgo: 60 * 24 * 39, read: true },
  { appIdx: 11, fromFoster: true, body: 'She has not left my side in a week.', minutesAgo: 60 * 24 * 38, read: true },
  { appIdx: 11, fromFoster: false, body: 'That is exactly what she needed.', minutesAgo: 60 * 24 * 35, read: true },
  // app 12 - Charlie completed
  { appIdx: 12, fromFoster: true, body: 'Charlie found every crumb in my kitchen.', minutesAgo: 60 * 24 * 55, read: true },
  { appIdx: 12, fromFoster: false, body: 'Beagles are a force of nature.', minutesAgo: 60 * 24 * 54, read: true },
  { appIdx: 12, fromFoster: true, body: 'Love him.', minutesAgo: 60 * 24 * 53, read: true },
  // app 13 - Daisy completed
  { appIdx: 13, fromFoster: true, body: 'Daisy is a little joy factory.', minutesAgo: 60 * 24 * 70, read: true },
  { appIdx: 13, fromFoster: false, body: 'So glad she is doing well.', minutesAgo: 60 * 24 * 69, read: true },
  { appIdx: 13, fromFoster: true, body: 'Miss her already.', minutesAgo: 60 * 24 * 65, read: true },
  // app 14 - Rosie completed
  { appIdx: 14, fromFoster: true, body: 'Rosie came out of her shell fast.', minutesAgo: 60 * 24 * 85, read: true },
  { appIdx: 14, fromFoster: false, body: 'You have such a gift.', minutesAgo: 60 * 24 * 84, read: true },
  { appIdx: 14, fromFoster: true, body: 'Thank you!', minutesAgo: 60 * 24 * 83, read: true },
  { appIdx: 14, fromFoster: false, body: 'Can we feature you on our socials?', minutesAgo: 60 * 24 * 82, read: true },
  { appIdx: 14, fromFoster: true, body: 'Absolutely.', minutesAgo: 60 * 24 * 81, read: true },
  { appIdx: 14, fromFoster: false, body: 'Posting this weekend!', minutesAgo: 60 * 24 * 80, read: true },
]

/**
 * 5 ratings — one per completed application (indexes 10..14). The
 * UNIQUE(application_id) constraint is honored by design.
 */
const RATINGS: { appIdx: number; score: number; comment: string }[] = [
  { appIdx: 10, score: 5, comment: 'Exceptional foster. Clear communication, great follow-through. Welcome back any time.' },
  { appIdx: 11, score: 5, comment: 'Piper came back healthy and happy. Top-tier foster.' },
  { appIdx: 12, score: 4, comment: 'Great with Charlie. Minor scheduling hiccups, nothing serious.' },
  { appIdx: 13, score: 5, comment: 'Daisy is thriving. Foster went above and beyond.' },
  { appIdx: 14, score: 5, comment: 'Turned a shy puppy into a confident dog in two months.' },
]

// --- admin helpers -------------------------------------------------------

async function findAuthUserByEmail(email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const match = data.users.find((u) => u.email === email)
    if (match) return match
    if (data.users.length < 200) break
  }
  return null
}

async function ensureAuthUser(email: string): Promise<string> {
  const existing = await findAuthUserByEmail(email)
  if (existing) return existing.id
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
  })
  if (error) throw error
  if (!data.user) throw new Error(`failed to create user ${email}`)
  return data.user.id
}

async function deleteAuthUserIfSeed(email: string): Promise<void> {
  if (!email.startsWith(SEED_PREFIX)) {
    // Defense in depth: never delete an auth user that isn't ours.
    return
  }
  const user = await findAuthUserByEmail(email)
  if (!user) return
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) console.warn(`[seed]   warning: could not delete auth user ${email}: ${error.message}`)
}

// --- reset ---------------------------------------------------------------

async function resetSeedData() {
  console.log('[seed] --reset: wiping existing seed-prefixed data')

  // Find seed shelters + fosters by email pattern so we know which ids to
  // scope delete-by-id against. Anything without the prefix stays put.
  const { data: seedShelters } = await admin
    .from('shelters')
    .select('id, email')
    .like('email', `${SEED_PREFIX}%`)
  const { data: seedFosters } = await admin
    .from('foster_parents')
    .select('id, email')
    .like('email', `${SEED_PREFIX}%`)

  const shelterIds = (seedShelters ?? []).map((s) => s.id)
  const fosterIds = (seedFosters ?? []).map((f) => f.id)

  if (shelterIds.length > 0) {
    // ratings first (no cascade back to dogs → ratings path on delete)
    await admin.from('ratings').delete().in('shelter_id', shelterIds)
    // dogs cascade to applications → messages and dog_saves via FK
    await admin.from('dogs').delete().in('shelter_id', shelterIds)
    await admin.from('shelters').delete().in('id', shelterIds)
  }
  if (fosterIds.length > 0) {
    await admin.from('foster_parents').delete().in('id', fosterIds)
  }

  for (const s of seedShelters ?? []) await deleteAuthUserIfSeed(s.email)
  for (const f of seedFosters ?? []) await deleteAuthUserIfSeed(f.email)

  console.log(
    `[seed]   wiped ${shelterIds.length} shelter(s) + ${fosterIds.length} foster(s) and their cascaded rows`,
  )
}

// --- main ----------------------------------------------------------------

async function main() {
  console.log(`[seed] target: ${SUPABASE_URL}`)
  console.log(`[seed] mode:   ${RESET ? 'RESET (wipe then insert)' : 'insert-or-skip'}\n`)

  if (RESET) await resetSeedData()

  // Idempotency guard — if the first seed shelter already exists and we
  // aren't resetting, bail.
  const { data: sentinel } = await admin
    .from('shelters')
    .select('id')
    .eq('slug', SHELTERS[0].slug)
    .maybeSingle()
  if (sentinel && !RESET) {
    console.log('[seed] seed data already present — no-op. Re-run with --reset to rebuild.')
    return
  }

  // --- shelters + auth users
  const shelterIdByIdx = new Map<number, string>()
  const shelterUserIdByIdx = new Map<number, string>()
  for (let i = 0; i < SHELTERS.length; i++) {
    const s = SHELTERS[i]
    const userId = await ensureAuthUser(s.email)
    shelterUserIdByIdx.set(i, userId)
    const { data, error } = await admin
      .from('shelters')
      .insert({
        user_id: userId,
        name: s.name,
        slug: s.slug,
        email: s.email,
        location: s.location,
        latitude: s.latitude,
        longitude: s.longitude,
        bio: s.bio,
        phone: '(555) 555-0100',
        is_verified: true,
      })
      .select('id')
      .single()
    if (error) throw error
    shelterIdByIdx.set(i, data.id)
  }
  console.log(`[seed] inserted ${SHELTERS.length} shelters`)

  // --- foster parents + auth users
  const fosterIdByIdx = new Map<number, string>()
  const fosterUserIdByIdx = new Map<number, string>()
  for (let i = 0; i < FOSTERS.length; i++) {
    const f = FOSTERS[i]
    const userId = await ensureAuthUser(f.email)
    fosterUserIdByIdx.set(i, userId)
    const { data, error } = await admin
      .from('foster_parents')
      .insert({
        user_id: userId,
        first_name: f.first_name,
        last_name: f.last_name,
        email: f.email,
        phone: '(555) 555-0200',
        location: f.location,
        latitude: f.latitude,
        longitude: f.longitude,
        housing_type: f.housing_type,
        has_yard: f.has_yard,
        has_other_pets: f.has_other_pets,
        has_children: f.has_children,
        experience: f.experience,
        bio: f.bio,
        pref_size: ['small', 'medium', 'large'],
        pref_age: ['young', 'adult'],
        pref_medical: f.experience === 'experienced',
        max_distance: 50,
      })
      .select('id')
      .single()
    if (error) throw error
    fosterIdByIdx.set(i, data.id)
  }
  console.log(`[seed] inserted ${FOSTERS.length} fosters`)

  // --- dogs
  const dogRows = DOGS.map((d) => ({
    shelter_id: shelterIdByIdx.get(d.shelterIdx),
    name: d.name,
    breed: d.breed,
    age: d.age,
    size: d.size,
    gender: d.gender,
    temperament: d.temperament,
    description: d.description,
    medical_status: d.medical_status ?? null,
    special_needs: d.special_needs ?? null,
    photos: d.photo ? [d.photo] : [],
    status: 'available' as const,
  }))
  const { data: insertedDogs, error: dogErr } = await admin
    .from('dogs')
    .insert(dogRows)
    .select('id, name')
  if (dogErr) throw dogErr
  const dogIdByIdx = new Map<number, string>()
  insertedDogs.forEach((row: { id: string; name: string }) => {
    const idx = DOGS.findIndex((d) => d.name === row.name)
    if (idx !== -1) dogIdByIdx.set(idx, row.id)
  })
  console.log(`[seed] inserted ${insertedDogs.length} dogs`)

  // --- applications
  const appRows = APPLICATIONS.map((a) => ({
    dog_id: dogIdByIdx.get(a.dogIdx),
    foster_id: fosterIdByIdx.get(a.fosterIdx),
    shelter_id: shelterIdByIdx.get(DOGS[a.dogIdx].shelterIdx),
    status: a.status,
    note: a.note,
    created_at: daysAgo(a.daysAgoCreated),
  }))
  const { data: insertedApps, error: appErr } = await admin
    .from('applications')
    .insert(appRows)
    .select('id, status, dog_id')
  if (appErr) throw appErr
  const appIdByIdx = new Map<number, string>()
  insertedApps.forEach((row: { id: string; dog_id: string; status: string }, i: number) => {
    appIdByIdx.set(i, row.id)
  })
  console.log(`[seed] inserted ${insertedApps.length} applications`)

  // --- dog status side effects (accepted → pending, completed → placed)
  for (let i = 0; i < APPLICATIONS.length; i++) {
    const a = APPLICATIONS[i]
    const dogId = dogIdByIdx.get(a.dogIdx)
    if (!dogId) continue
    if (a.status === 'accepted') {
      await admin.from('dogs').update({ status: 'pending' }).eq('id', dogId)
    } else if (a.status === 'completed') {
      await admin.from('dogs').update({ status: 'placed' }).eq('id', dogId)
    }
  }
  console.log('[seed] updated dog statuses for accepted/completed applications')

  // --- messages
  const messageRows = MESSAGES.map((m) => {
    const appIdx = m.appIdx
    const app = APPLICATIONS[appIdx]
    const fosterUserId = fosterUserIdByIdx.get(app.fosterIdx)!
    const shelterUserId = shelterUserIdByIdx.get(DOGS[app.dogIdx].shelterIdx)!
    return {
      application_id: appIdByIdx.get(appIdx),
      sender_id: m.fromFoster ? fosterUserId : shelterUserId,
      sender_role: m.fromFoster ? 'foster' : 'shelter',
      body: m.body,
      read: m.read,
      created_at: minutesAgo(m.minutesAgo),
    }
  })
  const { error: msgErr } = await admin.from('messages').insert(messageRows)
  if (msgErr) throw msgErr
  const unreadCount = messageRows.filter((m) => !m.read).length
  console.log(`[seed] inserted ${messageRows.length} messages (${unreadCount} unread)`)

  // --- ratings
  const ratingRows = RATINGS.map((r) => {
    const app = APPLICATIONS[r.appIdx]
    return {
      application_id: appIdByIdx.get(r.appIdx),
      shelter_id: shelterIdByIdx.get(DOGS[app.dogIdx].shelterIdx),
      foster_id: fosterIdByIdx.get(app.fosterIdx),
      dog_id: dogIdByIdx.get(app.dogIdx),
      score: r.score,
      comment: r.comment,
    }
  })
  const { error: ratErr } = await admin.from('ratings').insert(ratingRows)
  if (ratErr) throw ratErr
  console.log(`[seed] inserted ${ratingRows.length} ratings`)

  // --- dog saves (Phase 6.5) — every foster hearts the first dog of each
  // shelter, so the shelter list shows real aggregate counts > 0 in QA.
  const saveRows: Array<{ foster_id: string; dog_id: string }> = []
  for (let f = 0; f < FOSTERS.length; f++) {
    const fosterId = fosterIdByIdx.get(f)
    if (!fosterId) continue
    for (let s = 0; s < SHELTERS.length; s++) {
      const dogIdx = DOGS.findIndex((d) => d.shelterIdx === s)
      if (dogIdx === -1) continue
      const dogId = dogIdByIdx.get(dogIdx)
      if (!dogId) continue
      saveRows.push({ foster_id: fosterId, dog_id: dogId })
    }
  }
  if (saveRows.length > 0) {
    const { error: saveErr } = await admin
      .from('dog_saves')
      .upsert(saveRows, { onConflict: 'foster_id,dog_id', ignoreDuplicates: true })
    if (saveErr) throw saveErr
    console.log(`[seed] inserted ${saveRows.length} dog saves`)
  }

  // --- summary
  console.log('\n[seed] ===== summary =====')
  console.log(`[seed] shelters:     ${SHELTERS.length}`)
  console.log(`[seed] fosters:      ${FOSTERS.length}`)
  console.log(`[seed] dogs:         ${DOGS.length}`)
  console.log(`[seed] applications: ${APPLICATIONS.length} (3 submitted, 2 reviewing, 3 accepted, 2 declined, 5 completed)`)
  console.log(`[seed] messages:     ${MESSAGES.length} (${unreadCount} unread)`)
  console.log(`[seed] ratings:      ${RATINGS.length}`)
  console.log(`\n[seed] sign in (all accounts share password "${SEED_PASSWORD}"):`)
  for (const s of SHELTERS) console.log(`[seed]   shelter: ${s.email}`)
  for (const f of FOSTERS) console.log(`[seed]   foster:  ${f.email}`)
  console.log('[seed] done.')
}

main().catch((err: unknown) => {
  const e = err as { message?: string; details?: string; hint?: string }
  console.error('[seed] FAILED:', e?.message ?? err)
  if (e?.details) console.error('[seed]        details:', e.details)
  if (e?.hint) console.error('[seed]        hint:', e.hint)
  process.exit(1)
})
