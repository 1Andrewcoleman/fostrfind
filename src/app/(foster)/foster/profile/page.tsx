'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ProfileCompleteness } from '@/components/foster/profile-completeness'
import { DOG_SIZES, DOG_AGES, HOUSING_TYPES, EXPERIENCE_LEVELS, DOG_SIZE_LABELS, DOG_AGE_LABELS } from '@/lib/constants'
import type { FosterParent } from '@/types/database'

export default function FosterProfilePage() {
  const [loading, setLoading] = useState(false)
  const [foster, setFoster] = useState<Partial<FosterParent>>({
    first_name: '', last_name: '', email: '', phone: '', location: '',
    housing_type: undefined, has_yard: false, has_other_pets: false,
    has_children: false, experience: undefined, bio: '', avatar_url: null,
    pref_size: [], pref_age: [], pref_medical: false, max_distance: 25,
  })

  function togglePref(key: 'pref_size' | 'pref_age', value: string) {
    const arr = foster[key] ?? []
    setFoster({
      ...foster,
      [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
    })
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // TODO: upsert into foster_parents table via Supabase
    console.log('Save profile:', foster)
    setLoading(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <ProfileCompleteness foster={foster} />

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-full bg-muted border flex items-center justify-center">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <Button type="button" variant="outline" size="sm">
                Upload Photo
              </Button>
              {/* TODO: wire to Supabase Storage */}
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>First Name</Label>
                <Input
                  value={foster.first_name ?? ''}
                  onChange={(e) => setFoster({ ...foster, first_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Last Name</Label>
                <Input
                  value={foster.last_name ?? ''}
                  onChange={(e) => setFoster({ ...foster, last_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={foster.email ?? ''}
                  onChange={(e) => setFoster({ ...foster, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input
                  value={foster.phone ?? ''}
                  onChange={(e) => setFoster({ ...foster, phone: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Location</Label>
                <Input
                  placeholder="City, State"
                  value={foster.location ?? ''}
                  onChange={(e) => setFoster({ ...foster, location: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Housing Type</Label>
                <Select onValueChange={(v) => setFoster({ ...foster, housing_type: v as FosterParent['housing_type'] })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUSING_TYPES.map((h) => (
                      <SelectItem key={h} value={h} className="capitalize">{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Experience</Label>
                <Select onValueChange={(v) => setFoster({ ...foster, experience: v as FosterParent['experience'] })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPERIENCE_LEVELS.map((e) => (
                      <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex gap-6">
                <div className="flex items-center gap-2">
                  <Checkbox id="yard" checked={foster.has_yard} onCheckedChange={(c) => setFoster({ ...foster, has_yard: c === true })} />
                  <Label htmlFor="yard" className="font-normal cursor-pointer">Has yard</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="pets" checked={foster.has_other_pets} onCheckedChange={(c) => setFoster({ ...foster, has_other_pets: c === true })} />
                  <Label htmlFor="pets" className="font-normal cursor-pointer">Has other pets</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="kids" checked={foster.has_children} onCheckedChange={(c) => setFoster({ ...foster, has_children: c === true })} />
                  <Label htmlFor="kids" className="font-normal cursor-pointer">Has children</Label>
                </div>
              </div>
              <div className="col-span-2 space-y-1">
                <Label>About Me</Label>
                <Textarea rows={4} value={foster.bio ?? ''} onChange={(e) => setFoster({ ...foster, bio: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Foster Preferences</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="mb-2 block">Preferred Dog Sizes</Label>
              <div className="flex flex-wrap gap-3">
                {DOG_SIZES.map((size) => (
                  <div key={size} className="flex items-center gap-2">
                    <Checkbox
                      id={`pref-size-${size}`}
                      checked={foster.pref_size?.includes(size) ?? false}
                      onCheckedChange={() => togglePref('pref_size', size)}
                    />
                    <Label htmlFor={`pref-size-${size}`} className="font-normal cursor-pointer">{DOG_SIZE_LABELS[size]}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Preferred Dog Ages</Label>
              <div className="flex flex-wrap gap-3">
                {DOG_AGES.map((age) => (
                  <div key={age} className="flex items-center gap-2">
                    <Checkbox
                      id={`pref-age-${age}`}
                      checked={foster.pref_age?.includes(age) ?? false}
                      onCheckedChange={() => togglePref('pref_age', age)}
                    />
                    <Label htmlFor={`pref-age-${age}`} className="font-normal cursor-pointer">{DOG_AGE_LABELS[age]}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="pref-medical"
                checked={foster.pref_medical}
                onCheckedChange={(c) => setFoster({ ...foster, pref_medical: c === true })}
              />
              <Label htmlFor="pref-medical" className="font-normal cursor-pointer">
                Open to fostering dogs with medical needs
              </Label>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading}>
          {loading ? 'Saving...' : 'Save Profile'}
        </Button>
      </form>
    </div>
  )
}
