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
import type { Shelter } from '@/types/database'

interface ShelterSettingsFormProps {
  initialData: Shelter
}

export function ShelterSettingsForm({ initialData }: ShelterSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
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

    try {
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
          name: shelter.name,
          slug: shelter.slug,
          email: shelter.email,
          phone: shelter.phone || null,
          location: shelter.location,
          bio: shelter.bio || null,
          website: shelter.website || null,
          instagram: shelter.instagram || null,
          logo_url: logoUrl,
        })
        .eq('id', initialData.id)

      if (error) {
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
                  />
                </div>
                <div className="space-y-1">
                  <Label>URL Slug</Label>
                  <Input
                    value={shelter.slug}
                    onChange={(e) => setShelter({ ...shelter, slug: e.target.value })}
                    placeholder="happy-paws-rescue"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={shelter.email}
                    onChange={(e) => setShelter({ ...shelter, email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Phone</Label>
                  <Input
                    value={shelter.phone}
                    onChange={(e) => setShelter({ ...shelter, phone: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Location</Label>
                  <Input
                    value={shelter.location}
                    onChange={(e) => setShelter({ ...shelter, location: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Website</Label>
                  <Input
                    value={shelter.website}
                    onChange={(e) => setShelter({ ...shelter, website: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Instagram</Label>
                  <Input
                    value={shelter.instagram}
                    onChange={(e) => setShelter({ ...shelter, instagram: e.target.value })}
                    placeholder="@handle"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label>Bio</Label>
                  <Textarea
                    rows={4}
                    value={shelter.bio}
                    onChange={(e) => setShelter({ ...shelter, bio: e.target.value })}
                  />
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
