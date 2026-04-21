import { notFound, redirect } from 'next/navigation'
import { FosterPortalShell } from '@/components/foster-portal-shell'
import {
  DogDetailFull,
  type DogDetailDog,
  type DogDetailShelter,
  type DogDetailShelterRating,
} from '@/components/foster/dog-detail-full'
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

// Supabase row fetch isolated so the page component's type narrowing
// around \`notFound()\` stays clean. Returns the joined row or null; on
// unexpected exceptions we log and treat as not-found so an outage of
// the DB doesn't surface a generic error boundary.
async function loadDogRow<TRow>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
): Promise<TRow | null> {
  try {
    const { data } = await supabase
      .from('dogs')
      .select(
        'id, shelter_id, name, breed, age, size, gender, temperament, medical_status, special_needs, description, photos, shelter:shelters(id, name, location, email, slug)',
      )
      .eq('id', id)
      .maybeSingle()
    return (data as TRow) ?? null
  } catch (e) {
    if (isNextControlFlowError(e)) throw e
    console.error('[foster/dog] load failed:', e instanceof Error ? e.message : String(e))
    return null
  }
}

/**
 * \`/foster/dog/[id]\` — server component.
 *
 * This route used to live inside the \`(foster)\` route group, which wrapped
 * every descendant in AuthGuard + RoleGuard. We moved it to a non-grouped
 * path so the same URL can serve a public teaser to logged-out visitors
 * later (see the follow-up commit that replaces the redirects below).
 * Every other foster route remains inside \`(foster)\` with its guards
 * intact.
 *
 * For this commit, the page still behaves like the old version for end
 * users: authenticated fosters see the full detail inside the portal
 * shell; anyone else bounces to \`/login\` (logged out) or \`/onboarding\`
 * (logged in without a foster profile). The teaser lands in the next
 * step.
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
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  // AuthGuard equivalent: not logged in → /login, preserving the pre-move
  // UX. The teaser variant replaces this branch in the follow-up commit.
  if (authError) throw authError
  if (!user) {
    redirect(`/login?next=/foster/dog/${params.id}`)
  }

  const { data: fosterRow } = await supabase
    .from('foster_parents')
    .select('id, first_name, last_name')
    .eq('user_id', user.id)
    .maybeSingle()

  // RoleGuard equivalent: logged in but no foster profile. Preserves the
  // old behavior until the teaser takes over this branch.
  if (!fosterRow) {
    redirect('/onboarding')
  }

  type DogRow = {
    id: string
    shelter_id: string
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

  const dogRow = await loadDogRow<DogRow>(supabase, params.id)
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

  // Shelter rating aggregate — silently tolerates empty / RLS-blocked
  // reads, same as the original client-side load.
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

  // Already applied? Server-check so the first paint is correct.
  const { data: existingApp } = await supabase
    .from('applications')
    .select('id')
    .eq('dog_id', dog.id)
    .eq('foster_id', fosterRow.id)
    .limit(1)
    .maybeSingle()
  const initialApplied = !!existingApp

  // Portal chrome data (sidebar identity + unread count). Uses the shared
  // helper so we match exactly what the (foster)/ layout renders.
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
