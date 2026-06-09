/**
 * Browse filter URL helpers.
 *
 * The foster browse page syncs its filter state to the URL so filters
 * survive navigation, deep links, and back/forward nav. This module is
 * the canonical encoding between a `FilterState` object and a
 * `URLSearchParams` representation, shared by:
 *
 *   - the browse page itself (`/foster/browse`), which parses on mount
 *     and writes on every filter change
 *   - the `/shelters` index, which links into the browse with a
 *     pre-populated `?shelter=<slug>` filter
 *
 * Keeping this logic in one file means both sides agree on spellings
 * (`sizes` plural, `maxDist` abbreviated) and "what counts as active".
 */

export interface FilterState {
  sizes: string[]
  ages: string[]
  gender: string | null
  medicalOk: boolean
  search: string
  /**
   * Maximum shelter distance in miles. null = filter disabled. Range values
   * at or above the browse slider's top stop are treated as "no limit" so
   * the slider has a sane "∞" stop.
   */
  maxDistance: number | null
  /**
   * Shelter slug to restrict the grid to dogs from a single shelter.
   * Populated via deep link (e.g. `/foster/browse?shelter=happy-paws-rescue`
   * from the `/shelters` index or a shelter profile link). `null` = no
   * restriction. v1 has no UI input for this in the filter sidebar — it's
   * deep-link-only — so it won't surface as a chip from inside the sidebar,
   * only from the results-bar chip row.
   */
  shelter: string | null
}

export const DEFAULT_FILTERS: FilterState = {
  sizes: [],
  ages: [],
  gender: null,
  medicalOk: false,
  search: '',
  maxDistance: null,
  shelter: null,
}

export function parseFiltersFromParams(params: URLSearchParams): FilterState {
  const sizes = params.get('sizes')?.split(',').filter(Boolean) ?? []
  const ages = params.get('ages')?.split(',').filter(Boolean) ?? []
  const gender = params.get('gender') || null
  const medicalOk = params.get('medicalOk') === '1'
  const search = params.get('q') ?? ''
  const rawDist = params.get('maxDist')
  const parsed = rawDist == null ? NaN : Number(rawDist)
  const maxDistance = Number.isFinite(parsed) && parsed > 0 ? parsed : null
  const shelterRaw = params.get('shelter')?.trim()
  const shelter = shelterRaw ? shelterRaw : null
  return { sizes, ages, gender, medicalOk, search, maxDistance, shelter }
}

export function filtersToParams(filters: FilterState): string {
  const params = new URLSearchParams()
  if (filters.sizes.length > 0) params.set('sizes', filters.sizes.join(','))
  if (filters.ages.length > 0) params.set('ages', filters.ages.join(','))
  if (filters.gender) params.set('gender', filters.gender)
  if (filters.medicalOk) params.set('medicalOk', '1')
  if (filters.search.trim()) params.set('q', filters.search.trim())
  if (filters.maxDistance !== null) params.set('maxDist', String(filters.maxDistance))
  if (filters.shelter) params.set('shelter', filters.shelter)
  return params.toString()
}

/**
 * Build a safe PostgREST `.or()` filter for the browse name/breed search.
 *
 * The browse query searches two columns with OR, which means the value is
 * embedded in a `.or()` filter *string* where `,` `.` `(` `)` `:` are
 * structural and `%` `_` are SQL LIKE wildcards. Interpolating a raw term
 * lets a search like `a,b)` or `name.ilike.x` alter the query, so we:
 *   - escape LIKE wildcards (`\` `%` `_`) so they match literally, then
 *   - wrap each value in PostgREST double quotes (escaping `\` and `"`) so
 *     structural characters are treated as literal value content.
 *
 * Returns `null` for an empty/whitespace term so callers skip the filter.
 * (The sibling `/shelters` page only needs wildcard escaping because it uses
 * single-column `.ilike()`, where structural chars are not significant.)
 */
export function buildDogSearchOrFilter(rawTerm: string): string | null {
  const term = rawTerm.trim().slice(0, 100)
  if (!term) return null
  const likeEscaped = term.replace(/[\\%_]/g, (c) => `\\${c}`)
  // PostgREST double-quoted value: escape backslash first, then the quote.
  const quoted = `"%${likeEscaped.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}%"`
  return `name.ilike.${quoted},breed.ilike.${quoted}`
}

export function isFilterActive(filters: FilterState): boolean {
  return (
    filters.sizes.length > 0 ||
    filters.ages.length > 0 ||
    !!filters.gender ||
    filters.medicalOk ||
    filters.search.trim().length > 0 ||
    filters.maxDistance !== null ||
    !!filters.shelter
  )
}
