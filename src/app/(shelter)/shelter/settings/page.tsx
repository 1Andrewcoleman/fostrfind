'use client'

import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

export default function ShelterSettingsPage() {
  const [loading, setLoading] = useState(false)
  const [shelter, setShelter] = useState({
    name: '', slug: '', email: '', phone: '', location: '', bio: '', website: '', instagram: '',
  })

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // TODO: update shelters table in Supabase
    console.log('Save shelter settings:', shelter)
    setLoading(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

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
                {/* Logo upload */}
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-lg bg-muted border flex items-center justify-center">
                      <Upload className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <Button type="button" variant="outline" size="sm">
                      Upload Logo
                    </Button>
                    {/* TODO: wire to Supabase Storage */}
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
                  {loading ? 'Saving...' : 'Save Changes'}
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
                <Input type="email" placeholder="your@email.com" disabled />
                <p className="text-xs text-muted-foreground">
                  Contact support to change your email address.
                </p>
              </div>
              <Button variant="outline">Change Password</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
