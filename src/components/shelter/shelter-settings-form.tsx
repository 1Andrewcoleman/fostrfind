'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import type { Shelter } from '@/types/database'

interface ShelterSettingsFormProps {
  initialData: Shelter
}

export function ShelterSettingsForm({ initialData }: ShelterSettingsFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
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
              {/* Logo placeholder — upload not yet wired */}
              <div className="space-y-2">
                <Label>Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-lg bg-muted border flex items-center justify-center">
                    <Upload className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled>
                    Upload Logo
                  </Button>
                </div>
              </div>

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
