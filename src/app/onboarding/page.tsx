'use client'

import { useEffect, useState } from 'react'
import { PawPrint, Building2, Heart, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { FormEyebrow } from '@/components/ui/form-eyebrow'
import { Separator } from '@/components/ui/separator'
import { DEV_MODE, HOUSING_TYPES, EXPERIENCE_LEVELS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { slugify } from '@/lib/helpers'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { cn } from '@/lib/utils'

type Step = 'role' | 'shelter-form' | 'foster-form'

const STEP_META: Record<Step, { index: number; label: string }> = {
  'role':         { index: 1, label: 'Choose your role' },
  'shelter-form': { index: 2, label: 'Create your profile' },
  'foster-form':  { index: 2, label: 'Create your profile' },
}

const TOTAL_STEPS = Math.max(...Object.values(STEP_META).map((s) => s.index))

/**
 * Two-step progress header: eyebrow label on top, dot-and-line ruler
 * below. Replaces the original filled-bar indicator which read as a
 * loading spinner. Keeps to .impeccable.md principle 3 (typography
 * leads) — the wording carries more weight than the bar.
 */
function StepIndicator({ step }: { step: Step }) {
  const { index, label } = STEP_META[step]
  return (
    <div className="w-full max-w-lg mb-8 space-y-3">
      <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground text-center">
        Step {index} of {TOTAL_STEPS} · {label}
      </p>
      <div className="flex items-center gap-2" aria-hidden>
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => {
          const stepIdx = i + 1
          const done = stepIdx < index
          const active = stepIdx === index
          return (
            <div key={stepIdx} className="flex-1 flex items-center gap-2">
              <span
                className={cn(
                  'h-2 w-2 rounded-full transition-colors',
                  done && 'bg-primary',
                  active && 'bg-primary ring-4 ring-primary/20',
                  !done && !active && 'bg-border',
                )}
              />
              {stepIdx < TOTAL_STEPS && (
                <span
                  className={cn(
                    'h-px flex-1 transition-colors',
                    done ? 'bg-primary' : 'bg-border',
                  )}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Large pastel-tiled role picker. Each tile is a big touchable panel —
 * peach for shelter (mirrors the "pending/trust" pastel used on
 * applications and the profile-completeness nudge) and primary
 * (cherry-blossom) for foster (the app's brand pastel). The role
 * choice itself is the highest-stake decision in onboarding, so the
 * tiles deliberately lean into colour while the rest of the flow stays
 * calm.
 */
function RoleTile({
  tone,
  icon: Icon,
  title,
  description,
  onClick,
}: {
  tone: 'shelter' | 'foster'
  icon: typeof Building2
  title: string
  description: string
  onClick: () => void
}) {
  const toneClasses =
    tone === 'shelter'
      ? 'bg-peach/60 hover:bg-peach text-peach-foreground border-peach-foreground/15'
      : 'bg-primary/25 hover:bg-primary/35 text-foreground border-primary/30'
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative flex flex-col items-start gap-4 rounded-2xl border p-6 sm:p-7 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none',
        toneClasses,
      )}
    >
      <span
        className={cn(
          'flex h-12 w-12 items-center justify-center rounded-full bg-background/60 shadow-sm',
        )}
        aria-hidden
      >
        <Icon className="h-6 w-6" strokeWidth={1.6} />
      </span>
      <div className="space-y-1.5">
        <h2 className="font-display text-lg font-semibold leading-tight">{title}</h2>
        <p className="text-sm opacity-80 leading-relaxed">{description}</p>
      </div>
      <span className="mt-auto text-xs font-medium opacity-70 group-hover:opacity-100 transition-opacity">
        Continue →
      </span>
    </button>
  )
}

export default function OnboardingPage() {
  // Gate: unconfirmed-email users are bounced to /auth/verify-email, so
  // they can't create profile rows with an email they don't control.
  // DEV_MODE bypasses the check entirely — no real auth to gate against.
  const [authChecking, setAuthChecking] = useState(!DEV_MODE)

  useEffect(() => {
    if (DEV_MODE) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user }, error: authError }) => {
      if (authError) {
        console.error('[onboarding] getUser failed:', authError.message)
        toast.error('Could not check your sign-in status. Please sign in again.')
        window.location.href = '/login'
        return
      }
      if (!user) {
        window.location.href = '/login'
        return
      }
      if (!user.email_confirmed_at) {
        window.location.href = '/auth/verify-email'
        return
      }
      setAuthChecking(false)
    })
  }, [])

  const [step, setStep] = useState<Step>('role')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [shelter, setShelter] = useState({
    name: '', email: '', phone: '', location: '', ein: '', bio: '', website: '', instagram: '',
  })

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
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError) {
        console.error('[onboarding/shelter] getUser failed:', authError.message)
        setError('Could not verify your session. Please sign in again.')
        toast.error('Could not verify your session. Please sign in again.')
        setLoading(false)
        return
      }
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
        name: sanitizeText(shelter.name),
        slug,
        email: shelter.email,
        phone: shelter.phone ? sanitizeText(shelter.phone) || null : null,
        location: sanitizeText(shelter.location),
        ein: shelter.ein ? sanitizeText(shelter.ein) || null : null,
        bio: shelter.bio ? sanitizeMultiline(shelter.bio) || null : null,
        website: shelter.website ? sanitizeText(shelter.website) || null : null,
        instagram: shelter.instagram ? sanitizeText(shelter.instagram) || null : null,
      })

      if (dbError) {
        console.error('[onboarding/shelter] insert failed:', dbError.message)
        const copy = 'Could not create your shelter. Please try again.'
        setError(copy)
        toast.error(copy)
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
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError) {
        console.error('[onboarding/foster] getUser failed:', authError.message)
        setError('Could not verify your session. Please sign in again.')
        toast.error('Could not verify your session. Please sign in again.')
        setLoading(false)
        return
      }
      if (!user) {
        setError('You must be logged in.')
        toast.error('You must be logged in.')
        setLoading(false)
        return
      }

      const { error: dbError } = await supabase.from('foster_parents').insert({
        user_id: user.id,
        first_name: sanitizeText(foster.first_name),
        last_name: sanitizeText(foster.last_name),
        email: foster.email,
        phone: foster.phone ? sanitizeText(foster.phone) || null : null,
        location: sanitizeText(foster.location),
        housing_type: foster.housing_type || null,
        has_yard: foster.has_yard,
        has_other_pets: foster.has_other_pets,
        other_pets_info: foster.other_pets_info
          ? sanitizeMultiline(foster.other_pets_info) || null
          : null,
        has_children: foster.has_children,
        children_info: foster.children_info
          ? sanitizeMultiline(foster.children_info) || null
          : null,
        experience: foster.experience || null,
        bio: foster.bio ? sanitizeMultiline(foster.bio) || null : null,
      })

      if (dbError) {
        console.error('[onboarding/foster] insert failed:', dbError.message)
        const copy = 'Could not create your profile. Please try again.'
        setError(copy)
        toast.error(copy)
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

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (step === 'role') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
        <div className="flex items-center gap-2 font-display font-bold text-xl mb-10">
          <PawPrint className="h-7 w-7 text-primary" />
          Fostr Fix
        </div>
        <StepIndicator step={step} />
        <h1 className="font-display text-3xl font-semibold mb-2 text-center tracking-tight">
          How will you use Fostr Fix?
        </h1>
        <p className="text-muted-foreground mb-10 text-center">
          Pick the role that fits — you can always add another account later.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 w-full max-w-2xl">
          <RoleTile
            tone="shelter"
            icon={Building2}
            title="I'm a Shelter / Rescue"
            description="List dogs that need foster homes and manage applications from foster parents."
            onClick={() => setStep('shelter-form')}
          />
          <RoleTile
            tone="foster"
            icon={Heart}
            title="I'm a Foster Parent"
            description="Browse dogs near you and apply to provide a temporary loving home."
            onClick={() => setStep('foster-form')}
          />
        </div>
      </div>
    )
  }

  if (step === 'shelter-form') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
        <StepIndicator step={step} />
        <Card className="w-full max-w-xl">
          <CardContent className="pt-6">
            <div className="mb-6 space-y-1.5">
              <h1 className="font-display text-2xl font-semibold tracking-tight">
                Tell us about your shelter
              </h1>
              <p className="text-sm text-muted-foreground">
                This info is visible to foster parents on your public shelter page.
              </p>
            </div>
            <form onSubmit={handleShelterSubmit} className="space-y-6">
              {error && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
              )}

              <FormEyebrow>Identity</FormEyebrow>

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
              </div>

              <Separator />

              <FormEyebrow>Contact</FormEyebrow>

              <div className="grid grid-cols-2 gap-3">
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
                <div className="space-y-1">
                  <Label>Website</Label>
                  <Input
                    placeholder="https://..."
                    value={shelter.website}
                    onChange={(e) => setShelter({ ...shelter, website: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Instagram Handle</Label>
                  <Input
                    placeholder="@happypaws"
                    value={shelter.instagram}
                    onChange={(e) => setShelter({ ...shelter, instagram: e.target.value })}
                  />
                </div>
              </div>

              <Separator />

              <FormEyebrow description="Optional. A short mission statement helps fosters trust you faster.">
                About
              </FormEyebrow>

              <div className="space-y-1">
                <Label>Short Bio</Label>
                <Textarea
                  placeholder="Tell foster parents about your organization..."
                  value={shelter.bio}
                  onChange={(e) => setShelter({ ...shelter, bio: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Button type="submit" disabled={loading}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up…</> : 'Complete setup'}
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
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
      <StepIndicator step={step} />
      <Card className="w-full max-w-xl">
        <CardContent className="pt-6">
          <div className="mb-6 space-y-1.5">
            <h1 className="font-display text-2xl font-semibold tracking-tight">
              Tell us about yourself
            </h1>
            <p className="text-sm text-muted-foreground">
              Helps shelters get to know you as a foster parent.
            </p>
          </div>
          <form onSubmit={handleFosterSubmit} className="space-y-6">
            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{error}</p>
            )}

            <FormEyebrow>Identity</FormEyebrow>

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
            </div>

            <Separator />

            <FormEyebrow description="Helps shelters match dogs to your home.">
              Home & experience
            </FormEyebrow>

            <div className="grid grid-cols-2 gap-3">
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

              <div className="col-span-2 flex flex-wrap gap-6">
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
            </div>

            <Separator />

            <FormEyebrow description="Optional. A short intro helps shelters say yes.">
              About you
            </FormEyebrow>

            <div className="space-y-1">
              <Label>About You</Label>
              <Textarea
                placeholder="Tell shelters about yourself and your fostering experience..."
                value={foster.bio}
                onChange={(e) => setFoster({ ...foster, bio: e.target.value })}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up…</> : 'Complete setup'}
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
