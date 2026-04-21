import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, MapPin, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import { EmptyState } from '@/components/empty-state'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { RemoveFromRosterButton } from '@/app/(foster)/foster/shelters-roster/remove-button'

export const metadata: Metadata = { title: 'Shelters who have you on their roster' }

interface RosterRow {
  shelter_id: string
  added_at: string
  source: 'application_accepted' | 'invite_accepted'
  shelter: {
    id: string
    name: string
    slug: string | null
    location: string
    logo_url: string | null
  } | null
}

const PLACEHOLDER_ROSTER: RosterRow[] = [
  {
    shelter_id: 's1',
    added_at: '2026-03-12T00:00:00Z',
    source: 'application_accepted',
    shelter: {
      id: 's1',
      name: 'Happy Paws Rescue',
      slug: 'happy-paws-rescue',
      location: 'Austin, TX',
      logo_url: null,
    },
  },
]

export default async function FosterRosterPage(): Promise<React.JSX.Element> {
  let rows: RosterRow[] = []
  let fetchError = false

  if (DEV_MODE) {
    rows = PLACEHOLDER_ROSTER
  } else {
    try {
      const supabase = await createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) redirect('/login')

      const { data: fosterRow } = await supabase
        .from('foster_parents')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!fosterRow) redirect('/onboarding')
      const fosterId = (fosterRow as { id: string }).id

      const { data, error } = await supabase
        .from('shelter_fosters')
        .select(
          'shelter_id, added_at, source, shelter:shelters(id, name, slug, location, logo_url)',
        )
        .eq('foster_id', fosterId)
        .order('added_at', { ascending: false })

      if (error) throw error
      rows = (data ?? []) as unknown as RosterRow[]
    } catch (e) {
      if (isNextControlFlowError(e)) throw e
      console.error(
        '[foster/shelters-roster] load failed:',
        e instanceof Error ? e.message : String(e),
      )
      fetchError = true
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Your shelters</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          These shelters have you on their roster. They can see your public
          foster profile and may reach out about future fosters. You can leave
          a roster at any time — this doesn{"'"}t affect any active applications.
        </p>
      </div>

      {fetchError ? (
        <ServerErrorPanel />
      ) : rows.length === 0 ? (
        <EmptyState
          illustration="shelter"
          title="No shelters yet"
          description="When a shelter adds you to their roster — either by accepting your application or by sending you an invite — they'll show up here."
          action={{ label: 'Browse dogs', href: '/foster/browse' }}
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <RosterCard key={row.shelter_id} row={row} />
          ))}
        </ul>
      )}
    </div>
  )
}

function RosterCard({ row }: { row: RosterRow }) {
  const shelter = row.shelter
  const shelterName = shelter?.name ?? 'Unknown shelter'
  const shelterLocation = shelter?.location ?? ''
  const profileHref = shelter?.slug ? `/shelters/${shelter.slug}` : null
  const addedAtDate = new Date(row.added_at)
  const addedAt = Number.isNaN(addedAtDate.valueOf())
    ? null
    : addedAtDate.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          {shelter?.logo_url ? (
            <AvatarImage src={shelter.logo_url} alt={shelterName} />
          ) : null}
          <AvatarFallback className="bg-muted">
            <Building2 className="h-5 w-5 text-muted-foreground" />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold truncate">{shelterName}</div>
              {shelterLocation && (
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{shelterLocation}</span>
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[11px] font-normal">
                  {row.source === 'application_accepted'
                    ? 'From accepted application'
                    : 'From invite'}
                </Badge>
                {addedAt && (
                  <span className="text-xs text-muted-foreground">
                    Added {addedAt}
                  </span>
                )}
              </div>
            </div>
            {profileHref && (
              <Link
                href={profileHref}
                className="shrink-0 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                View
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-end border-t pt-4">
        <RemoveFromRosterButton
          shelterId={row.shelter_id}
          shelterName={shelterName}
        />
      </div>
    </Card>
  )
}
