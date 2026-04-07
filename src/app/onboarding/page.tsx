'use client'

import { useState } from 'react'
import { PawPrint, Building2, Heart, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { HOUSING_TYPES, EXPERIENCE_LEVELS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { slugify } from '@/lib/helpers'

const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')

type Step = 'role' | 'shelter-form' | 'foster-form'

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>('role')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Shelter form state
  const [shelter, setShelter] = useState({
    name: '', email: '', phone: '', location: '', ein: '', bio: '', website: '', instagram: '',
  })

  // Foster form state
  const [foster, setFoster] = useState({
    first_name: '', last_name: '', email: '', phone: '', location: '',
    housing_type: '', has_yard: false, has_other_pets: false, other_pets_info: '',
    has_children: false, children_info: '', experience: '', bio: '',
  })

  async function handleShelterSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (DEV_MODE) {
      window.location.href = '/shelter/dashboard'
      return
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError('You must be logged in.')
        toast.error('You must be logged in.')
        setLoading(false)
        return
      }

      const baseSlug = slugify(shelter.name) || 'shelter'
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`

      const { error: dbError } = await supabase.from('shelters').insert({
        user_id: user.id,
        name: shelter.name,
        slug,
        email: shelter.email,
        phone: shelter.phone || null,
        location: shelter.location,
        ein: shelter.ein || null,
        bio: shelter.bio || null,
        website: shelter.website || null,
        instagram: shelter.instagram || null,
      })

      if (dbError) {
        setError(dbError.message)
        toast.error(dbError.message)
        setLoading(false)
        return
      }

      toast.success('Shelter created! Redirecting...')
      window.location.href = '/shelter/dashboard'
    } catch {
      setError('Something went wrong. Please try again.')
      toast.error('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  async function handleFosterSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (DEV_MODE) {
      window.location.href = '/foster/browse'
      return
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        setError('You must be logged in.')
        toast.error('You must be logged in.')
        setLoading(false)
        return
      }

      const { error: dbError } = await supabase.from('foster_parents').insert({
        user_id: user.id,
        first_name: foster.first_name,
        last_name: foster.last_name,
        email: foster.email,
        phone: foster.phone || null,
        location: foster.location,
        housing_type: foster.housing_type || null,
        has_yard: foster.has_yard,
        has_other_pets: foster.has_other_pets,
        other_pets_info: foster.other_pets_info || null,
        has_children: foster.has_children,
        children_info: foster.children_info || null,
        experience: foster.experience || null,
        bio: foster.bio || null,
      })

      if (dbError) {
        setError(dbError.message)
        toast.error(dbError.message)
        setLoading(false)
        return
      }

      toast.success('Profile created! Redirecting...')
      window.location.href = '/foster/browse'
    } catch {
      setError('Something went wrong. Please try again.')
      toast.error('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (step === 'role') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-muted/30">
        <div className="flex items-center gap-2 font-bold text-xl mb-8">
          <PawPrint className="h-7 w-7 text-primary" />
          Fostr Fix
        </div>
        <h1 className="text-2xl font-bold mb-2 text-center">How will you use Fostr Fix?</h1>
        <p className="text-muted-foreground mb-8 text-center">Choose your role to get started</p>

        <div className="grid sm:grid-cols-2 gap-4 w-full max-w-lg">
          <button onClick={() => setStep('shelter-form')} className="text-left">
            <Card className="h-full hover:border-primary hover:shadow-md transition-all cursor-pointer">
              <CardContent className="p-6 space-y-3">
                <Building2 className="h-8 w-8 text-primary" />
                <h2 className="font-semibold text-lg">I&apos;m a Shelter / Rescue</h2>
                <p className="text-sm text-muted-foreground">
                  List dogs that need foster homes and manage incoming applications.
                </p>
              </CardContent>
            </Card>
          </button>

          <button onClick={() => setStep('foster-form')} className="text-left">
            <Card className="h-full hover:border-primary hover:shadow-md transition-all cursor-pointer">
              <CardContent className="p-6 space-y-3">
                <Heart className="h-8 w-8 text-primary" />
                <h2 className="font-semibold text-lg">I&apos;m a Foster Parent</h2>
                <p className="text-sm text-muted-foreground">
                  Browse dogs near you and apply to provide a temporary loving home.
                </p>
              </CardContent>
            </Card>
          </button>
        </div>
      </div>
    )
  }

  if (step === 'shelter-form') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
        <Card className="w-full max-w-lg">
          <CardHeader>
            <CardTitle>Tell us about your shelter</CardTitle>
            <CardDescription>This info will be shown to foster parents</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleShelterSubmit} className="space-y-4">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label>Shelter / Rescue Name *</Label>
                  <Input
                    placeholder="Happy Paws Rescue"
                    value={shelter.name}
                    onChange={(e) => setShelter({ ...shelter, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    placeholder="info@shelter.org"
                    value={shelter.email}
                    onChange={(e) => setShelter({ ...shelter, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input
                    placeholder="(555) 000-0000"
                    value={shelter.phone}
                    onChange={(e) => setShelter({ ...shelter, phone: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Location (City, State) *</Label>
                  <Input
                    placeholder="Austin, TX"
                    value={shelter.location}
                    onChange={(e) => setShelter({ ...shelter, location: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>EIN (501c3)</Label>
                  <Input
                    placeholder="12-3456789"
                    value={shelter.ein}
                    onChange={(e) => setShelter({ ...shelter, ein: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Website</Label>
                  <Input
                    placeholder="https://..."
                    value={shelter.website}
                    onChange={(e) => setShelter({ ...shelter, website: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Instagram Handle</Label>
                  <Input
                    placeholder="@happypaws"
                    value={shelter.instagram}
                    onChange={(e) => setShelter({ ...shelter, instagram: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Short Bio</Label>
                  <Textarea
                    placeholder="Tell foster parents about your organization..."
                    value={shelter.bio}
                    onChange={(e) => setShelter({ ...shelter, bio: e.target.value })}
                    rows={3}
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up...</> : 'Complete Setup'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setStep('role')}>
                  Back
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Foster form
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-muted/30">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Tell us about yourself</CardTitle>
          <CardDescription>Help shelters get to know you as a foster parent</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleFosterSubmit} className="space-y-4">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>First Name *</Label>
                <Input
                  value={foster.first_name}
                  onChange={(e) => setFoster({ ...foster, first_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Last Name *</Label>
                <Input
                  value={foster.last_name}
                  onChange={(e) => setFoster({ ...foster, last_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={foster.email}
                  onChange={(e) => setFoster({ ...foster, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Phone</Label>
                <Input
                  value={foster.phone}
                  onChange={(e) => setFoster({ ...foster, phone: e.target.value })}
                />
              </div>
              <div className="col-span-2 space-y-1">
                <Label>Location (City, State) *</Label>
                <Input
                  placeholder="Austin, TX"
                  value={foster.location}
                  onChange={(e) => setFoster({ ...foster, location: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>Housing Type</Label>
                <Select onValueChange={(v) => setFoster({ ...foster, housing_type: v })}>
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
                <Label>Experience with Dogs</Label>
                <Select onValueChange={(v) => setFoster({ ...foster, experience: v })}>
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
                  <Checkbox
                    id="yard"
                    checked={foster.has_yard}
                    onCheckedChange={(c) => setFoster({ ...foster, has_yard: c === true })}
                  />
                  <Label htmlFor="yard" className="font-normal cursor-pointer">Has yard</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pets"
                    checked={foster.has_other_pets}
                    onCheckedChange={(c) => setFoster({ ...foster, has_other_pets: c === true })}
                  />
                  <Label htmlFor="pets" className="font-normal cursor-pointer">Has other pets</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="kids"
                    checked={foster.has_children}
                    onCheckedChange={(c) => setFoster({ ...foster, has_children: c === true })}
                  />
                  <Label htmlFor="kids" className="font-normal cursor-pointer">Has children</Label>
                </div>
              </div>

              <div className="col-span-2 space-y-1">
                <Label>About You</Label>
                <Textarea
                  placeholder="Tell shelters about yourself and your fostering experience..."
                  value={foster.bio}
                  onChange={(e) => setFoster({ ...foster, bio: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up...</> : 'Complete Setup'}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setStep('role')}>
                Back
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
