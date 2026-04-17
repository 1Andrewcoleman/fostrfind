#!/usr/bin/env node
/**
 * seed-demo-data.mjs
 *
 * Populates the master dev shelter + foster accounts with realistic
 * demo data so every major UI surface has something to render.
 *
 * Seeded:
 *   - 12 dogs (mix of sizes/ages/genders/statuses; 6 with photos)
 *   - 6 applications spanning all 5 statuses
 *   - 10 messages (1 unread, spread across accepted + completed threads)
 *   - 1 rating on a completed placement
 *   - Richer shelter + foster profile fields
 *
 * Usage:
 *   node scripts/seed-demo-data.mjs           # idempotent — no-op if dogs exist
 *   node scripts/seed-demo-data.mjs --reset   # wipe dogs for the master shelter, then reseed
 *
 * Safety guards:
 *   - Only acts on users whose email matches DEV_MASTER_*_EMAIL in .env.local
 *   - Refuses to delete anything unless the shelter's email matches the expected dev master
 *
 * Requirements in .env.local:
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 *   - Master dev accounts already created (run setup-master-accounts.mjs first)
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env.local')

// ---- Load .env.local ----------------------------------------------------

if (!existsSync(envPath)) {
  console.error(`[seed] .env.local not found at ${envPath}`)
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
const SHELTER_EMAIL = envMap.DEV_MASTER_SHELTER_EMAIL || 'dev-shelter@fostrfix.local'
const FOSTER_EMAIL = envMap.DEV_MASTER_FOSTER_EMAIL || 'dev-foster@fostrfix.local'

if (!SUPABASE_URL?.startsWith('http')) {
  console.error('[seed] NEXT_PUBLIC_SUPABASE_URL missing or invalid')
  process.exit(1)
}
if (!SERVICE_ROLE_KEY || SERVICE_ROLE_KEY.length < 20) {
  console.error('[seed] SUPABASE_SERVICE_ROLE_KEY missing or invalid')
  process.exit(1)
}

const RESET = process.argv.includes('--reset')

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ---- Helpers ------------------------------------------------------------

function daysAgo(days) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}
function minutesAgo(mins) {
  return new Date(Date.now() - mins * 60 * 1000).toISOString()
}

async function findAuthUserByEmail(email) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    const match = data.users.find((u) => u.email === email)
    if (match) return match
    if (data.users.length < 200) break
  }
  return null
}

// ---- Data definitions ---------------------------------------------------

// Known-good Unsplash dog photo URLs (free to use).
const PHOTO = {
  buddy: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=800',
  luna: 'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=800',
  rosie: 'https://images.unsplash.com/photo-1558788353-f76d92427f16?w=800',
  finn: 'https://images.unsplash.com/photo-1561037404-61cd46aa615b?w=800',
  bella: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=800',
  ollie: 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=800',
}

/**
 * Full dog roster. Statuses for Finn/Ollie/Piper are overwritten to
 * `pending`/`placed` after applications are inserted, mirroring what the
 * real accept/complete API routes do.
 */
