import { notFound } from 'next/navigation'
import { FosterPortalShell } from '@/components/foster-portal-shell'
import {
  DogDetailFull,
  type DogDetailDog,
  type DogDetailShelter,
  type DogDetailShelterRating,
} from '@/components/foster/dog-detail-full'
import { DogDetailTeaser } from '@/components/foster/dog-detail-teaser'
import { createClient } from '@/lib/supabase/server'
import { getPortalLayoutData } from '@/lib/portal-layout-data'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import { getAppUrl } from '@/lib/email'

interface DogDetailPageProps {
  params: { id: string }
}

const PLACEHOLDER_DOG: DogDetailDog = {
  id: '0',
  shelter_id: 's1',
  name: 'Buddy',
  breed: 'Labrador Mix',
  age: 'adult',
  size: 'large',
  gender: 'male',
  temperament: 'Friendly, playful, great with kids.',
  medical_status: 'Vaccinated, neutered, heartworm negative.',
  special_needs: null,
  description:
    'Buddy is a 3-year-old lab mix who loves fetch and long walks. He does well with other dogs but prefers to be the only dog at meal times.',
  photos: [],
}

const PLACEHOLDER_SHELTER: DogDetailShelter = {
  id: 's1',
  name: 'Happy Paws Rescue',
  location: 'Austin, TX',
  email: null,
  slug: 'happy-paws-rescue',
}

type FullDogRow = {
  id: string
  shelter_id: string
  status: string
  name: string
  breed: string | null
  age: DogDetailDog['age']
  size: DogDetailDog['size']
  gender: DogDetailDog['gender']
  temperament: string | null
  medical_status: string | null
  special_needs: string | null
  description: string | null
  photos: string[] | null
  shelter:
    | { id: string; name: string; location: string; email: string | null; slug: string | null }
    | null
}

type TeaserDogRow = {
  id: string
  status: string
  name: string
  breed: string | null
  age: DogDetailDog['age']
  size: DogDetailDog['size']
  gender: DogDetailDog['gender']
  description: string | null
  shelter: { name: string; location: string; slug: string | null } | null
}

async function loadFullDogRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<FullDogRow | null> {
  try {
    const { data } = await supabase
      .from('dogs')
      .select(
        'id, shelter_id, status, name, breed, age, size, gender, temperament, medical_status, special_needs, description, photos, shelter:shelters(id, name, location, email, slug)',
      )
      .eq('id', id)
      .maybeSingle()
    return (data as FullDogRow | null) ?? null
  } catch (e) {
    if (isNextControlFlowError(e)) throw e
    console.error('[foster/dog] full load failed:', e instanceof Error ? e.message : String(e))
    return null
  }
}

async function loadTeaserDogRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<TeaserDogRow | null> {
  try {
    const { data } = await supabase
      .from('dogs')
      .select(
        'id, status, name, breed, age, size, gender, description, shelter:shelters(name, location, slug)',
      )
      .eq('id', id)
      .eq('status', 'available')
      .maybeSingle()
    return (data as TeaserDogRow | null) ?? null
  } catch (e) {
    if (isNextControlFlowError(e)) throw e
    console.error('[foster/dog] teaser load failed:', e instanceof Error ? e.message : String(e))
    return null
  }
}

/**
 * \`/foster/dog/[id]\` — server component that dispatches between two
 * renders on the same canonical URL:
 *
 *   - Authenticated foster: full detail inside the portal shell, with
 *     the apply dialog, temperament, medical notes, shelter rating,
 *     "already applied" indicator, and a share button.
 *   - Anyone else (logged out, logged-in shelter staff, logged-in user
 *     mid-onboarding): a public teaser with a clamped description,
 *     basic badges, shelter link, share button, and a sign-up CTA.
 *
 * Moving the route out of the \`(foster)\` group was a prerequisite —
 * that group's layout wraps every descendant in AuthGuard + RoleGuard
 * and App Router layouts cannot be escaped by child routes. Every
 * *other* foster route stays grouped with its guards intact.
 *
 * RLS details that make the teaser safe:
 *
 *   - \`dogs\` has a "fosters can read available" policy with
 *     \`USING (status = 'available')\` and no auth predicate, so the
 *     Supabase anon key can read available dogs.
 *   - Shelters are readable by everyone.
 *   - The full-view branch can still return \`pending\` / \`placed\` rows
 *     for fosters who already have an application on the dog (that
 *     flow is preserved via their own RLS policy).
 */
