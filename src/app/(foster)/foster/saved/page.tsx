import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Heart } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { EmptyState } from '@/components/empty-state'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { BrowseDogCard } from '@/components/foster/browse-dog-card'
import { StaggerItem } from '@/components/ui/stagger-item'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import type { Dog, DogWithShelter } from '@/types/database'

export const metadata: Metadata = { title: 'Saved Dogs' }

interface SavedRow {
  saved_at: string
  dog: (Dog & {
    shelter: { name: string; logo_url: string | null; slug: string | null } | null
  }) | null
}

/**
 * Phase 6.5 — list of every dog the current foster has hearted, newest
 * save first. Reuses the browse card so the visual language matches
 * `/foster/browse`. Non-available dogs (placed/adopted) stay on the list
 * with their status badge so the foster can see why they can't apply.
 */
export default async function FosterSavedPage(): Promise<React.JSX.Element> {
  if (DEV_MODE) {
    return (
      <div className="space-y-6">
        <PageHeader />
        <p className="text-sm text-muted-foreground">
          Saved dogs require a live Supabase connection. Set
          NEXT_PUBLIC_SUPABASE_URL to enable this view.
        </p>
      </div>
    )
  }

  let dogs: DogWithShelter[] = []
  let fetchError = false

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) throw authError
    if (!user) redirect('/login')

    const { data: fosterRow, error: fosterError } = await supabase
      .from('foster_parents')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (fosterError) throw fosterError
    if (!fosterRow) redirect('/onboarding')

    const fosterId = (fosterRow as { id: string }).id

    const { data: savedRows, error: savesError } = await supabase
      .from('dog_saves')
      .select(
        'saved_at, dog:dogs(*, shelter:shelters(name, logo_url, slug))',
      )
      .eq('foster_id', fosterId)
      .order('saved_at', { ascending: false })

    if (savesError) throw savesError

    const rows = (savedRows ?? []) as unknown as SavedRow[]
    dogs = rows
      .filter((r): r is SavedRow & { dog: NonNullable<SavedRow['dog']> } => r.dog !== null)
      .map(({ dog }) => ({
        ...dog,
        shelter_name: dog.shelter?.name ?? 'Unknown shelter',
        shelter_logo_url: dog.shelter?.logo_url ?? null,
        shelter_slug: dog.shelter?.slug ?? null,
      }))
  } catch (e) {
    if (isNextControlFlowError(e)) throw e
    console.error('[foster/saved] load failed:', e instanceof Error ? e.message : String(e))
    fetchError = true
  }

  return (
    <div className="space-y-6">
      <PageHeader />

      {fetchError ? (
        <ServerErrorPanel />
      ) : dogs.length === 0 ? (
        <EmptyState
          illustration="dog"
          title="No saved dogs yet"
          description="Tap the heart on any dog to bookmark them. Saved dogs show up here so you can come back later."
          action={{ label: 'Browse Dogs', href: '/foster/browse' }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dogs.map((dog, i) => (
            <StaggerItem key={dog.id} index={i}>
              <BrowseDogCard dog={dog} />
            </StaggerItem>
          ))}
        </div>
      )}
    </div>
  )
}

function PageHeader(): React.JSX.Element {
  return (
    <div className="flex items-center gap-2">
      <Heart className="h-5 w-5 text-primary" aria-hidden />
      <h1 className="text-2xl font-bold">Saved Dogs</h1>
    </div>
  )
}
