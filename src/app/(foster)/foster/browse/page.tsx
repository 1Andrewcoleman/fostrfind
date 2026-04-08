'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { X, SlidersHorizontal } from 'lucide-react'
import {
  FilterSidebar,
  BrowseFilterForm,
  DEFAULT_FILTERS,
  type FilterState,
} from '@/components/foster/filter-sidebar'
import { BrowseDogCard } from '@/components/foster/browse-dog-card'
import { EmptyState } from '@/components/empty-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/client'
import { DOG_SIZE_LABELS, DOG_AGE_LABELS } from '@/lib/constants'
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

// ---------------------------------------------------------------------------
// URL <-> FilterState helpers
// ---------------------------------------------------------------------------

function parseFiltersFromParams(params: URLSearchParams): FilterState {
  const sizes = params.get('sizes')?.split(',').filter(Boolean) ?? []
  const ages = params.get('ages')?.split(',').filter(Boolean) ?? []
  const gender = params.get('gender') || null
  const medicalOk = params.get('medicalOk') === '1'
  return { sizes, ages, gender, medicalOk }
}

function filtersToParams(filters: FilterState): string {
  const params = new URLSearchParams()
  if (filters.sizes.length > 0) params.set('sizes', filters.sizes.join(','))
  if (filters.ages.length > 0) params.set('ages', filters.ages.join(','))
  if (filters.gender) params.set('gender', filters.gender)
  if (filters.medicalOk) params.set('medicalOk', '1')
  return params.toString()
}

// ---------------------------------------------------------------------------
// Browse grid skeleton shown while dogs are loading
// ---------------------------------------------------------------------------

function BrowseGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-xl border p-4 space-y-3">
          <Skeleton className="h-40 w-full rounded-lg" />
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-14 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function BrowsePage() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [dogs, setDogs] = useState<DogWithShelter[]>(DEV_MODE ? PLACEHOLDER_DOGS : [])
  const [loadingDogs, setLoadingDogs] = useState(!DEV_MODE)
  const [filters, setFilters] = useState<FilterState>(() =>
    parseFiltersFromParams(searchParams),
  )
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  // Keep URL in sync whenever filters change
  const handleFilterChange = useCallback(
    (next: FilterState) => {
      setFilters(next)
      const qs = filtersToParams(next)
      router.replace(qs ? `/foster/browse?${qs}` : '/foster/browse', {
        scroll: false,
      })
    },
    [router],
  )

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
    if (!filters.medicalOk && dog.special_needs) return false
    return true
  }), [dogs, filters])

  const hasActiveFilters =
    filters.sizes.length > 0 ||
    filters.ages.length > 0 ||
    !!filters.gender ||
    filters.medicalOk

  function removeSize(value: string) {
    handleFilterChange({ ...filters, sizes: filters.sizes.filter((s) => s !== value) })
  }
  function removeAge(value: string) {
    handleFilterChange({ ...filters, ages: filters.ages.filter((a) => a !== value) })
  }
  function removeGender() {
    handleFilterChange({ ...filters, gender: null })
  }
  function removeMedical() {
    handleFilterChange({ ...filters, medicalOk: false })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Browse Dogs</h1>
        <p className="text-muted-foreground">
          Find your next foster companion from shelters near you.
        </p>
      </div>

      <div className="flex gap-6">
        <FilterSidebar filters={filters} onFilterChange={handleFilterChange} />

        <div className="flex-1 space-y-4 pb-20 md:pb-0">
          {/* Results bar with count + active filter chips */}
          {!loadingDogs && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground mr-1">
                {filteredDogs.length} dog{filteredDogs.length !== 1 ? 's' : ''} found
              </span>

              {filters.sizes.map((size) => (
                <Badge key={`s-${size}`} variant="secondary" className="gap-1 pr-1">
                  {DOG_SIZE_LABELS[size] ?? size}
                  <button onClick={() => removeSize(size)} className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5">
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove {DOG_SIZE_LABELS[size]} filter</span>
                  </button>
                </Badge>
              ))}

              {filters.ages.map((age) => (
                <Badge key={`a-${age}`} variant="secondary" className="gap-1 pr-1">
                  {DOG_AGE_LABELS[age] ?? age}
                  <button onClick={() => removeAge(age)} className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5">
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove {DOG_AGE_LABELS[age]} filter</span>
                  </button>
                </Badge>
              ))}

              {filters.gender && (
                <Badge variant="secondary" className="gap-1 pr-1 capitalize">
                  {filters.gender}
                  <button onClick={removeGender} className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5">
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove gender filter</span>
                  </button>
                </Badge>
              )}

              {filters.medicalOk && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  Including special needs
                  <button onClick={removeMedical} className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5">
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove medical filter</span>
                  </button>
                </Badge>
              )}

              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs h-auto py-1 px-2"
                  onClick={() => handleFilterChange(DEFAULT_FILTERS)}
                >
                  Clear all
                </Button>
              )}
            </div>
          )}

          {loadingDogs ? (
            <BrowseGridSkeleton />
          ) : filteredDogs.length === 0 ? (
            <EmptyState
              title="No dogs match your filters"
              description="Try adjusting your filters to see more results."
              action={{
                label: 'Clear all filters',
                onClick: () => handleFilterChange(DEFAULT_FILTERS),
              }}
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

      {/* Mobile floating filter button */}
      <Button
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40 md:hidden shadow-lg gap-2 rounded-full px-5"
        onClick={() => setFilterSheetOpen(true)}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Filters
        {hasActiveFilters && (
          <span className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary-foreground text-primary text-xs font-semibold">
            {filters.sizes.length + filters.ages.length + (filters.gender ? 1 : 0) + (filters.medicalOk ? 1 : 0)}
          </span>
        )}
      </Button>

      {/* Mobile filter sheet */}
      <Sheet open={filterSheetOpen} onOpenChange={setFilterSheetOpen}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-xl">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-display">Filters</SheetTitle>
          </SheetHeader>
          <BrowseFilterForm
            filters={filters}
            onFilterChange={handleFilterChange}
            idPrefix="sheet-"
          />
          <div className="pt-5">
            <Button className="w-full" onClick={() => setFilterSheetOpen(false)}>
              Done
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
