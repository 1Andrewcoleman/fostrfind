import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, MessageCircle } from 'lucide-react'

/**
 * Dynamic tab title — "<First Last>'s application" — so shelter staff
 * can skim between multiple open detail tabs. Must never throw; falls
 * back to a generic title on any error path.
 */
export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  if (DEV_MODE) return { title: 'Application' }
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('applications')
      .select('foster:foster_parents(first_name, last_name)')
      .eq('id', params.id)
      .maybeSingle()
    const foster = data?.foster as { first_name?: string; last_name?: string } | null
    const name = `${foster?.first_name ?? ''} ${foster?.last_name ?? ''}`.trim()
    return { title: name ? `${name}'s Application` : 'Application' }
  } catch {
    return { title: 'Application' }
  }
}
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { FosterProfileView } from '@/components/shelter/foster-profile-view'
import { AcceptDeclineButtons } from '@/components/shelter/accept-decline-buttons'
import { ShelterNoteEditor } from '@/components/shelter/shelter-note-editor'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/helpers'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import type { ApplicationWithDetails, Rating } from '@/types/database'

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

  let app: ApplicationWithDetails | null = null
  let ratings: Rating[] = []
  let fetchError = false

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) throw authError
    if (!user) redirect('/login')

    const { data: application, error: applicationError } = await supabase
      .from('applications')
      .select('*, dog:dogs(*), foster:foster_parents(*), shelter:shelters(*)')
      .eq('id', params.id)
      .single()

    if (applicationError) throw applicationError
    if (!application) notFound()

    app = application as ApplicationWithDetails

    // Verify the current user owns this shelter
    if (app.shelter.user_id !== user.id) redirect('/shelter/applications')

    const { data: ratingsData, error: ratingsError } = await supabase
      .from('ratings')
      .select('*')
      .eq('foster_id', app.foster.id)
      .order('created_at', { ascending: false })

    if (ratingsError) throw ratingsError
    ratings = (ratingsData ?? []) as Rating[]
  } catch (e) {
    if (isNextControlFlowError(e)) throw e
    console.error('[shelter/applications/:id] load failed:', e instanceof Error ? e.message : String(e))
    fetchError = true
  }

  if (fetchError || !app) {
    return (
      <div className="max-w-2xl space-y-6">
        <Link
          href="/shelter/applications"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Applications
        </Link>
        <ServerErrorPanel />
      </div>
    )
  }

  const appId = app.id
  const fosterName = `${app.foster.first_name} ${app.foster.last_name}`

  // A rating is tied to a specific application, not just the foster.
  // Checking here avoids showing the "Rate Foster" button when one already exists.
  const hasExistingRating = ratings.some((r) => r.application_id === appId)

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/shelter/applications"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Applications
      </Link>

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Application Detail</h1>
        <StatusBadge status={app.status} />
        <span className="text-sm text-muted-foreground ml-auto">
          {formatDate(app.created_at)}
        </span>
        {(app.status === 'accepted' || app.status === 'completed') && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/shelter/messages/${app.id}`}>
              <MessageCircle className="mr-2 h-4 w-4" />
              Message Foster
            </Link>
          </Button>
        )}
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
