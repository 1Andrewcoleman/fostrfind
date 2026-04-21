'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
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
import { Card, CardContent } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { FormEyebrow } from '@/components/ui/form-eyebrow'
import { StickySaveBar } from '@/components/ui/sticky-save-bar'
import {
  AvatarLogoField,
  type AvatarLogoFieldHandle,
} from '@/components/avatar-logo-field'
import { ProfileCompleteness } from '@/components/foster/profile-completeness'
import { createClient } from '@/lib/supabase/client'
import {
  DOG_SIZES,
  DOG_AGES,
  HOUSING_TYPES,
  EXPERIENCE_LEVELS,
  DOG_SIZE_LABELS,
  DOG_AGE_LABELS,
  STORAGE_BUCKETS,
} from '@/lib/constants'
import { fosterProfileSchema } from '@/lib/schemas'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { useDirtyState } from '@/lib/use-dirty-state'
import type { FosterParent } from '@/types/database'

interface FosterProfileFormProps {
  initialData: FosterParent | null
}

/** Fallback used when a brand-new foster has no row yet. Defined outside
 * the component so it shares identity across renders (matters for the
 * useDirtyState snapshot). */
const EMPTY_FOSTER: Partial<FosterParent> = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  location: '',
  housing_type: undefined,
  has_yard: false,
  has_other_pets: false,
  has_children: false,
  experience: undefined,
  bio: '',
  avatar_url: null,
  pref_size: [],
  pref_age: [],
  pref_medical: false,
  max_distance: 25,
}

/** Renders a small warm-tinted check next to a field label once the
 * user has supplied a non-empty value and there's no error for it.
 * Purely decorative — the actual validation lives in the zod schema. */
function ValidIndicator({ show }: { show: boolean }) {
  if (!show) return null
  return (
    <Check
      aria-hidden
      className="h-3.5 w-3.5 text-warm-foreground/70"
      strokeWidth={2.5}
    />
  )
}