const DOGS = [
  {
    name: 'Buddy',
    breed: 'Labrador Retriever',
    age: 'adult',
    size: 'large',
    gender: 'male',
    temperament: 'Friendly, high energy, loves to swim',
    medical_status: 'Vaccinated, neutered, heartworm negative',
    description:
      'Buddy is a classic Lab: ball-obsessed, affectionate, and great with kids. He needs a home with space to run.',
    photos: [PHOTO.buddy],
    status: 'available',
  },
  {
    name: 'Luna',
    breed: 'Husky mix',
    age: 'young',
    size: 'medium',
    gender: 'female',
    temperament: 'Smart, vocal, independent',
    medical_status: 'Vaccinated, spayed, on thyroid medication',
    special_needs: 'Needs daily medication (0.5mg levothyroxine, AM)',
    description:
      'Luna is a bright, talkative girl who thrives on routine. Her thyroid condition is well-managed with a cheap daily pill.',
    photos: [PHOTO.luna],
    status: 'available',
  },
  {
    name: 'Max',
    breed: 'Mastiff mix',
    age: 'senior',
    size: 'xl',
    gender: 'male',
    temperament: 'Gentle giant, couch potato',
    medical_status: 'Hip dysplasia managed with daily joint supplement and pain meds',
    description:
      'Max is an older soul looking for a calm retirement home. He drools, he snores, and he will love you unconditionally.',
    photos: [],
    status: 'available',
  },
  {
    name: 'Rosie',
    breed: 'Chihuahua mix',
    age: 'puppy',
    size: 'small',
    gender: 'female',
    temperament: 'Shy but curious, warms up quickly',
    medical_status: 'Up to date on puppy vaccines, spay scheduled',
    description:
      'Rosie is a 4-month-old found outside a grocery store. She is coming out of her shell and needs a patient foster.',
    photos: [PHOTO.rosie],
    status: 'available',
  },
  {
    name: 'Charlie',
    breed: 'Beagle',
    age: 'adult',
    size: 'medium',
    gender: 'male',
    temperament: 'Nose-driven, food-motivated, vocal',
    medical_status: 'Vaccinated, neutered',
    description:
      'Charlie is a classic beagle — loud, loving, and always on the hunt for snacks. Best for homes without small cats.',
    photos: [],
    status: 'available',
  },
  {
    name: 'Daisy',
    breed: 'Terrier mix',
    age: 'young',
    size: 'small',
    gender: 'female',
    temperament: 'Playful, cuddly, social',
    medical_status: 'Vaccinated, spayed',
    description:
      'Daisy bounces through life. She gets along with everyone she meets.',
    photos: [],
    status: 'available',
  },
  {
    name: 'Finn',
    breed: 'Border Collie',
    age: 'adult',
    size: 'medium',
    gender: 'male',
    temperament: 'Highly intelligent, eager to work',
    medical_status: 'Vaccinated, neutered',
    description:
      'Finn needs a job. He thrives with agility, fetch, or farm work. Not a fit for sedentary homes.',
    photos: [PHOTO.finn],
    status: 'available', // overridden to 'pending' after applications inserted
  },
  {
    name: 'Bella',
    breed: 'Golden Retriever',
    age: 'young',
    size: 'large',
    gender: 'female',
    temperament: 'Goofy, affectionate, loves water',
    medical_status: 'Vaccinated, spayed',
    description:
      'Bella has not met a stranger. She greets everyone with a full-body tail wag.',
    photos: [PHOTO.bella],
    status: 'available',
  },
  {
    name: 'Cooper',
    breed: 'Spaniel mix',
    age: 'adult',
    size: 'medium',
    gender: 'male',
    temperament: 'Quiet, gentle, observant',
    medical_status: 'Vaccinated, neutered',
    description:
      'Cooper was surrendered when his owner moved. He is still adjusting and needs a calm home.',
    photos: [],
    status: 'available',
  },
  {
    name: 'Ruby',
    breed: 'Terrier mix',
    age: 'adult',
    size: 'small',
    gender: 'female',
    temperament: 'Sassy, selective, loyal',
    medical_status: 'Vaccinated, spayed',
    description:
      'Ruby picks her people but once she picks you, she is yours forever. No kids, no other dogs.',
    photos: [],
    status: 'available',
  },
  {
    name: 'Ollie',
    breed: 'German Shepherd',
    age: 'adult',
    size: 'large',
    gender: 'male',
    temperament: 'Loyal, protective, needs training',
    medical_status: 'Vaccinated, neutered',
    description:
      'Ollie is a classic shepherd with a big heart. He needs consistent training and a confident handler.',
    photos: [PHOTO.ollie],
    status: 'available', // overridden to 'placed'
  },
  {
    name: 'Piper',
    breed: 'Pit mix',
    age: 'young',
    size: 'medium',
    gender: 'female',
    temperament: 'Snuggly, silly, velcro dog',
    medical_status: 'Vaccinated, spayed',
    description:
      'Piper is 65 pounds of love. She is best as an only dog who gets all the attention.',
    photos: [],
    status: 'available', // overridden to 'placed'
  },
]

