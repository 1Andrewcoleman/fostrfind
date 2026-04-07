import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { FosterProfileView } from '@/components/shelter/foster-profile-view'
import { AcceptDeclineButtons } from '@/components/shelter/accept-decline-buttons'
import { ShelterNoteEditor } from '@/components/shelter/shelter-note-editor'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/helpers'
import type { ApplicationWithDetails, Rating } from '@/types/database'

const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')

interface ApplicationDetailPageProps {
  params: { id: string }
}

export default async function ApplicationDetailPage({
  params,
}: ApplicationDetailPageProps): Promise<React.JSX.Element> {
  if (DEV_MODE) {
    return (
      <div className="max-w-2xl space-y-6">
        <p className="text-sm text-muted-foreground">
          Application detail requires a live Supabase connection. Enable it by setting
          NEXT_PUBLIC_SUPABASE_URL in your environment.
        </p>
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch application with all related data
  const { data: application } = await supabase
    .from('applications')
    .select('*, dog:dogs(*), foster:foster_parents(*), shelter:shelters(*)')
    .eq('id', params.id)
    .single()

  if (!application) {
    notFound()
  }

  const app = application as ApplicationWithDetails

  // Verify the current user owns this shelter
  if (app.shelter.user_id !== user.id) {
    redirect('/shelter/applications')
  }

  // Fetch ratings for this foster parent
  const { data: ratingsData } = await supabase
    .from('ratings')
    .select('*')
    .eq('foster_id', app.foster.id)
    .order('created_at', { ascending: false })

  const ratings = (ratingsData ?? []) as Rating[]
  const fosterName = `${app.foster.first_name} ${app.foster.last_name}`

  // A rating is tied to a specific application, not just the foster.
  // Checking here avoids showing the "Rate Foster" button when one already exists.
  const hasExistingRating = ratings.some((r) => r.application_id === app.id)

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
        <StatusBadge status={app.status} />
        <span className="text-sm text-muted-foreground ml-auto">
          {formatDate(app.created_at)}
        </span>
      </div>

      {/* Dog being applied for */}
      <div className="rounded-lg border p-4">
        <p className="text-sm text-muted-foreground">Dog</p>
        <p className="font-semibold">{app.dog.name}</p>
        {app.dog.breed && (
          <p className="text-sm text-muted-foreground">{app.dog.breed}</p>
        )}
      </div>

      {/* Foster profile */}
      <Card>
        <CardContent className="pt-6">
          <FosterProfileView foster={app.foster} ratings={ratings} />
        </CardContent>
      </Card>

      {/* Foster note */}
      {app.note && (
        <div>
          <h3 className="font-medium mb-2">Message from Foster</h3>
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm">{app.note}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Accept / Decline / Complete */}
      <div>
        <h3 className="font-medium mb-3">Decision</h3>
        <AcceptDeclineButtons
          applicationId={app.id}
          currentStatus={app.status}
          dogName={app.dog.name}
          fosterName={fosterName}
          hasExistingRating={hasExistingRating}
        />
      </div>

      {/* Shelter internal note */}
      <ShelterNoteEditor applicationId={app.id} initialNote={app.shelter_note} />
    </div>
  )
}
