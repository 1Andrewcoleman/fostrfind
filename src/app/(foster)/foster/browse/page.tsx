'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { X, SlidersHorizontal, Loader2 } from 'lucide-react'
import {
  FilterSidebar,
  BrowseFilterForm,
} from '@/components/foster/filter-sidebar'
import {
  DEFAULT_FILTERS,
  filtersToParams,
  isFilterActive,
  parseFiltersFromParams,
  type FilterState,
} from '@/lib/browse-filters'
import { BrowseDogCard } from '@/components/foster/browse-dog-card'
import { EmptyState } from '@/components/empty-state'
import { StaggerItem } from '@/components/ui/stagger-item'
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
import { DEV_MODE, DOG_SIZE_LABELS, DOG_AGE_LABELS } from '@/lib/constants'
import { haversineMiles } from '@/lib/helpers'
import type { DogWithShelter } from '@/types/database'

const PAGE_SIZE = 24

const PLACEHOLDER_DOGS: DogWithShelter[] = [
  {
    id: '1', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    shelter_id: 's1', name: 'Buddy', breed: 'Labrador Mix', age: 'adult', size: 'large',
    gender: 'male', temperament: 'Friendly and playful', medical_status: 'Vaccinated',
    special_needs: null, description: 'A sweet boy who loves walks.',
    photos: [], status: 'available', shelter_name: 'Happy Paws Rescue',
    shelter_logo_url: null, shelter_slug: 'happy-paws-rescue', distance_miles: 5,
  },
  {
    id: '2', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    shelter_id: 's2', name: 'Luna', breed: 'Beagle', age: 'puppy', size: 'small',
    gender: 'female', temperament: 'Energetic and curious', medical_status: 'Vaccinated, spayed',
    special_needs: null, description: 'Luna loves to play and explore.',
    photos: [], status: 'available', shelter_name: 'Austin Animal Rescue',
    shelter_logo_url: null, shelter_slug: 'austin-animal-rescue', distance_miles: 12,
  },
  {
    id: '3', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    shelter_id: 's1', name: 'Max', breed: 'German Shepherd Mix', age: 'senior', size: 'large',
    gender: 'male', temperament: 'Calm and gentle', medical_status: 'On daily medication',
    special_needs: 'Needs medication twice daily', description: 'Max is a calm senior dog.',
    photos: [], status: 'available', shelter_name: 'Happy Paws Rescue',
    shelter_logo_url: null, shelter_slug: 'happy-paws-rescue', distance_miles: 5,
  },
]

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

  const initialFilters = useMemo(
    () => parseFiltersFromParams(searchParams),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const initialHadParams = useMemo(
    () => isFilterActive(initialFilters),
    [initialFilters],
  )

  const [dogs, setDogs] = useState<DogWithShelter[]>(DEV_MODE ? PLACEHOLDER_DOGS : [])
  const [loadingDogs, setLoadingDogs] = useState(!DEV_MODE)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(!DEV_MODE)
  const [filters, setFilters] = useState<FilterState>(initialFilters)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  // Foster's coordinates — used to compute per-dog distance on the client.
  // Null when either the foster profile hasn't geocoded yet or the user is
  // signed out; in both cases we silently skip the distance filter so the
  // page still works, just without mileage. Held in a ref (and mirrored in
  // state for re-renders) so `fetchDogsPage` can stay referentially stable.
  const [fosterCoords, setFosterCoords] = useState<{
    latitude: number | null
    longitude: number | null
  } | null>(null)
  const fosterCoordsRef = useRef<{
    latitude: number | null
    longitude: number | null
  } | null>(null)
  useEffect(() => {
    fosterCoordsRef.current = fosterCoords
  }, [fosterCoords])
  // Track whether the user (or the prefs seed) has ever pushed filters to the
  // URL. Once true, we never re-seed from preferences — an explicit "Clear all"
  // must be honored.
  const hasInitializedRef = useRef(initialHadParams)

  // Keep URL in sync whenever filters change
  const handleFilterChange = useCallback(
    (next: FilterState) => {
      hasInitializedRef.current = true
      setFilters(next)
      const qs = filtersToParams(next)
      router.replace(qs ? `/foster/browse?${qs}` : '/foster/browse', {
        scroll: false,
      })
    },
    [router],
  )

  // Cursor-based pagination: fetch PAGE_SIZE dogs at a time and append.
  // Client-side filtering still runs across all loaded dogs, so filters
  // may only surface results once "Load More" pulls in the matching rows.
  // Tracked as a known trade-off until server-side filtering lands.
  const fetchDogsPage = useCallback(async (from: number) => {
    const supabase = createClient()
    const to = from + PAGE_SIZE - 1
    const { data } = await supabase
      .from('dogs')
      .select('*, shelter:shelters(name, logo_url, slug, latitude, longitude)')
      .eq('status', 'available')
      .order('created_at', { ascending: false })
      .range(from, to)

    const rows = data ?? []

    // Collect unique shelter IDs, then fetch their ratings in a single query
    // and compute per-shelter averages. Page-scoped (max 24 shelters), so
    // this is cheap and keeps the browse-card surface in sync with the
    // public profile without a join on every row.
    const shelterIds = Array.from(
      new Set(
        rows
          .map((r: Record<string, unknown>) => r.shelter_id as string | undefined)
          .filter((id): id is string => !!id),
      ),
    )
    const ratingsMap = new Map<string, { avg: number; count: number }>()
    if (shelterIds.length > 0) {
      const { data: ratingRows } = await supabase
        .from('shelter_ratings')
        .select('shelter_id, score')
        .in('shelter_id', shelterIds)
      const bucket: Record<string, number[]> = {}
      for (const r of ratingRows ?? []) {
        const id = r.shelter_id as string
        const score = r.score as number
        ;(bucket[id] ??= []).push(score)
      }
      for (const id of Object.keys(bucket)) {
        const scores = bucket[id]
        const sum = scores.reduce((a: number, b: number) => a + b, 0)
        ratingsMap.set(id, { avg: sum / scores.length, count: scores.length })
      }
    }

    // Read the foster's coords at fetch time so the distance column
    // reflects whatever we know about the user right now. If the user
    // hasn't geocoded yet, every dog ends up with distance_miles=undefined
    // and the distance filter silently becomes a no-op.
    const fc = fosterCoordsRef.current
    const mapped: DogWithShelter[] = rows.map((row: Record<string, unknown>) => {
      const shelter = row.shelter as {
        name: string
        logo_url: string | null
        slug: string | null
        latitude: number | null
        longitude: number | null
      } | null
      const shelterId = row.shelter_id as string | undefined
      const rating = shelterId ? ratingsMap.get(shelterId) : undefined
      const distance =
        fc && shelter
          ? haversineMiles(fc, {
              latitude: shelter.latitude,
              longitude: shelter.longitude,
            })
          : null
      return {
        ...(row as unknown as DogWithShelter),
        shelter_name: shelter?.name ?? 'Unknown Shelter',
        shelter_logo_url: shelter?.logo_url ?? null,
        shelter_slug: shelter?.slug ?? null,
        shelter_latitude: shelter?.latitude ?? null,
        shelter_longitude: shelter?.longitude ?? null,
        shelter_avg_rating: rating ? rating.avg : null,
        shelter_rating_count: rating ? rating.count : 0,
        distance_miles: distance == null ? undefined : distance,
      }
    })
    return { rows: mapped, reachedEnd: rows.length < PAGE_SIZE }
  }, [])

  useEffect(() => {
    if (DEV_MODE) return
    let cancelled = false
    async function loadFirstPage() {
      const { rows, reachedEnd } = await fetchDogsPage(0)
      if (cancelled) return
      setDogs(rows)
      setHasMore(!reachedEnd)
      setLoadingDogs(false)
    }
    loadFirstPage()
    return () => {
      cancelled = true
    }
  }, [fetchDogsPage])

  const loadMore = useCallback(async () => {
    if (DEV_MODE) return
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    const { rows, reachedEnd } = await fetchDogsPage(dogs.length)
    setDogs((prev) => [...prev, ...rows])
    setHasMore(!reachedEnd)
    setLoadingMore(false)
  }, [dogs.length, loadingMore, hasMore, fetchDogsPage])

  // Load the foster's saved preferences + coordinates. This does two things:
  //
  //   1. Stores the coordinates in state so we can compute distances (both
  //      for the filter and for the mileage label on each card).
  //   2. Seeds the filter state from saved preferences on first visit —
  //      but only when the URL had no filter params and we haven't already
  //      seeded this session. The user's `max_distance` is included in the
  //      seed so a foster who saved "within 50 miles" doesn't get a browse
  //      page full of dogs three states away.
  useEffect(() => {
    if (DEV_MODE) return
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const { data: userData, error: authError } = await supabase.auth.getUser()
      if (authError) {
        console.error('[foster/browse] getUser failed:', authError.message)
        return
      }
      const userId = userData.user?.id
      if (!userId) return
      const { data: foster } = await supabase
        .from('foster_parents')
        .select('pref_size, pref_age, pref_medical, max_distance, latitude, longitude')
        .eq('user_id', userId)
        .maybeSingle()
      if (cancelled) return
      if (!foster) return

      if (foster.latitude != null && foster.longitude != null) {
        setFosterCoords({
          latitude: foster.latitude as number,
          longitude: foster.longitude as number,
        })
      }

      if (hasInitializedRef.current) return

      const prefSize = Array.isArray(foster.pref_size) ? foster.pref_size : []
      const prefAge = Array.isArray(foster.pref_age) ? foster.pref_age : []
      const prefMedical = !!foster.pref_medical
      const prefMaxDistance =
        typeof foster.max_distance === 'number' && foster.max_distance > 0
          ? foster.max_distance
          : null

      if (
        prefSize.length === 0 &&
        prefAge.length === 0 &&
        !prefMedical &&
        prefMaxDistance === null
      )
        return
      if (hasInitializedRef.current) return
      handleFilterChange({
        ...DEFAULT_FILTERS,
        sizes: prefSize,
        ages: prefAge,
        medicalOk: prefMedical,
        maxDistance: prefMaxDistance,
      })
    }
    load()
    return () => {
      cancelled = true
    }
  }, [handleFilterChange])

  // When the foster's coords finish loading, backfill distance_miles on any
  // dogs that were fetched before coords arrived. This keeps the mileage
  // label in sync even in the (expected) race where dogs land first.
  useEffect(() => {
    if (!fosterCoords) return
    setDogs((prev) =>
      prev.map((dog) => {
        if (dog.distance_miles !== undefined) return dog
        if (dog.shelter_latitude == null || dog.shelter_longitude == null) return dog
        const d = haversineMiles(fosterCoords, {
          latitude: dog.shelter_latitude,
          longitude: dog.shelter_longitude,
        })
        if (d == null) return dog
        return { ...dog, distance_miles: d }
      }),
    )
  }, [fosterCoords])

  const filteredDogs = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return dogs.filter((dog) => {
      if (filters.sizes.length > 0 && dog.size && !filters.sizes.includes(dog.size)) return false
      if (filters.ages.length > 0 && dog.age && !filters.ages.includes(dog.age)) return false
      if (filters.gender && dog.gender !== filters.gender) return false
      if (!filters.medicalOk && dog.special_needs) return false
      if (q) {
        const name = dog.name?.toLowerCase() ?? ''
        const breed = dog.breed?.toLowerCase() ?? ''
        if (!name.includes(q) && !breed.includes(q)) return false
      }
      // Distance filter: only applies when the foster has coords AND the
      // dog has a known shelter distance. Dogs with undefined distance
      // pass the filter — we don't want geocoding gaps to silently hide
      // matches from someone dragging a 25-mile slider.
      if (filters.maxDistance !== null && dog.distance_miles !== undefined) {
        if (dog.distance_miles > filters.maxDistance) return false
      }
      // Shelter deep-link filter: only included dogs whose shelter slug
      // matches. Applied client-side against the same `shelter` nested
      // join the page already pulls through, so no extra query.
      if (filters.shelter && dog.shelter_slug !== filters.shelter) return false
      return true
    })
  }, [dogs, filters])

  const hasActiveFilters = isFilterActive(filters)

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
  function removeSearch() {
    handleFilterChange({ ...filters, search: '' })
  }
  function removeMaxDistance() {
    handleFilterChange({ ...filters, maxDistance: null })
  }
  function removeShelter() {
    handleFilterChange({ ...filters, shelter: null })
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
                {hasMore && !hasActiveFilters && (
                  <span className="ml-1 text-xs">
                    (of loaded dogs &mdash; load more to see all)
                  </span>
                )}
              </span>

              {filters.search.trim() && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  <span className="sr-only">Search: </span>
                  &quot;{filters.search.trim()}&quot;
                  <button onClick={removeSearch} className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5">
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove search filter</span>
                  </button>
                </Badge>
              )}

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

              {filters.maxDistance !== null && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  Within {filters.maxDistance} mi
                  <button onClick={removeMaxDistance} className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5">
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove distance filter</span>
                  </button>
                </Badge>
              )}

              {filters.shelter && (
                <Badge variant="secondary" className="gap-1 pr-1">
                  <span className="sr-only">Filtered to shelter: </span>
                  Shelter: {filters.shelter}
                  <button
                    onClick={removeShelter}
                    className="ml-0.5 rounded-full hover:bg-foreground/10 p-0.5"
                  >
                    <X className="h-3 w-3" />
                    <span className="sr-only">Remove shelter filter</span>
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
              illustration="search"
              title="No dogs match your filters"
              description="Try adjusting your filters to see more results."
              action={{
                label: 'Clear all filters',
                onClick: () => handleFilterChange(DEFAULT_FILTERS),
              }}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDogs.map((dog, i) => (
                  <StaggerItem key={dog.id} index={i}>
                    <BrowseDogCard dog={dog} />
                  </StaggerItem>
                ))}
              </div>
              {hasMore && !loadingDogs && (
                <div className="flex justify-center pt-6">
                  <Button
                    onClick={loadMore}
                    disabled={loadingMore}
                    variant="outline"
                    size="lg"
                    className="min-w-40"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      'Load more dogs'
                    )}
                  </Button>
                </div>
              )}
            </>
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
            {filters.sizes.length +
              filters.ages.length +
              (filters.gender ? 1 : 0) +
              (filters.medicalOk ? 1 : 0) +
              (filters.search.trim() ? 1 : 0) +
              (filters.maxDistance !== null ? 1 : 0) +
              (filters.shelter ? 1 : 0)}
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