const APPLICATIONS = [
  {
    dogName: 'Cooper',
    status: 'submitted',
    note: "Hi! I'd love to foster Cooper. I have experience with quiet dogs and a peaceful home — no kids, one mellow cat.",
    daysAgoCreated: 1,
  },
  {
    dogName: 'Bella',
    status: 'reviewing',
    note: 'Bella looks perfect for our fenced yard and active household. We swim with our dogs at the greenbelt weekly!',
    daysAgoCreated: 3,
  },
  {
    dogName: 'Finn',
    status: 'accepted',
    note: 'So excited to bring Finn home! I have a flirt pole, agility gear, and three acres.',
    daysAgoCreated: 5,
  },
  {
    dogName: 'Ruby',
    status: 'declined',
    note: "I'd love to foster Ruby if she's still available. I live alone and work from home.",
    daysAgoCreated: 7,
  },
  {
    dogName: 'Ollie',
    status: 'completed',
    note: 'Happy to foster Ollie — I grew up with shepherds.',
    daysAgoCreated: 10,
  },
  {
    dogName: 'Piper',
    status: 'completed',
    note: 'Piper is welcome in my home. I will spoil her.',
    daysAgoCreated: 14,
  },
]

// Dog status overrides after applications land.
const DOG_STATUS_AFTER_APPS = {
  Finn: 'pending',
  Ollie: 'placed',
  Piper: 'placed',
}

// fromFoster = true means foster authored this message (sender_role: 'foster')
// `read` is the state of the OTHER party seeing the message — unread messages
// drive both parties' nav badges and thread list highlights.
const MESSAGES_BY_DOG = {
  Finn: [
    { fromFoster: true, body: 'Hi! Is Finn still available? I’d love to meet him.', minutesAgo: 60 * 24 * 4 + 30, read: true },
    { fromFoster: false, body: 'Yes he is! Are you free Saturday morning for a home visit?', minutesAgo: 60 * 24 * 4, read: true },
    // Foster → shelter, unread by shelter → shelter nav badge = 1
    { fromFoster: true, body: 'Saturday at 10am works great. Anything I should bring?', minutesAgo: 60 * 3, read: false },
    // Shelter → foster, unread by foster → foster nav badge = 1
    { fromFoster: false, body: 'Perfect — see you then. I’ll bring his medical records and favorite toy.', minutesAgo: 60 * 2, read: false },
  ],
  Ollie: [
    { fromFoster: true, body: 'Excited to foster Ollie. When can I pick him up?', minutesAgo: 60 * 24 * 9, read: true },
    { fromFoster: false, body: 'He’s ready whenever you are. I’ll send his feeding schedule this afternoon.', minutesAgo: 60 * 24 * 8 + 30, read: true },
    { fromFoster: true, body: 'Thanks! I’ll swing by tomorrow at 2.', minutesAgo: 60 * 24 * 8, read: true },
  ],
  Piper: [
    { fromFoster: true, body: 'I’d love to foster Piper.', minutesAgo: 60 * 24 * 13, read: true },
    { fromFoster: false, body: 'She’s all yours — Friday pickup?', minutesAgo: 60 * 24 * 12 + 60, read: true },
    { fromFoster: true, body: 'See you Friday!', minutesAgo: 60 * 24 * 12, read: true },
  ],
}

const RATING = {
  dogName: 'Piper',
  score: 5,
  comment:
    'Amazing foster — Piper came back happy, healthy, and well-adjusted. Would place with Dev Foster again in a heartbeat.',
}

// ---- Profile enrichment -------------------------------------------------

async function enrichShelterProfile(shelterRow) {
  const { error } = await admin
    .from('shelters')
    .update({
      phone: '(512) 555-0199',
      website: 'https://example.org',
      instagram: '@devshelter',
      ein: '12-3456789',
      latitude: 30.2672,
      longitude: -97.7431,
      bio:
        'Dev Shelter (Master) is a small-breed-focused rescue in Austin, TX. ' +
        'We serve as the primary seeded dataset for the Fostr Fix development environment — ' +
        'every dog and application you see here is fabricated for UI preview purposes.',
    })
    .eq('id', shelterRow.id)
  if (error) throw error
  console.log('[seed]   shelter profile enriched')
}

