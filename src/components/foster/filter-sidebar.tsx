'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Separator } from '@/components/ui/separator'
import { DOG_SIZES, DOG_AGES, DOG_AGE_LABELS, DOG_SIZE_LABELS } from '@/lib/constants'

export interface FilterState {
  sizes: string[]
  ages: string[]
  gender: string | null
  medicalOk: boolean
}

interface FilterSidebarProps {
  onFilterChange: (filters: FilterState) => void
}

const defaultFilters: FilterState = {
  sizes: [],
  ages: [],
  gender: null,
  medicalOk: false,
}

export function FilterSidebar({ onFilterChange }: FilterSidebarProps) {
  const [filters, setFilters] = useState<FilterState>(defaultFilters)

  function updateFilters(updates: Partial<FilterState>) {
    const next = { ...filters, ...updates }
    setFilters(next)
    onFilterChange(next)
  }

  function toggleArray(arr: string[], value: string): string[] {
    return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
  }

  function clearAll() {
    setFilters(defaultFilters)
    onFilterChange(defaultFilters)
  }

  return (
    <aside className="w-64 flex-shrink-0 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Filters</h2>
        <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs h-auto py-1">
          Clear all
        </Button>
      </div>

      <Separator />

      {/* Size */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Size</h3>
        {DOG_SIZES.map((size) => (
          <div key={size} className="flex items-center gap-2">
            <Checkbox
              id={`size-${size}`}
              checked={filters.sizes.includes(size)}
              onCheckedChange={() =>
                updateFilters({ sizes: toggleArray(filters.sizes, size) })
              }
            />
            <Label htmlFor={`size-${size}`} className="font-normal cursor-pointer">
              {DOG_SIZE_LABELS[size]}
            </Label>
          </div>
        ))}
      </div>

      <Separator />

      {/* Age */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Age</h3>
        {DOG_AGES.map((age) => (
          <div key={age} className="flex items-center gap-2">
            <Checkbox
              id={`age-${age}`}
              checked={filters.ages.includes(age)}
              onCheckedChange={() =>
                updateFilters({ ages: toggleArray(filters.ages, age) })
              }
            />
            <Label htmlFor={`age-${age}`} className="font-normal cursor-pointer">
              {DOG_AGE_LABELS[age]}
            </Label>
          </div>
        ))}
      </div>

      <Separator />

      {/* Gender */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Gender</h3>
        <RadioGroup
          value={filters.gender ?? 'any'}
          onValueChange={(v) => updateFilters({ gender: v === 'any' ? null : v })}
        >
          {['any', 'male', 'female'].map((g) => (
            <div key={g} className="flex items-center gap-2">
              <RadioGroupItem value={g} id={`gender-${g}`} />
              <Label htmlFor={`gender-${g}`} className="font-normal cursor-pointer capitalize">
                {g}
              </Label>
            </div>
          ))}
        </RadioGroup>
      </div>

      <Separator />

      {/* Medical */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="medical"
          checked={filters.medicalOk}
          onCheckedChange={(checked) =>
            updateFilters({ medicalOk: checked === true })
          }
        />
        <Label htmlFor="medical" className="font-normal cursor-pointer text-sm">
          Open to medical needs
        </Label>
      </div>
    </aside>
  )
}
