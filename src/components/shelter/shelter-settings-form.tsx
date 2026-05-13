'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { FormEyebrow } from '@/components/ui/form-eyebrow'
import { StickySaveBar } from '@/components/ui/sticky-save-bar'
import {
  AvatarLogoField,
  type AvatarLogoFieldHandle,
} from '@/components/avatar-logo-field'
import { STORAGE_BUCKETS } from '@/lib/constants'
import { shelterSettingsSchema } from '@/lib/schemas'
import { useDirtyState } from '@/lib/use-dirty-state'
import type { Shelter } from '@/types/database'

interface ShelterSettingsFormProps {
  initialData: Shelter
}

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

export function ShelterSettingsForm({ initialData }: ShelterSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  // Per-field error copy from the last validation pass. See the matching
  // comment in FosterProfileForm for why we aren't fully on RHF yet.
  const [errors, setErrors] = useState<Record<string, string>>({})
  const logoFieldRef = useRef<AvatarLogoFieldHandle>(null)

  const initialShelter = useMemo(
    () => ({
      name: initialData.name,
      slug: initialData.slug,
      email: initialData.email,
      phone: initialData.phone ?? '',
      location: initialData.location,
      bio: initialData.bio ?? '',
      website: initialData.website ?? '',
      instagram: initialData.instagram ?? '',
    }),
    [initialData],
  )
  const [shelter, setShelter] = useState(initialShelter)
  const isDirty = useDirtyState(shelter, initialShelter)

  function handleDiscard(): void {
    setShelter(initialShelter)
    setErrors({})
  }

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    try {
      // Client-side validation up-front so users see inline errors
      // instead of a 422 round trip. The server re-runs the same Zod
      // schema (and `sanitizeText` / `sanitizeMultiline`) so this is a
      // UX shortcut, not a trust boundary — the server is authoritative.
      const parsed = shelterSettingsSchema.safeParse(shelter)
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

      // Upload pending logo (if any) + clean up the old one before
      // writing the shelter row. Abort save on upload failure so the
      // DB doesn't point at a URL that was never created.
      let logoUrl: string | null = initialData.logo_url ?? null
      try {
        const flushed = await logoFieldRef.current?.flush()
        logoUrl = flushed ?? null
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Logo upload failed.'
        toast.error(message)
        return
      }

      const payload = {
        ...parsed.data,
        logo_url: logoUrl,
      }

      // PATCH the row via the server route so Zod validation + the
      // sanitize-at-boundary contract live somewhere the browser can't
      // bypass. The route returns 422 with field-level details on a
      // validation miss; we surface those inline so users can recover
      // even if the client schema and server schema ever drift.
      let res: Response
      try {
        res = await fetch(`/api/shelters/${initialData.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } catch {
        toast.error('Network error. Please check your connection and try again.')
        return
      }

      if (!res.ok) {
        let body: { error?: string; details?: Record<string, string[]> } = {}
        try {
          body = (await res.json()) as typeof body
        } catch {
          // Non-JSON error body — fall through to generic message below.
        }

        if (res.status === 422 && body.details) {
          const fieldErrors: Record<string, string> = {}
          for (const [key, messages] of Object.entries(body.details)) {
            if (Array.isArray(messages) && messages.length > 0) {
              fieldErrors[key] = messages[0]
            }
          }
          setErrors(fieldErrors)
          toast.error('Please fix the highlighted fields.')
          return
        }

        console.error('[shelter-settings] update failed:', res.status, body.error)
        toast.error(body.error ?? 'Failed to save settings. Please try again.')
        return
      }

      toast.success('Settings saved successfully.')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const v = (field: string, value: string): boolean =>
    !errors[field] && !!value && value.trim().length > 0

  return (
    <Tabs defaultValue="shelter">
      <TabsList>
        <TabsTrigger value="shelter">Shelter Info</TabsTrigger>
        <TabsTrigger value="account">Account</TabsTrigger>
      </TabsList>

      <TabsContent value="shelter" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Shelter Profile</CardTitle>
            <CardDescription>This information is visible to foster parents</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-6">
              <FormEyebrow description="Upload a square logo used on listings and the public shelter page.">
                Branding
              </FormEyebrow>

              <AvatarLogoField
                ref={logoFieldRef}
                initialUrl={initialData.logo_url ?? null}
                bucket={STORAGE_BUCKETS.SHELTER_LOGOS}
                shape="square"
                label="Logo"
                helperText="JPEG, PNG, or WebP up to 10 MB. Shown on your dog listings and the public shelter profile."
              />

              <Separator />

              <FormEyebrow description="What fosters will see first on your public profile.">
                Identity
              </FormEyebrow>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label>Shelter Name</Label>
                    <ValidIndicator show={v('name', shelter.name)} />
                  </div>
                  <Input
                    value={shelter.name}
                    onChange={(e) => setShelter({ ...shelter, name: e.target.value })}
                    aria-invalid={errors.name ? 'true' : undefined}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label>URL Slug</Label>
                    <ValidIndicator show={v('slug', shelter.slug)} />
                  </div>
                  <Input
                    value={shelter.slug}
                    onChange={(e) => setShelter({ ...shelter, slug: e.target.value })}
                    placeholder="happy-paws-rescue"
                    aria-invalid={errors.slug ? 'true' : undefined}
                  />
                  {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label>Location</Label>
                    <ValidIndicator show={v('location', shelter.location)} />
                  </div>
                  <Input
                    value={shelter.location}
                    onChange={(e) => setShelter({ ...shelter, location: e.target.value })}
                    aria-invalid={errors.location ? 'true' : undefined}
                  />
                  {errors.location && (
                    <p className="text-xs text-destructive">{errors.location}</p>
                  )}
                </div>
              </div>

              <Separator />

              <FormEyebrow description="How shelters and fosters reach you about placements.">
                Contact
              </FormEyebrow>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label>Email</Label>
                    <ValidIndicator show={v('email', shelter.email)} />
                  </div>
                  <Input
                    type="email"
                    value={shelter.email}
                    onChange={(e) => setShelter({ ...shelter, email: e.target.value })}
                    aria-invalid={errors.email ? 'true' : undefined}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label>Phone</Label>
                    <ValidIndicator show={v('phone', shelter.phone)} />
                  </div>
                  <Input
                    value={shelter.phone}
                    onChange={(e) => setShelter({ ...shelter, phone: e.target.value })}
                    aria-invalid={errors.phone ? 'true' : undefined}
                  />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label>Website</Label>
                    <ValidIndicator show={v('website', shelter.website)} />
                  </div>
                  <Input
                    value={shelter.website}
                    onChange={(e) => setShelter({ ...shelter, website: e.target.value })}
                    aria-invalid={errors.website ? 'true' : undefined}
                  />
                  {errors.website && (
                    <p className="text-xs text-destructive">{errors.website}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Label>Instagram</Label>
                    <ValidIndicator show={v('instagram', shelter.instagram)} />
                  </div>
                  <Input
                    value={shelter.instagram}
                    onChange={(e) => setShelter({ ...shelter, instagram: e.target.value })}
                    placeholder="@handle"
                    aria-invalid={errors.instagram ? 'true' : undefined}
                  />
                  {errors.instagram && (
                    <p className="text-xs text-destructive">{errors.instagram}</p>
                  )}
                </div>
              </div>

              <Separator />

              <FormEyebrow description="Optional. A short mission statement helps fosters understand your work.">
                About
              </FormEyebrow>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <Label>Bio</Label>
                  <ValidIndicator show={v('bio', shelter.bio)} />
                </div>
                <Textarea
                  rows={4}
                  value={shelter.bio}
                  onChange={(e) => setShelter({ ...shelter, bio: e.target.value })}
                  aria-invalid={errors.bio ? 'true' : undefined}
                />
                {errors.bio && <p className="text-xs text-destructive">{errors.bio}</p>}
              </div>

              <StickySaveBar
                loading={loading}
                dirty={isDirty}
                onDiscard={handleDiscard}
              />
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="account" className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Manage your login credentials</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={initialData.email} disabled />
              <p className="text-xs text-muted-foreground">
                Contact support to change your email address.
              </p>
            </div>
            <Button variant="outline">Change Password</Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
