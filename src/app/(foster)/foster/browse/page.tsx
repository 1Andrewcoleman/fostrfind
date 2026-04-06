'use client'

import { useState, useEffect, useMemo } from 'react'
import { FilterSidebar, type FilterState } from '@/components/foster/filter-sidebar'
import { BrowseDogCard } from '@/components/foster/browse-dog-card'
import { EmptyState } from '@/components/empty-state'
import { createClient } from '@/lib/supabase/client'
import type { DogWithShelter } from '@/types/database'

const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')

const PLACEHOLDER_DOGS: DogWithShelter[] = [
  {
    id: '1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    shelter_id: 's1', name: 'Buddy', breed: 'Labrador Mix', age: 'adult', size: 'large',
    gender: 'male', temperament: 'Friendly and playful', medical_status: 'Vaccinated',
    special_needs: null, description: 'A sweet boy who loves walks.',
    photos: [], status: 'available', shelter_name: 'Happy Paws Rescue',
    shelter_logo_url: null, distance_miles: 5,
  },
  {
    id: '2', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    shelter_id: 's2', name: 'Luna', breed: 'Beagle', age: 'puppy', size: 'small',
    gender: 'female', temperament: 'Energetic and curious', medical_status: 'Vaccinated, spayed',
    special_needs: null, description: 'Luna loves to play and explore.',
    photos: [], status: 'available', shelter_name: 'Austin Animal Rescue',
    shelter_logo_url: null, distance_miles: 12,
  },
  {
    id: '3', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    shelter_id: 's1', name: 'Max', breed: 'German Shepherd Mix', age: 'senior', size: 'large',
    gender: 'male', temperament: 'Calm and gentle', medical_status: 'On daily medication',
    special_needs: 'Needs medication twice daily', description: 'Max is a calm senior dog.',
    photos: [], status: 'available', shelter_name: 'Happy Paws Rescue',
    shelter_logo_url: null, distance_miles: 5,
  },
]

export default function BrowsePage() {
  const [dogs, setDogs] = useState<DogWithShelter[]>(DEV_MODE ? PLACEHOLDER_DOGS : [])
  const [loadingDogs, setLoadingDogs] = useState(!DEV_MODE)
  const [filters, setFilters] = useState<FilterState>({
    sizes: [], ages: [], gender: null, medicalOk: false,
  })

  useEffect(() => {
    if (DEV_MODE) return
    async function fetchDogs() {
      const supabase = createClient()
      const { data } = await supabase
        .from('dogs')
        .select('*, shelter:shelters(name, logo_url)')
        .eq('status', 'available')
        .order('created_at', { ascending: false })

      const mapped: DogWithShelter[] = (data ?? []).map((row: Record<string, unknown>) => {
        const shelter = row.shelter as { name: string; logo_url: string | null } | null
        return {
          ...(row as unknown as DogWithShelter),
          shelter_name: shelter?.name ?? 'Unknown Shelter',
          shelter_logo_url: shelter?.logo_url ?? null,
        }
      })
      setDogs(mapped)
      setLoadingDogs(false)
    }
    fetchDogs()
  }, [])

  const filteredDogs = useMemo(() => dogs.filter((dog) => {
    if (filters.sizes.length > 0 && dog.size && !filters.sizes.includes(dog.size)) return false
    if (filters.ages.length > 0 && dog.age && !filters.ages.includes(dog.age)) return false
    if (filters.gender && dog.gender !== filters.gender) return false
    return true
  }), [dogs, filters])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Browse Dogs</h1>
        <p className="text-muted-foreground">
          {loadingDogs ? 'Loading...' : `${filteredDogs.length} dog${filteredDogs.length !== 1 ? 's' : ''} available near you`}
        </p>
      </div>

      <div className="flex gap-6">
        <FilterSidebar onFilterChange={setFilters} />

        <div className="flex-1">
          {!loadingDogs && filteredDogs.length === 0 ? (
            <EmptyState
              title="No dogs match your filters"
              description="Try adjusting your filters to see more results."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDogs.map((dog) => (
                <BrowseDogCard key={dog.id} dog={dog} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
