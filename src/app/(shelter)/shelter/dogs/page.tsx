import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/empty-state'
import {
  ShelterDogsTabs,
  type PlacedDogEntry,
} from '@/components/shelter/shelter-dogs-tabs'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import type { Dog } from '@/types/database'

interface CompletedAppRow {
  dog_id: string
  // Supabase returns nested selects as arrays even when the FK is one-to-one.
  foster: { first_name: string | null; last_name: string | null }[] | null
}

export default async function ShelterDogsPage() {
  let activeDogs: Dog[] = []
  let placedDogs: PlacedDogEntry[] = []
  let hasAnyDogs = false

  if (!DEV_MODE) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (user) {
      const { data: shelterRow } = await supabase
        .from('shelters')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (shelterRow) {
        // Fetch ALL dogs for this shelter in a single query; partition in JS.
        const { data: allDogsData } = await supabase
          .from('dogs')
          .select('*')
          .eq('shelter_id', shelterRow.id)
          .order('created_at', { ascending: false })

        const allDogs = (allDogsData ?? []) as Dog[]
        hasAnyDogs = allDogs.length > 0

        const placedList = allDogs.filter((d) =>
          ['placed', 'adopted'].includes(d.status),
        )
        activeDogs = allDogs.filter((d) =>
          ['available', 'pending'].includes(d.status),
        )

        // Enrich placed dogs with their completed-application foster names.
        if (placedList.length > 0) {
          const placedIds = placedList.map((d) => d.id)
          const { data: completedAppsData } = await supabase
            .from('applications')
            .select('dog_id, foster:foster_parents(first_name, last_name)')
            .in('dog_id', placedIds)
            .eq('status', 'completed')

          const fosterByDog = new Map<string, string>()
          for (const row of (completedAppsData ?? []) as CompletedAppRow[]) {
            const foster = row.foster?.[0]
            if (!foster) continue
            const name = `${foster.first_name ?? ''} ${foster.last_name ?? ''}`.trim()
            if (name && !fosterByDog.has(row.dog_id)) {
              fosterByDog.set(row.dog_id, name)
            }
          }

          placedDogs = placedList.map((dog) => ({
            dog,
            fosterName: fosterByDog.get(dog.id) ?? 'a foster parent',
          }))
        }
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Dogs</h1>
        <Button asChild>
          <Link href="/shelter/dogs/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Dog
          </Link>
        </Button>
      </div>

      {!hasAnyDogs && !DEV_MODE ? (
        <EmptyState
          title="No dogs found"
          description="Add your first dog listing to start receiving foster applications."
          action={{ label: 'Add Dog', href: '/shelter/dogs/new' }}
        />
      ) : (
        <ShelterDogsTabs activeDogs={activeDogs} placedDogs={placedDogs} />
      )}
    </div>
  )
}
