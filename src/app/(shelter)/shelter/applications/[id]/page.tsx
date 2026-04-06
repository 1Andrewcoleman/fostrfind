import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from '@/components/status-badge'
import { FosterProfileView } from '@/components/shelter/foster-profile-view'
import { AcceptDeclineButtons } from '@/components/shelter/accept-decline-buttons'
import { formatDate } from '@/lib/helpers'
import type { FosterParent } from '@/types/database'

interface ApplicationDetailPageProps {
  params: { id: string }
}

// Placeholder data — remove when Supabase fetch is wired
const PLACEHOLDER_FOSTER: FosterParent = {
  id: 'placeholder',
  created_at: new Date().toISOString(),
  user_id: 'placeholder',
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane@example.com',
  phone: null,
  location: 'Austin, TX',
  latitude: null,
  longitude: null,
  housing_type: 'house',
  has_yard: true,
  has_other_pets: false,
  other_pets_info: null,
  has_children: false,
  children_info: null,
  experience: 'some',
  bio: 'I love dogs and have fostered before.',
  avatar_url: null,
  pref_size: ['medium', 'large'],
  pref_age: ['adult'],
  pref_medical: false,
  max_distance: 25,
}

export default async function ApplicationDetailPage({ params }: ApplicationDetailPageProps) {
  // TODO: fetch application with dog + foster + shelter from Supabase
  // const supabase = await createClient()
  const status = 'submitted' // placeholder
  const appliedDate = new Date().toISOString() // placeholder
  const note = 'I would love to foster this dog!' // placeholder

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/shelter/applications"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Applications
      </Link>

      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Application Detail</h1>
        <StatusBadge status={status} />
        <span className="text-sm text-muted-foreground ml-auto">
          {formatDate(appliedDate)}
        </span>
      </div>

      {/* Foster profile */}
      <Card>
        <CardContent className="pt-6">
          <FosterProfileView foster={PLACEHOLDER_FOSTER} ratings={[]} />
        </CardContent>
      </Card>

      {/* Foster note */}
      {note && (
        <div>
          <h3 className="font-medium mb-2">Message from Foster</h3>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm">{note}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Accept / Decline */}
      <div>
        <h3 className="font-medium mb-3">Decision</h3>
        <AcceptDeclineButtons
          applicationId={params.id}
          currentStatus={status}
          dogName="Buddy"
          fosterName="Jane Doe"
        />
      </div>

      {/* Shelter note (internal) */}
      <div>
        <Label>Internal Note</Label>
        <Textarea
          placeholder="Add a private note about this application (not visible to the foster)..."
          className="mt-1"
          rows={3}
        />
        {/* TODO: save shelter_note to Supabase on blur/submit */}
      </div>
    </div>
  )
}