export function FosterProfileForm({ initialData }: FosterProfileFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  // Per-field error copy from the last validation pass. We intentionally
  // keep the existing setState-driven UI (multi-select prefs, refs) rather
  // than a full react-hook-form rewrite; see docs/roadmap.md Deferred
  // Follow-ups for the full RHF migration of this form.
  const [errors, setErrors] = useState<Record<string, string>>({})
  const avatarFieldRef = useRef<AvatarLogoFieldHandle>(null)
  const initialFoster = useMemo<Partial<FosterParent>>(
    () => initialData ?? EMPTY_FOSTER,
    [initialData],
  )
  const [foster, setFoster] = useState<Partial<FosterParent>>(initialFoster)
  const isDirty = useDirtyState(foster, initialFoster)

  function togglePref(key: 'pref_size' | 'pref_age', value: string): void {
    const arr = foster[key] ?? []
    setFoster({
      ...foster,
      [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
    })
  }

  function handleDiscard(): void {
    setFoster(initialFoster)
    setErrors({})
  }

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    try {
      const supabase = createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) {
        console.error('[foster-profile-form] getUser failed:', authError.message)
        toast.error('Could not verify your session. Please sign in again.')
        return
      }
      if (!user) {
        toast.error('You must be logged in to save your profile.')
        return
      }

      // Client-side validation before we attempt any side effects. This
      // mirrors the server-side constraints so users see inline errors
      // instead of a generic "Failed to save" after a round trip.
      const parsed = fosterProfileSchema.safeParse({
        first_name: foster.first_name ?? '',
        last_name: foster.last_name ?? '',
        email: foster.email || user.email || '',
        phone: foster.phone ?? '',
        location: foster.location ?? '',
        housing_type: foster.housing_type ?? null,
        has_yard: foster.has_yard ?? false,
        has_other_pets: foster.has_other_pets ?? false,
        other_pets_info: foster.other_pets_info ?? '',
        has_children: foster.has_children ?? false,
        children_info: foster.children_info ?? '',
        experience: foster.experience ?? null,
        bio: foster.bio ?? '',
        pref_size: foster.pref_size ?? [],
        pref_age: foster.pref_age ?? [],
        pref_medical: foster.pref_medical ?? false,
        max_distance: foster.max_distance ?? 25,
      })

      if (!parsed.success) {
        const fieldErrors: Record<string, string> = {}
        for (const issue of parsed.error.issues) {
          const key = issue.path[0]
          if (typeof key === 'string' && !fieldErrors[key]) {
            fieldErrors[key] = issue.message
          }
        }
        setErrors(fieldErrors)
        toast.error('Please fix the highlighted fields.')
        return
      }

      // Upload any pending avatar (and clean up the old one) before
      // writing the row. A failed upload aborts the save so the DB
      // doesn't end up pointing at a URL that doesn't exist yet.
      let avatarUrl: string | null = foster.avatar_url ?? null
      try {
        const flushed = await avatarFieldRef.current?.flush()
        avatarUrl = flushed ?? null
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Avatar upload failed.'
        toast.error(message)
        return
      }

      // Strip HTML-ish content from free-text fields before persisting
      // so exports / emails / future plaintext views stay safe.
      const payload = {
        ...parsed.data,
        first_name: sanitizeText(parsed.data.first_name),
        last_name: sanitizeText(parsed.data.last_name),
        location: sanitizeText(parsed.data.location),
        phone: parsed.data.phone ? sanitizeText(parsed.data.phone) || null : null,
        other_pets_info: parsed.data.other_pets_info
          ? sanitizeMultiline(parsed.data.other_pets_info) || null
          : null,
        children_info: parsed.data.children_info
          ? sanitizeMultiline(parsed.data.children_info) || null
          : null,
        bio: parsed.data.bio ? sanitizeMultiline(parsed.data.bio) || null : null,
        housing_type: parsed.data.housing_type ?? null,
        experience: parsed.data.experience ?? null,
        avatar_url: avatarUrl,
      }

      // The foster profile row is always pre-created by the onboarding
      // flow, so we .update rather than .upsert here. An earlier
      // .upsert(..., { onConflict: 'user_id' }) silently failed because
      // foster_parents has no UNIQUE(user_id) constraint — logged under
      // roadmap §25 for a proper DB-level fix.
      const { error } = await supabase
        .from('foster_parents')
        .update(payload)
        .eq('user_id', user.id)

      if (error) {
        toast.error('Failed to save profile. Please try again.')
        return
      }

      toast.success('Profile saved successfully.')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  // Field-level validity helpers used by the inline ValidIndicator. A
  // field reads as "valid" if it has a non-empty value and didn't show
  // up in the last parse pass.
  const v = (field: string, value: string | null | undefined): boolean =>
    !errors[field] && !!value && value.trim().length > 0

  return (
    <>
      <ProfileCompleteness foster={foster} />

      <form onSubmit={handleSave} className="space-y-8">
        <Card>
          <CardContent className="space-y-6 pt-6">
            <FormEyebrow description="How you appear to shelters and fosters.">
              Identity
            </FormEyebrow>

            <AvatarLogoField
              ref={avatarFieldRef}
              initialUrl={initialData?.avatar_url ?? null}
              bucket={STORAGE_BUCKETS.FOSTER_AVATARS}
              shape="circle"
              label="Profile photo"
              helperText="JPEG, PNG, or WebP up to 10 MB. Shown on your applications and in messages with shelters."
            />

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label>First Name</Label>
                  <ValidIndicator show={v('first_name', foster.first_name)} />
                </div>
                <Input
                  value={foster.first_name ?? ''}
                  onChange={(e) => setFoster({ ...foster, first_name: e.target.value })}
                  aria-invalid={errors.first_name ? 'true' : undefined}
                />
                {errors.first_name && (
                  <p className="text-xs text-destructive">{errors.first_name}</p>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label>Last Name</Label>
                  <ValidIndicator show={v('last_name', foster.last_name)} />
                </div>
                <Input
                  value={foster.last_name ?? ''}
                  onChange={(e) => setFoster({ ...foster, last_name: e.target.value })}
                  aria-invalid={errors.last_name ? 'true' : undefined}
                />
                {errors.last_name && (
                  <p className="text-xs text-destructive">{errors.last_name}</p>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label>Email</Label>
                  <ValidIndicator show={v('email', foster.email)} />
                </div>
                <Input
                  type="email"
                  value={foster.email ?? ''}
                  onChange={(e) => setFoster({ ...foster, email: e.target.value })}
                  aria-invalid={errors.email ? 'true' : undefined}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label>Phone</Label>
                  <ValidIndicator show={v('phone', foster.phone)} />
                </div>
                <Input
                  value={foster.phone ?? ''}
                  onChange={(e) => setFoster({ ...foster, phone: e.target.value })}
                  aria-invalid={errors.phone ? 'true' : undefined}
                />
                {errors.phone && (
                  <p className="text-xs text-destructive">{errors.phone}</p>
                )}
              </div>
              <div className="col-span-2 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label>Location</Label>
                  <ValidIndicator show={v('location', foster.location)} />
                </div>
                <Input
                  placeholder="City, State"
                  value={foster.location ?? ''}
                  onChange={(e) => setFoster({ ...foster, location: e.target.value })}
                  aria-invalid={errors.location ? 'true' : undefined}
                />
                {errors.location && (
                  <p className="text-xs text-destructive">{errors.location}</p>
                )}
              </div>
            </div>

            <Separator />

            <FormEyebrow description="Helps shelters match dogs to your home.">
              Home & experience
            </FormEyebrow>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label>Housing Type</Label>
                  <ValidIndicator show={!!foster.housing_type} />
                </div>
                <Select
                  value={foster.housing_type ?? ''}
                  onValueChange={(val) =>
                    setFoster({ ...foster, housing_type: val as FosterParent['housing_type'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {HOUSING_TYPES.map((h) => (
                      <SelectItem key={h} value={h} className="capitalize">
                        {h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label>Experience</Label>
                  <ValidIndicator show={!!foster.experience} />
                </div>
                <Select
                  value={foster.experience ?? ''}
                  onValueChange={(val) =>
                    setFoster({ ...foster, experience: val as FosterParent['experience'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPERIENCE_LEVELS.map((e) => (
                      <SelectItem key={e} value={e} className="capitalize">
                        {e}
                      </SelectItem>
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
                  <Label htmlFor="yard" className="font-normal cursor-pointer">
                    Has yard
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="pets"
                    checked={foster.has_other_pets}
                    onCheckedChange={(c) => setFoster({ ...foster, has_other_pets: c === true })}
                  />
                  <Label htmlFor="pets" className="font-normal cursor-pointer">
                    Has other pets
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="kids"
                    checked={foster.has_children}
                    onCheckedChange={(c) => setFoster({ ...foster, has_children: c === true })}
                  />
                  <Label htmlFor="kids" className="font-normal cursor-pointer">
                    Has children
                  </Label>
                </div>
              </div>
            </div>

            <Separator />

            <FormEyebrow description="Optional. A short intro goes a long way.">
              About you
            </FormEyebrow>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Label>Bio</Label>
                <ValidIndicator show={v('bio', foster.bio)} />
              </div>
              <Textarea
                rows={4}
                value={foster.bio ?? ''}
                onChange={(e) => setFoster({ ...foster, bio: e.target.value })}
                aria-invalid={errors.bio ? 'true' : undefined}
              />
              {errors.bio && <p className="text-xs text-destructive">{errors.bio}</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-6 pt-6">
            <FormEyebrow description="Used to match dogs to you when shelters post new listings.">
              Foster preferences
            </FormEyebrow>

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
                    <Label htmlFor={`pref-size-${size}`} className="font-normal cursor-pointer">
                      {DOG_SIZE_LABELS[size]}
                    </Label>
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
                    <Label htmlFor={`pref-age-${age}`} className="font-normal cursor-pointer">
                      {DOG_AGE_LABELS[age]}
                    </Label>
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

        <StickySaveBar
          loading={loading}
          dirty={isDirty}
          onDiscard={handleDiscard}
          saveLabel="Save profile"
        />
      </form>
    </>
  )
}
