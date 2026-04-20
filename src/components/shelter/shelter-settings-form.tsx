'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  AvatarLogoField,
  type AvatarLogoFieldHandle,
} from '@/components/avatar-logo-field'
import { createClient } from '@/lib/supabase/client'
import { STORAGE_BUCKETS } from '@/lib/constants'
import { shelterSettingsSchema } from '@/lib/schemas'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import type { Shelter } from '@/types/database'

interface ShelterSettingsFormProps {
  initialData: Shelter
}

export function ShelterSettingsForm({ initialData }: ShelterSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  // Per-field error copy from the last validation pass. See the matching
  // comment in FosterProfileForm for why we aren't fully on RHF yet.
  const [errors, setErrors] = useState<Record<string, string>>({})
  const logoFieldRef = useRef<AvatarLogoFieldHandle>(null)
  const [shelter, setShelter] = useState({
    name: initialData.name,
    slug: initialData.slug,
    email: initialData.email,
    phone: initialData.phone ?? '',
    location: initialData.location,
    bio: initialData.bio ?? '',
    website: initialData.website ?? '',
    instagram: initialData.instagram ?? '',
  })

  async function handleSave(e: React.FormEvent): Promise<void> {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    try {
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

      const supabase = createClient()

      const { error } = await supabase
        .from('shelters')
        .update({
          name: sanitizeText(parsed.data.name),
          slug: parsed.data.slug,
          email: parsed.data.email,
          phone: parsed.data.phone ? sanitizeText(parsed.data.phone) || null : null,
          location: sanitizeText(parsed.data.location),
          bio: parsed.data.bio ? sanitizeMultiline(parsed.data.bio) || null : null,
          website: parsed.data.website ? sanitizeText(parsed.data.website) || null : null,
          instagram: parsed.data.instagram ? sanitizeText(parsed.data.instagram) || null : null,
          logo_url: logoUrl,
        })
        .eq('id', initialData.id)

      if (error) {
        console.error('[shelter-settings] update failed:', error.message)
        toast.error('Failed to save settings. Please try again.')
        return
      }

      toast.success('Settings saved successfully.')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

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
            <form onSubmit={handleSave} className="space-y-4">
              <AvatarLogoField
                ref={logoFieldRef}
                initialUrl={initialData.logo_url ?? null}
                bucket={STORAGE_BUCKETS.SHELTER_LOGOS}
                shape="square"
                label="Logo"
                helperText="JPEG, PNG, or WebP up to 10 MB. Shown on your dog listings and the public shelter profile."
              />

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-1">
                  <Label>Shelter Name</Label>
                  <Input
                    value={shelter.name}
                    onChange={(e) => setShelter({ ...shelter, name: e.target.value })}
                    aria-invalid={errors.name ? 'true' : undefined}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1">
                  <Label>URL Slug</Label>
                  <Input
                    value={shelter.slug}
                    onChange={(e) => setShelter({ ...shelter, slug: e.target.value })}
                    placeholder="happy-paws-rescue"
                    aria-invalid={errors.slug ? 'true' : undefined}
                  />
                  {errors.slug && <p className="text-xs text-destructive">{errors.slug}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={shelter.email}
                    onChange={(e) => setShelter({ ...shelter, email: e.target.value })}
                    aria-invalid={errors.email ? 'true' : undefined}
                  />
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input
                    value={shelter.phone}
                    onChange={(e) => setShelter({ ...shelter, phone: e.target.value })}
                    aria-invalid={errors.phone ? 'true' : undefined}
                  />
                  {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Location</Label>
                  <Input
                    value={shelter.location}
                    onChange={(e) => setShelter({ ...shelter, location: e.target.value })}
                    aria-invalid={errors.location ? 'true' : undefined}
                  />
                  {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Website</Label>
                  <Input
                    value={shelter.website}
                    onChange={(e) => setShelter({ ...shelter, website: e.target.value })}
                    aria-invalid={errors.website ? 'true' : undefined}
                  />
                  {errors.website && <p className="text-xs text-destructive">{errors.website}</p>}
                </div>
                <div className="space-y-1">
                  <Label>Instagram</Label>
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
                <div className="col-span-2 space-y-1">
                  <Label>Bio</Label>
                  <Textarea
                    rows={4}
                    value={shelter.bio}
                    onChange={(e) => setShelter({ ...shelter, bio: e.target.value })}
                    aria-invalid={errors.bio ? 'true' : undefined}
                  />
                  {errors.bio && <p className="text-xs text-destructive">{errors.bio}</p>}
                </div>
              </div>

              <Button type="submit" disabled={loading}>
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
              </Button>
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