export default async function FosterDogDetailPage({ params }: DogDetailPageProps) {
  if (DEV_MODE) {
    return (
      <FosterPortalShell
        unreadMessages={0}
        identity={{ displayName: 'Jane Foster', avatarUrl: null, roleLabel: 'Foster' }}
      >
        <DogDetailFull
          dog={PLACEHOLDER_DOG}
          shelter={PLACEHOLDER_SHELTER}
          shelterRating={null}
          initialApplied={false}
          fosterName="Jane Foster"
          fosterId="dev-foster-1"
          canonicalUrl={`${getAppUrl()}/foster/dog/${params.id}`}
        />
      </FosterPortalShell>
    )
  }

  const supabase = await createClient()

  // This route is publicly reachable, so "no session" and "auth service
  // hiccup" must both fall through to the teaser render rather than
  // throwing. getUser() can *reject* with AuthSessionMissingError when
  // cookies are stale/cleared (e.g. right after sign-out), so we wrap
  // the call and treat any failure as an anonymous visit.
  let user: Awaited<ReturnType<typeof supabase.auth.getUser>>['data']['user'] = null
  try {
    const { data, error: authError } = await supabase.auth.getUser()
    if (authError) {
      console.warn('[foster/dog] getUser returned error, rendering teaser:', authError.message)
    } else {
      user = data.user
    }
  } catch (e) {
    if (isNextControlFlowError(e)) throw e
    console.warn(
      '[foster/dog] getUser threw, rendering teaser:',
      e instanceof Error ? e.message : String(e),
    )
  }

  // Foster dispatch: only authenticated users *with a foster profile*
  // get the full view. Everyone else — anon visitors, users between
  // signup and onboarding, shelter staff — lands on the teaser.
  let fosterRow:
    | { id: string; first_name: string | null; last_name: string | null }
    | null = null
  if (user) {
    const { data } = await supabase
      .from('foster_parents')
      .select('id, first_name, last_name')
      .eq('user_id', user.id)
      .maybeSingle()
    fosterRow = data as typeof fosterRow
  }

  if (user && fosterRow) {
    return renderFullView({ supabase, params, fosterRow })
  }

  return renderTeaser({ supabase, params })
}

// ---------------------------------------------------------------------------

async function renderFullView({
  supabase,
  params,
  fosterRow,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  params: { id: string }
  fosterRow: { id: string; first_name: string | null; last_name: string | null }
}) {
  const dogRow = await loadFullDogRow(supabase, params.id)
  if (!dogRow || !dogRow.shelter) {
    notFound()
  }

  const dog: DogDetailDog = {
    id: dogRow.id,
    shelter_id: dogRow.shelter_id,
    name: dogRow.name,
    breed: dogRow.breed,
    age: dogRow.age,
    size: dogRow.size,
    gender: dogRow.gender,
    temperament: dogRow.temperament,
    medical_status: dogRow.medical_status,
    special_needs: dogRow.special_needs,
    description: dogRow.description,
    photos: dogRow.photos ?? [],
  }
  const shelter: DogDetailShelter = {
    id: dogRow.shelter.id,
    name: dogRow.shelter.name,
    location: dogRow.shelter.location,
    email: dogRow.shelter.email,
    slug: dogRow.shelter.slug,
  }

  let shelterRating: DogDetailShelterRating | null = null
  const { data: ratingRows } = await supabase
    .from('shelter_ratings')
    .select('score')
    .eq('shelter_id', shelter.id)
  if (ratingRows && ratingRows.length > 0) {
    const scores = ratingRows.map((r) => r.score as number)
    const sum = scores.reduce((a, b) => a + b, 0)
    shelterRating = { avg: sum / scores.length, count: scores.length }
  }

  const { data: existingApp } = await supabase
    .from('applications')
    .select('id')
    .eq('dog_id', dog.id)
    .eq('foster_id', fosterRow.id)
    .limit(1)
    .maybeSingle()
  const initialApplied = !!existingApp

  const { unreadMessages, identity } = await getPortalLayoutData('foster')

  const fosterName = [fosterRow.first_name, fosterRow.last_name]
    .filter(Boolean)
    .join(' ')
    .trim()

  return (
    <FosterPortalShell unreadMessages={unreadMessages} identity={identity}>
      <DogDetailFull
        dog={dog}
        shelter={shelter}
        shelterRating={shelterRating}
        initialApplied={initialApplied}
        fosterName={fosterName}
        fosterId={fosterRow.id}
        canonicalUrl={`${getAppUrl()}/foster/dog/${dog.id}`}
      />
    </FosterPortalShell>
  )
}

async function renderTeaser({
  supabase,
  params,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>
  params: { id: string }
}) {
  const row = await loadTeaserDogRow(supabase, params.id)
  if (!row || !row.shelter) {
    notFound()
  }

  return (
    <DogDetailTeaser
      dog={{
        id: row.id,
        name: row.name,
        breed: row.breed,
        age: row.age,
        size: row.size,
        gender: row.gender,
        description: row.description,
      }}
      shelter={row.shelter}
      canonicalUrl={`${getAppUrl()}/foster/dog/${row.id}`}
    />
  )
}
