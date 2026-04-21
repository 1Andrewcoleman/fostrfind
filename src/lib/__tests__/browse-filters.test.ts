import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FILTERS,
  filtersToParams,
  isFilterActive,
  parseFiltersFromParams,
  type FilterState,
} from '@/lib/browse-filters'

function roundtrip(filters: FilterState): FilterState {
  return parseFiltersFromParams(new URLSearchParams(filtersToParams(filters)))
}

describe('DEFAULT_FILTERS', () => {
  it('represents the "no filters active" state', () => {
    expect(isFilterActive(DEFAULT_FILTERS)).toBe(false)
    expect(filtersToParams(DEFAULT_FILTERS)).toBe('')
  })
})

describe('parseFiltersFromParams', () => {
  it('returns defaults for an empty URLSearchParams', () => {
    expect(parseFiltersFromParams(new URLSearchParams())).toEqual(DEFAULT_FILTERS)
  })

  it('parses comma-separated sizes and ages', () => {
    const parsed = parseFiltersFromParams(
      new URLSearchParams('sizes=small,medium&ages=puppy,senior'),
    )
    expect(parsed.sizes).toEqual(['small', 'medium'])
    expect(parsed.ages).toEqual(['puppy', 'senior'])
  })

  it('treats empty comma segments as absent', () => {
    const parsed = parseFiltersFromParams(new URLSearchParams('sizes=,,small,,'))
    expect(parsed.sizes).toEqual(['small'])
  })

  it('parses gender, medicalOk, and search', () => {
    const parsed = parseFiltersFromParams(
      new URLSearchParams('gender=female&medicalOk=1&q=buddy'),
    )
    expect(parsed.gender).toBe('female')
    expect(parsed.medicalOk).toBe(true)
    expect(parsed.search).toBe('buddy')
  })

  it('rejects unparseable / non-positive maxDist as "no limit"', () => {
    expect(parseFiltersFromParams(new URLSearchParams('maxDist=abc')).maxDistance).toBeNull()
    expect(parseFiltersFromParams(new URLSearchParams('maxDist=0')).maxDistance).toBeNull()
    expect(parseFiltersFromParams(new URLSearchParams('maxDist=-5')).maxDistance).toBeNull()
  })

  it('parses a positive maxDist as a number', () => {
    expect(parseFiltersFromParams(new URLSearchParams('maxDist=50')).maxDistance).toBe(50)
  })

  it('parses shelter slug and treats blank string as null', () => {
    expect(
      parseFiltersFromParams(new URLSearchParams('shelter=happy-paws-rescue')).shelter,
    ).toBe('happy-paws-rescue')
    expect(parseFiltersFromParams(new URLSearchParams('shelter=')).shelter).toBeNull()
    expect(parseFiltersFromParams(new URLSearchParams('shelter=   ')).shelter).toBeNull()
  })
})

describe('filtersToParams', () => {
  it('omits empty arrays, null values, and empty strings', () => {
    expect(filtersToParams(DEFAULT_FILTERS)).toBe('')
  })

  it('emits only the fields that are active', () => {
    const qs = filtersToParams({
      ...DEFAULT_FILTERS,
      sizes: ['small'],
      shelter: 'happy-paws-rescue',
    })
    const params = new URLSearchParams(qs)
    expect(params.get('sizes')).toBe('small')
    expect(params.get('shelter')).toBe('happy-paws-rescue')
    expect(params.get('ages')).toBeNull()
    expect(params.get('gender')).toBeNull()
    expect(params.get('medicalOk')).toBeNull()
  })

  it('trims whitespace-only search strings', () => {
    expect(filtersToParams({ ...DEFAULT_FILTERS, search: '   ' })).toBe('')
    expect(filtersToParams({ ...DEFAULT_FILTERS, search: '  buddy  ' })).toContain('q=buddy')
  })
})

describe('roundtrip parseFiltersFromParams(filtersToParams(...))', () => {
  it('preserves a fully-populated state', () => {
    const filters: FilterState = {
      sizes: ['small', 'large'],
      ages: ['young', 'senior'],
      gender: 'male',
      medicalOk: true,
      search: 'buddy',
      maxDistance: 25,
      shelter: 'austin-animal-rescue',
    }
    expect(roundtrip(filters)).toEqual(filters)
  })

  it('preserves defaults', () => {
    expect(roundtrip(DEFAULT_FILTERS)).toEqual(DEFAULT_FILTERS)
  })

  it('preserves shelter-only deep-link state', () => {
    const filters: FilterState = { ...DEFAULT_FILTERS, shelter: 'happy-paws-rescue' }
    expect(roundtrip(filters)).toEqual(filters)
  })
})

describe('isFilterActive', () => {
  it('is false when every field is default', () => {
    expect(isFilterActive(DEFAULT_FILTERS)).toBe(false)
  })

  it('is true when any single field is populated', () => {
    expect(isFilterActive({ ...DEFAULT_FILTERS, sizes: ['small'] })).toBe(true)
    expect(isFilterActive({ ...DEFAULT_FILTERS, ages: ['adult'] })).toBe(true)
    expect(isFilterActive({ ...DEFAULT_FILTERS, gender: 'female' })).toBe(true)
    expect(isFilterActive({ ...DEFAULT_FILTERS, medicalOk: true })).toBe(true)
    expect(isFilterActive({ ...DEFAULT_FILTERS, search: 'buddy' })).toBe(true)
    expect(isFilterActive({ ...DEFAULT_FILTERS, maxDistance: 50 })).toBe(true)
    expect(isFilterActive({ ...DEFAULT_FILTERS, shelter: 'happy-paws-rescue' })).toBe(true)
  })

  it('ignores whitespace-only search', () => {
    expect(isFilterActive({ ...DEFAULT_FILTERS, search: '   ' })).toBe(false)
  })
})