async function enrichFosterProfile(fosterRow) {
  const { error } = await admin
    .from('foster_parents')
    .update({
      phone: '(512) 555-0142',
      housing_type: 'house',
      has_yard: true,
      has_other_pets: true,
      other_pets_info: 'One older cat, very dog-friendly',
      has_children: false,
      experience: 'some',
      bio:
        'Full-time remote worker based in south Austin. Fostered two shepherds and a beagle ' +
        'over the last few years — comfortable with medication, reactivity, and crate-training.',
      pref_size: ['small', 'medium'],
      pref_age: ['young', 'adult'],
      pref_medical: true,
      max_distance: 30,
      latitude: 30.2672,
      longitude: -97.7431,
    })
    .eq('id', fosterRow.id)
  if (error) throw error
  console.log('[seed]   foster profile enriched')
}

// ---- Main ---------------------------------------------------------------

async function main() {
  console.log(`[seed] connecting to ${SUPABASE_URL}`)
  console.log(`[seed] reset mode: ${RESET ? 'ON (will wipe existing dogs)' : 'off'}`)

  // 1. Resolve master users
  const shelterUser = await findAuthUserByEmail(SHELTER_EMAIL)
  const fosterUser = await findAuthUserByEmail(FOSTER_EMAIL)
  if (!shelterUser || !fosterUser) {
    console.error(
      '[seed] master dev accounts not found — run scripts/setup-master-accounts.mjs first',
    )
    process.exit(1)
  }

  // 2. Resolve profile rows
  const { data: shelterRow, error: shelterErr } = await admin
    .from('shelters')
    .select('id, email')
    .eq('user_id', shelterUser.id)
    .single()
  if (shelterErr || !shelterRow) throw shelterErr ?? new Error('shelter row missing')
  if (shelterRow.email !== SHELTER_EMAIL) {
    throw new Error(
      `safety guard: shelter row email (${shelterRow.email}) does not match expected dev master (${SHELTER_EMAIL})`,
    )
  }

  const { data: fosterRow, error: fosterErr } = await admin
    .from('foster_parents')
    .select('id, email')
    .eq('user_id', fosterUser.id)
    .single()
  if (fosterErr || !fosterRow) throw fosterErr ?? new Error('foster row missing')
  if (fosterRow.email !== FOSTER_EMAIL) {
    throw new Error(
      `safety guard: foster row email (${fosterRow.email}) does not match expected dev master (${FOSTER_EMAIL})`,
    )
  }

  const shelterId = shelterRow.id
  const fosterId = fosterRow.id
  console.log(`[seed] shelter.id=${shelterId}  foster.id=${fosterId}`)

  // 3. Profile enrichment (always run — idempotent update)
  await enrichShelterProfile(shelterRow)
  await enrichFosterProfile(fosterRow)

  // 4. Check existing dogs
  const { count: existingDogCount } = await admin
    .from('dogs')
    .select('*', { count: 'exact', head: true })
    .eq('shelter_id', shelterId)

  if ((existingDogCount ?? 0) > 0 && !RESET) {
    console.log(
      `[seed] shelter already has ${existingDogCount} dog(s) — skipping insert. ` +
        `Re-run with --reset to wipe and reseed.`,
    )
    console.log('[seed] done.')
    return
  }

  if ((existingDogCount ?? 0) > 0 && RESET) {
    console.log(`[seed] --reset: deleting ${existingDogCount} existing dog(s) for shelter ${shelterId}`)
    // Ratings FK to dogs has no cascade — delete them explicitly first,
    // then drop dogs (which cascades applications → messages).
    const { error: ratingsDelErr } = await admin
      .from('ratings')
      .delete()
      .eq('shelter_id', shelterId)
    if (ratingsDelErr) throw ratingsDelErr
    const { error: delErr } = await admin.from('dogs').delete().eq('shelter_id', shelterId)
    if (delErr) throw delErr
  }

  // 5. Insert dogs
  const dogRows = DOGS.map((d) => ({ ...d, shelter_id: shelterId }))
  const { data: insertedDogs, error: dogErr } = await admin
    .from('dogs')
    .insert(dogRows)
    .select('id, name')
  if (dogErr) throw dogErr
  console.log(`[seed] inserted ${insertedDogs.length} dogs`)
  const dogIdByName = new Map(insertedDogs.map((d) => [d.name, d.id]))

  // 6. Insert applications
  const appRows = APPLICATIONS.map((a) => ({
    dog_id: dogIdByName.get(a.dogName),
    foster_id: fosterId,
    shelter_id: shelterId,
    status: a.status,
    note: a.note,
    created_at: daysAgo(a.daysAgoCreated),
  }))
  const { data: insertedApps, error: appErr } = await admin
    .from('applications')
    .insert(appRows)
    .select('id, dog_id, status')
  if (appErr) throw appErr
  console.log(`[seed] inserted ${insertedApps.length} applications`)
  const appIdByDogName = new Map()
  for (const app of insertedApps) {
    for (const [name, id] of dogIdByName.entries()) {
      if (id === app.dog_id) appIdByDogName.set(name, app.id)
    }
  }

  // 7. Apply dog status overrides (simulating accept → pending, complete → placed)
  for (const [name, newStatus] of Object.entries(DOG_STATUS_AFTER_APPS)) {
    const id = dogIdByName.get(name)
    if (!id) continue
    const { error } = await admin.from('dogs').update({ status: newStatus }).eq('id', id)
    if (error) throw error
  }
  console.log(`[seed] updated dog statuses: Finn → pending, Ollie/Piper → placed`)

  // 8. Insert messages
  const messageRows = []
  for (const [dogName, msgs] of Object.entries(MESSAGES_BY_DOG)) {
    const applicationId = appIdByDogName.get(dogName)
    if (!applicationId) continue
    for (const m of msgs) {
      messageRows.push({
        application_id: applicationId,
        sender_id: m.fromFoster ? fosterUser.id : shelterUser.id,
        sender_role: m.fromFoster ? 'foster' : 'shelter',
        body: m.body,
        read: m.read,
        created_at: minutesAgo(m.minutesAgo),
      })
    }
  }
  const { error: msgErr } = await admin.from('messages').insert(messageRows)
  if (msgErr) throw msgErr
  const unreadCount = messageRows.filter((m) => !m.read).length
  console.log(`[seed] inserted ${messageRows.length} messages (${unreadCount} unread)`)

  // 9. Insert rating (for Piper's completed application)
  const piperAppId = appIdByDogName.get(RATING.dogName)
  const piperDogId = dogIdByName.get(RATING.dogName)
  if (piperAppId && piperDogId) {
    const { error: ratingErr } = await admin.from('ratings').insert({
      application_id: piperAppId,
      shelter_id: shelterId,
      foster_id: fosterId,
      dog_id: piperDogId,
      score: RATING.score,
      comment: RATING.comment,
    })
    if (ratingErr) throw ratingErr
    console.log('[seed] inserted 1 rating (Piper, 5★)')
  }

  // 10. Summary
  console.log('\n[seed] ===== summary =====')
  console.log(`[seed] dogs:         ${insertedDogs.length}`)
  console.log(`[seed] applications: ${insertedApps.length}`)
  console.log(`[seed] messages:     ${messageRows.length}  (${messageRows.filter((m) => !m.read).length} unread)`)
  console.log(`[seed] ratings:      1`)
  console.log('[seed] done.')
}

main().catch((err) => {
  console.error('[seed] FAILED:', err?.message ?? err)
  if (err?.details) console.error('[seed]        details:', err.details)
  if (err?.hint) console.error('[seed]        hint:', err.hint)
  process.exit(1)
})
