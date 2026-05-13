'use client'

import { useEffect, useState } from 'react'
import { useForm, Controller, type SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import {
  shelterOnboardingSchema,
  fosterOnboardingSchema,
  type ShelterOnboardingInput,
  type FosterOnboardingInput,
} from '@/lib/schemas'
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

/**
 * Map an API error payload onto an inline form error string. Used by
 * both onboarding forms. 422 responses carry per-field `details`; we
 * surface the first message per field via `setError`, with a fallback
 * banner if the response is shaped differently.
 */
interface ApiErrorBody {
  error?: string
  details?: Record<string, string[] | undefined>
}

async function readErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    return (await response.json()) as ApiErrorBody
  } catch {
    return {}
  }
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
          Fostr Find
        </div>
        <StepIndicator step={step} />
        <h1 className="font-display text-3xl font-semibold mb-2 text-center tracking-tight">
          How will you use Fostr Find?
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
    return <ShelterForm onBack={() => setStep('role')} />
  }

  return <FosterForm onBack={() => setStep('role')} />
}

/**
 * Shelter onboarding form. POSTs to `/api/onboarding/shelter` which
 * validates + sanitizes + inserts under the caller's JWT. Client-side
 * Zod via `zodResolver` runs the same schema as the server for
 * immediate UX feedback; 422 responses (rare — schema drift) surface
 * per-field errors via `setError`.
 */
