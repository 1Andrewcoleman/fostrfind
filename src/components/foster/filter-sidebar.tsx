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

export interface FilterState {
  sizes: string[]
  ages: string[]
  gender: string | null
  medicalOk: boolean
  search: string
}

export const DEFAULT_FILTERS: FilterState = {
  sizes: [],
  ages: [],
  gender: null,
  medicalOk: false,
  search: '',
}

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
        <h3 className="text-sm font-medium">Size</h3>
        {DOG_SIZES.map((size) => (
          <div key={size} className="flex items-center gap-2 min-h-[44px]">
            <Checkbox
              id={`${idPrefix}size-${size}`}
              checked={filters.sizes.includes(size)}
              onCheckedChange={() =>
                updateFilters({ sizes: toggleArray(filters.sizes, size) })
              }
            />
            <Label htmlFor={`${idPrefix}size-${size}`} className="font-normal cursor-pointer">
              {DOG_SIZE_LABELS[size]}
            </Label>
          </div>
        ))}
      </div>

      <Separator />

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Age</h3>
        {DOG_AGES.map((age) => (
          <div key={age} className="flex items-center gap-2 min-h-[44px]">
            <Checkbox
              id={`${idPrefix}age-${age}`}
              checked={filters.ages.includes(age)}
              onCheckedChange={() =>
                updateFilters({ ages: toggleArray(filters.ages, age) })
              }
            />
            <Label htmlFor={`${idPrefix}age-${age}`} className="font-normal cursor-pointer">
              {DOG_AGE_LABELS[age]}
            </Label>
          </div>
        ))}
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
