'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { DOG_SIZES, DOG_AGES, DOG_AGE_LABELS, DOG_SIZE_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { DEFAULT_FILTERS as SHARED_DEFAULT_FILTERS, type FilterState as SharedFilterState } from '@/lib/browse-filters'

// Re-export through this module so existing import paths
// (`@/components/foster/filter-sidebar`) continue to work for callers
// that grabbed the type / default from here before the extraction.
export type FilterState = SharedFilterState
export const DEFAULT_FILTERS = SHARED_DEFAULT_FILTERS

// Multi-select pill used for Size + Age. Behaviour mirrors a checkbox
// (role="checkbox", aria-checked), rendered as a pastel-filled chip when
// selected so the page still keeps its calm contrast band (principle 2:
// no new saturated-primary surface). All colour values resolve through
// design tokens so dark mode picks them up for free.
interface FilterPillProps {
  id: string
  checked: boolean
  onToggle: () => void
  label: string
}

function FilterPill({ id, checked, onToggle, label }: FilterPillProps) {
  return (
    <button
      id={id}
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onToggle}
      className={cn(
        'inline-flex items-center justify-center rounded-full border h-10 px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
        checked
          ? 'border-primary bg-primary/15 text-foreground ring-1 ring-primary/30'
          : 'border-border bg-card text-foreground hover:bg-muted',
      )}
    >
      {label}
    </button>
  )
}

export const DISTANCE_MIN = 5
export const DISTANCE_MAX = 250
export const DISTANCE_UNLIMITED_THRESHOLD = DISTANCE_MAX

// ---------------------------------------------------------------------------
// Reusable filter form — rendered in both the desktop Card and mobile Sheet
// ---------------------------------------------------------------------------

interface BrowseFilterFormProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
  idPrefix: string
}

export function BrowseFilterForm({ filters, onFilterChange, idPrefix }: BrowseFilterFormProps) {
  const updateFilters = useCallback(
    (updates: Partial<FilterState>) => {
      onFilterChange({ ...filters, ...updates })
    },
    [filters, onFilterChange],
  )

  function toggleArray(arr: string[], value: string): string[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
  }

  // Debounced search: keep the input snappy but only push URL / filter state
  // once the user pauses typing for 300ms. Resets when parent search changes
  // externally (e.g. removing the active search chip).
  const [searchDraft, setSearchDraft] = useState(filters.search)
  useEffect(() => {
    setSearchDraft(filters.search)
  }, [filters.search])
  useEffect(() => {
    if (searchDraft === filters.search) return
    const t = setTimeout(() => {
      onFilterChange({ ...filters, search: searchDraft })
    }, 300)
    return () => clearTimeout(t)
  }, [searchDraft, filters, onFilterChange])

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display font-semibold">Filters</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onFilterChange(DEFAULT_FILTERS)}
          className="text-xs h-auto py-1"
        >
          Clear all
        </Button>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}search`} className="text-sm font-medium">
          Search
        </Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id={`${idPrefix}search`}
            type="search"
            placeholder="Search by name or breed..."
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <h3 id={`${idPrefix}size-heading`} className="text-sm font-medium">
          Size
        </h3>
        <div
          role="group"
          aria-labelledby={`${idPrefix}size-heading`}
          className="flex flex-wrap gap-2"
        >
          {DOG_SIZES.map((size) => (
            <FilterPill
              key={size}
              id={`${idPrefix}size-${size}`}
              checked={filters.sizes.includes(size)}
              onToggle={() =>
                updateFilters({ sizes: toggleArray(filters.sizes, size) })
              }
              label={DOG_SIZE_LABELS[size]}
            />
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <h3 id={`${idPrefix}age-heading`} className="text-sm font-medium">
          Age
        </h3>
        <div
          role="group"
          aria-labelledby={`${idPrefix}age-heading`}
          className="flex flex-wrap gap-2"
        >
          {DOG_AGES.map((age) => (
            <FilterPill
              key={age}
              id={`${idPrefix}age-${age}`}
              checked={filters.ages.includes(age)}
              onToggle={() =>
                updateFilters({ ages: toggleArray(filters.ages, age) })
              }
              label={DOG_AGE_LABELS[age]}
            />
          ))}
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Gender</h3>
        <RadioGroup
          value={filters.gender ?? 'any'}
          onValueChange={(v) => updateFilters({ gender: v === 'any' ? null : v })}
        >
          {['any', 'male', 'female'].map((g) => (
            <div key={g} className="flex items-center gap-2 min-h-[44px]">
              <RadioGroupItem value={g} id={`${idPrefix}gender-${g}`} />
              <Label htmlFor={`${idPrefix}gender-${g}`} className="font-normal cursor-pointer capitalize">
                {g}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <Separator />

      <div className="flex items-center gap-2 min-h-[44px]">
        <Checkbox
          id={`${idPrefix}medical`}
          checked={filters.medicalOk}
          onCheckedChange={(checked) =>
            updateFilters({ medicalOk: checked === true })
          }
        />
        <Label htmlFor={`${idPrefix}medical`} className="font-normal cursor-pointer text-sm">
          Open to medical needs
        </Label>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium">Max distance</h3>
          {filters.maxDistance !== null && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => updateFilters({ maxDistance: null })}
              className="text-xs h-auto py-1"
            >
              Clear
            </Button>
          )}
        </div>
        <input
          id={`${idPrefix}distance`}
          type="range"
          min={DISTANCE_MIN}
          max={DISTANCE_MAX}
          step={5}
          value={filters.maxDistance ?? DISTANCE_MAX}
          onChange={(e) => {
            const raw = Number(e.target.value)
            updateFilters({
              maxDistance: raw >= DISTANCE_UNLIMITED_THRESHOLD ? null : raw,
            })
          }}
          className="w-full accent-primary"
          aria-label="Maximum shelter distance in miles"
        />
        <p className="text-xs text-muted-foreground">
          {filters.maxDistance === null
            ? 'No limit'
            : `Within ${filters.maxDistance} ${filters.maxDistance === 1 ? 'mile' : 'miles'}`}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Desktop sidebar wrapper (hidden on small screens)
// ---------------------------------------------------------------------------

interface FilterSidebarProps {
  filters: FilterState
  onFilterChange: (filters: FilterState) => void
}

export function FilterSidebar({ filters, onFilterChange }: FilterSidebarProps) {
  return (
    <aside className="w-64 flex-shrink-0 hidden md:block sticky top-6 self-start">
      <Card className="p-5 shadow-sm">
        <BrowseFilterForm
          filters={filters}
          onFilterChange={onFilterChange}
          idPrefix="desktop-"
        />
      </Card>
    </aside>
  )
}