function ShelterForm({ onBack }: { onBack: () => void }) {
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ShelterOnboardingInput>({
    resolver: zodResolver(shelterOnboardingSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      location: '',
      ein: '',
      bio: '',
      website: '',
      instagram: '',
    },
  })

  const onSubmit: SubmitHandler<ShelterOnboardingInput> = async (values) => {
    setSubmitError(null)

    if (DEV_MODE) {
      window.location.href = '/shelter/dashboard'
      return
    }

    let response: Response
    try {
      response = await fetch('/api/onboarding/shelter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
    } catch (e) {
      console.error(
        '[onboarding/shelter] network error:',
        e instanceof Error ? e.message : String(e),
      )
      const copy = 'Network error. Please check your connection and try again.'
      setSubmitError(copy)
      toast.error(copy)
      return
    }

    if (response.ok) {
      toast.success('Shelter created! Redirecting...')
      window.location.href = '/shelter/dashboard'
      return
    }

    const errorBody = await readErrorBody(response)

    if (response.status === 422 && errorBody.details) {
      for (const [field, messages] of Object.entries(errorBody.details)) {
        if (messages && messages.length > 0) {
          setError(field as keyof ShelterOnboardingInput, {
            type: 'server',
            message: messages[0],
          })
        }
      }
      const copy = errorBody.error ?? 'Please fix the highlighted fields.'
      setSubmitError(copy)
      return
    }

    if (response.status === 401) {
      const copy = 'Please sign in again to continue.'
      setSubmitError(copy)
      toast.error(copy)
      return
    }

    if (response.status === 409) {
      const copy = errorBody.error ?? 'A shelter profile already exists for this account.'
      setSubmitError(copy)
      toast.error(copy)
      return
    }

    if (response.status === 429) {
      const copy = 'Too many requests. Please wait a moment and try again.'
      setSubmitError(copy)
      toast.error(copy)
      return
    }

    console.error('[onboarding/shelter] submit failed:', {
      status: response.status,
      error: errorBody.error,
    })
    const copy = errorBody.error ?? 'Could not create your shelter. Please try again.'
    setSubmitError(copy)
    toast.error(copy)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
      <StepIndicator step="shelter-form" />
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            {submitError && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{submitError}</p>
            )}

            <FormEyebrow>Identity</FormEyebrow>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="shelter-name">Shelter / Rescue Name *</Label>
                <Input
                  id="shelter-name"
                  placeholder="Happy Paws Rescue"
                  aria-invalid={errors.name ? 'true' : undefined}
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="shelter-location">Location (City, State) *</Label>
                <Input
                  id="shelter-location"
                  placeholder="Austin, TX"
                  aria-invalid={errors.location ? 'true' : undefined}
                  {...register('location')}
                />
                {errors.location && (
                  <p className="text-xs text-destructive">{errors.location.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="shelter-ein">EIN (501c3)</Label>
                <Input
                  id="shelter-ein"
                  placeholder="12-3456789"
                  aria-invalid={errors.ein ? 'true' : undefined}
                  {...register('ein')}
                />
                {errors.ein && (
                  <p className="text-xs text-destructive">{errors.ein.message}</p>
                )}
              </div>
            </div>

            <Separator />

            <FormEyebrow>Contact</FormEyebrow>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="shelter-email">Email *</Label>
                <Input
                  id="shelter-email"
                  type="email"
                  placeholder="info@shelter.org"
                  aria-invalid={errors.email ? 'true' : undefined}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="shelter-phone">Phone</Label>
                <Input
                  id="shelter-phone"
                  placeholder="(555) 000-0000"
                  aria-invalid={errors.phone ? 'true' : undefined}
                  {...register('phone')}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="shelter-website">Website</Label>
                <Input
                  id="shelter-website"
                  placeholder="https://..."
                  aria-invalid={errors.website ? 'true' : undefined}
                  {...register('website')}
                />
                {errors.website && (
                  <p className="text-xs text-destructive">{errors.website.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="shelter-instagram">Instagram Handle</Label>
                <Input
                  id="shelter-instagram"
                  placeholder="@happypaws"
                  aria-invalid={errors.instagram ? 'true' : undefined}
                  {...register('instagram')}
                />
                {errors.instagram && (
                  <p className="text-xs text-destructive">{errors.instagram.message}</p>
                )}
              </div>
            </div>

            <Separator />

            <FormEyebrow description="Optional. A short mission statement helps fosters trust you faster.">
              About
            </FormEyebrow>

            <div className="space-y-1">
              <Label htmlFor="shelter-bio">Short Bio</Label>
              <Textarea
                id="shelter-bio"
                placeholder="Tell foster parents about your organization..."
                rows={3}
                aria-invalid={errors.bio ? 'true' : undefined}
                {...register('bio')}
              />
              {errors.bio && (
                <p className="text-xs text-destructive">{errors.bio.message}</p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up…</> : 'Complete setup'}
              </Button>
              <Button type="button" variant="ghost" onClick={onBack} disabled={isSubmitting}>
                Back
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Foster onboarding form. POSTs to `/api/onboarding/foster` which
 * validates + sanitizes + inserts under the caller's JWT, then claims
 * any pending shelter invites for the new foster's email. Client-side
 * Zod mirrors the server schema for immediate UX feedback.
 */
function FosterForm({ onBack }: { onBack: () => void }) {
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FosterOnboardingInput>({
    resolver: zodResolver(fosterOnboardingSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      location: '',
      housing_type: null,
      has_yard: false,
      has_other_pets: false,
      other_pets_info: '',
      has_children: false,
      children_info: '',
      experience: null,
      bio: '',
    },
  })

  const onSubmit: SubmitHandler<FosterOnboardingInput> = async (values) => {
    setSubmitError(null)

    if (DEV_MODE) {
      window.location.href = '/foster/browse'
      return
    }

    let response: Response
    try {
      response = await fetch('/api/onboarding/foster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
    } catch (e) {
      console.error(
        '[onboarding/foster] network error:',
        e instanceof Error ? e.message : String(e),
      )
      const copy = 'Network error. Please check your connection and try again.'
      setSubmitError(copy)
      toast.error(copy)
      return
    }

    if (response.ok) {
      toast.success('Profile created! Redirecting...')
      window.location.href = '/foster/browse'
      return
    }

    const errorBody = await readErrorBody(response)

    if (response.status === 422 && errorBody.details) {
      for (const [field, messages] of Object.entries(errorBody.details)) {
        if (messages && messages.length > 0) {
          setError(field as keyof FosterOnboardingInput, {
            type: 'server',
            message: messages[0],
          })
        }
      }
      const copy = errorBody.error ?? 'Please fix the highlighted fields.'
      setSubmitError(copy)
      return
    }

    if (response.status === 401) {
      const copy = 'Please sign in again to continue.'
      setSubmitError(copy)
      toast.error(copy)
      return
    }

    if (response.status === 409) {
      const copy = errorBody.error ?? 'A foster profile already exists for this account.'
      setSubmitError(copy)
      toast.error(copy)
      return
    }

    if (response.status === 429) {
      const copy = 'Too many requests. Please wait a moment and try again.'
      setSubmitError(copy)
      toast.error(copy)
      return
    }

    console.error('[onboarding/foster] submit failed:', {
      status: response.status,
      error: errorBody.error,
    })
    const copy = errorBody.error ?? 'Could not create your profile. Please try again.'
    setSubmitError(copy)
    toast.error(copy)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 bg-background">
      <StepIndicator step="foster-form" />
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
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            {submitError && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{submitError}</p>
            )}

            <FormEyebrow>Identity</FormEyebrow>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="foster-first-name">First Name *</Label>
                <Input
                  id="foster-first-name"
                  aria-invalid={errors.first_name ? 'true' : undefined}
                  {...register('first_name')}
                />
                {errors.first_name && (
                  <p className="text-xs text-destructive">{errors.first_name.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="foster-last-name">Last Name *</Label>
                <Input
                  id="foster-last-name"
                  aria-invalid={errors.last_name ? 'true' : undefined}
                  {...register('last_name')}
                />
                {errors.last_name && (
                  <p className="text-xs text-destructive">{errors.last_name.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="foster-email">Email *</Label>
                <Input
                  id="foster-email"
                  type="email"
                  aria-invalid={errors.email ? 'true' : undefined}
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="foster-phone">Phone</Label>
                <Input
                  id="foster-phone"
                  aria-invalid={errors.phone ? 'true' : undefined}
                  {...register('phone')}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone.message}</p>
                )}
              </div>
              <div className="col-span-2 space-y-1">
                <Label htmlFor="foster-location">Location (City, State) *</Label>
                <Input
                  id="foster-location"
                  placeholder="Austin, TX"
                  aria-invalid={errors.location ? 'true' : undefined}
                  {...register('location')}
                />
                {errors.location && (
                  <p className="text-xs text-destructive">{errors.location.message}</p>
                )}
              </div>
            </div>

            <Separator />

            <FormEyebrow description="Helps shelters match dogs to your home.">
              Home & experience
            </FormEyebrow>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="foster-housing-type">Housing Type</Label>
                <Controller
                  control={control}
                  name="housing_type"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={(v) => field.onChange(v as (typeof HOUSING_TYPES)[number])}
                    >
                      <SelectTrigger id="foster-housing-type" aria-invalid={errors.housing_type ? 'true' : undefined}>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {HOUSING_TYPES.map((h) => (
                          <SelectItem key={h} value={h} className="capitalize">{h}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.housing_type && (
                  <p className="text-xs text-destructive">{errors.housing_type.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label htmlFor="foster-experience">Experience with Dogs</Label>
                <Controller
                  control={control}
                  name="experience"
                  render={({ field }) => (
                    <Select
                      value={field.value ?? undefined}
                      onValueChange={(v) => field.onChange(v as (typeof EXPERIENCE_LEVELS)[number])}
                    >
                      <SelectTrigger id="foster-experience" aria-invalid={errors.experience ? 'true' : undefined}>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {EXPERIENCE_LEVELS.map((e) => (
                          <SelectItem key={e} value={e} className="capitalize">{e}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.experience && (
                  <p className="text-xs text-destructive">{errors.experience.message}</p>
                )}
              </div>

              <div className="col-span-2 flex flex-wrap gap-6">
                <Controller
                  control={control}
                  name="has_yard"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="yard"
                        checked={field.value === true}
                        onCheckedChange={(c) => field.onChange(c === true)}
                      />
                      <Label htmlFor="yard" className="font-normal cursor-pointer">Has yard</Label>
                    </div>
                  )}
                />
                <Controller
                  control={control}
                  name="has_other_pets"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="pets"
                        checked={field.value === true}
                        onCheckedChange={(c) => field.onChange(c === true)}
                      />
                      <Label htmlFor="pets" className="font-normal cursor-pointer">Has other pets</Label>
                    </div>
                  )}
                />
                <Controller
                  control={control}
                  name="has_children"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="kids"
                        checked={field.value === true}
                        onCheckedChange={(c) => field.onChange(c === true)}
                      />
                      <Label htmlFor="kids" className="font-normal cursor-pointer">Has children</Label>
                    </div>
                  )}
                />
              </div>
            </div>

            <Separator />

            <FormEyebrow description="Optional. A short intro helps shelters say yes.">
              About you
            </FormEyebrow>

            <div className="space-y-1">
              <Label htmlFor="foster-bio">About You</Label>
              <Textarea
                id="foster-bio"
                placeholder="Tell shelters about yourself and your fostering experience..."
                rows={3}
                aria-invalid={errors.bio ? 'true' : undefined}
                {...register('bio')}
              />
              {errors.bio && (
                <p className="text-xs text-destructive">{errors.bio.message}</p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Setting up…</> : 'Complete setup'}
              </Button>
              <Button type="button" variant="ghost" onClick={onBack} disabled={isSubmitting}>
                Back
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
