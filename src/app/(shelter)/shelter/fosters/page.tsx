import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Search, MapPin, ArrowRight } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import { EmptyState } from '@/components/empty-state'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { InviteFosterForm } from '@/app/(shelter)/shelter/fosters/invite-form'
import { getInitials } from '@/lib/helpers'

export const metadata: Metadata = { title: 'Fosters' }

interface RosterFosterRow {
  shelter_id: string
  foster_id: string
  added_at: string
  source: 'application_accepted' | 'invite_accepted'
  foster: {
    id: string
    first_name: string
    last_name: string
    email: string
    avatar_url: string | null
    location: string
    bio: string | null
  } | null
  /** Live count of accepted applications for this foster across all shelters. */
  activeFosteringCount: number
}

interface PendingInviteRow {
  id: string
  created_at: string
  email: string
  message: string | null
  foster_id: string | null
}

interface PageProps {
  searchParams: { q?: string }
}

const PLACEHOLDER_ROSTER: RosterFosterRow[] = [
  {
    shelter_id: 's1',
    foster_id: 'f1',
    added_at: '2026-03-10T00:00:00Z',
    source: 'application_accepted',
    activeFosteringCount: 1,
    foster: {
      id: 'f1',
      first_name: 'Jane',
      last_name: 'Foster',
      email: 'jane@example.com',
      avatar_url: null,
      location: 'Austin, TX',
      bio: 'Love big dogs. Live in a house with a fenced yard and one cat.',
    },
  },
]

const PLACEHOLDER_INVITES: PendingInviteRow[] = [
  {
    id: 'i1',
    created_at: '2026-04-18T00:00:00Z',
    email: 'prospective@example.com',
    message: null,
    foster_id: null,
  },
]

function normaliseQuery(q: string | undefined): string {
  if (!q) return ''
  return q.trim().slice(0, 100)
}

export default async function ShelterFostersPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const q = normaliseQuery(searchParams.q)

  let rows: RosterFosterRow[] = []
  let pendingInvites: PendingInviteRow[] = []
  let fetchError = false

  if (DEV_MODE) {
    rows = q
      ? PLACEHOLDER_ROSTER.filter((r) =>
          `${r.foster?.first_name} ${r.foster?.last_name}`
            .toLowerCase()
            .includes(q.toLowerCase()),
        )
      : PLACEHOLDER_ROSTER
    pendingInvites = PLACEHOLDER_INVITES
  } else {
    try {
      const supabase = await createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) redirect('/login')

      const { data: shelterRow } = await supabase
        .from('shelters')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!shelterRow) redirect('/onboarding')
      const shelterId = (shelterRow as { id: string }).id

      const { data, error } = await supabase
        .from('shelter_fosters')
        .select(
          'shelter_id, foster_id, added_at, source, foster:foster_parents(id, first_name, last_name, email, avatar_url, location, bio)',
        )
        .eq('shelter_id', shelterId)
        .order('added_at', { ascending: false })

      if (error) throw error

      let baseRows = (data ?? []) as unknown as Omit<
        RosterFosterRow,
        'activeFosteringCount'
      >[]

      if (q) {
        const needle = q.toLowerCase()
        baseRows = baseRows.filter((r) => {
          const name = `${r.foster?.first_name ?? ''} ${r.foster?.last_name ?? ''}`
          return name.toLowerCase().includes(needle)
        })
      }

      const fosterIds = baseRows
        .map((r) => r.foster?.id)
        .filter((v): v is string => typeof v === 'string')

      // One grouped COUNT(*) across all rostered fosters' accepted apps.
      // A single query is cheaper than N per-row counts.
      let countByFosterId = new Map<string, number>()
      if (fosterIds.length > 0) {
        const { data: apps, error: countErr } = await supabase
          .from('applications')
          .select('foster_id')
          .in('foster_id', fosterIds)
          .eq('status', 'accepted')
        if (countErr) {
          console.warn(
            '[shelter/fosters] active-fostering count failed (showing 0):',
            countErr.message,
          )
        } else {
          const typedApps = (apps ?? []) as { foster_id: string }[]
          countByFosterId = typedApps.reduce((acc, app) => {
            acc.set(app.foster_id, (acc.get(app.foster_id) ?? 0) + 1)
            return acc
          }, new Map<string, number>())
        }
      }

      rows = baseRows.map((r) => ({
        ...r,
        activeFosteringCount: r.foster?.id ? countByFosterId.get(r.foster.id) ?? 0 : 0,
      }))

      const { data: inviteData, error: invitesErr } = await supabase
        .from('shelter_foster_invites')
        .select('id, created_at, email, message, foster_id')
        .eq('shelter_id', shelterId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50)
      if (invitesErr) {
        console.warn(
          '[shelter/fosters] pending invites fetch failed (continuing):',
          invitesErr.message,
        )
      } else {
        pendingInvites = (inviteData ?? []) as PendingInviteRow[]
      }
    } catch (e) {
      if (isNextControlFlowError(e)) throw e
      console.error(
        '[shelter/fosters] load failed:',
        e instanceof Error ? e.message : String(e),
      )
      fetchError = true
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">Your fosters</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The fosters who have applied to or been invited by your shelter.
          Invite new fosters by email below.
        </p>
      </div>

      <InviteFosterForm />

      {pendingInvites.length > 0 && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Pending invites ({pendingInvites.length})
            </h2>
          </div>
          <ul className="divide-y -mx-2">
            {pendingInvites.map((invite) => (
              <li
                key={invite.id}
                className="px-2 py-2 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{invite.email}</div>
                  <div className="text-xs text-muted-foreground">
                    Awaiting response
                  </div>
                </div>
                <form
                  action={`/api/shelter/foster-invites/${invite.id}/cancel`}
                  method="post"
                >
                  <Button type="submit" variant="ghost" size="sm">
                    Cancel
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <form method="get" className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            name="q"
            defaultValue={q}
            placeholder="Search your roster by name"
            className="pl-8"
            aria-label="Search your roster by name"
          />
        </div>
        <Button type="submit" variant="outline" size="sm">
          Search
        </Button>
        {q && (
          <Button asChild variant="ghost" size="sm">
            <Link href="/shelter/fosters">Clear</Link>
          </Button>
        )}
      </form>

      {fetchError ? (
        <ServerErrorPanel />
      ) : rows.length === 0 ? (
        <EmptyState
          illustration="paw"
          title={q ? 'No fosters match that name' : 'No fosters yet'}
          description={
            q
              ? 'Try a different query or clear the search to see everyone on your roster.'
              : 'Accept a foster application or invite someone by email above. They will appear here once they are on your roster.'
          }
          action={
            q
              ? { label: 'Clear search', href: '/shelter/fosters' }
              : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rows.map((row) => (
            <RosterFosterCard key={row.foster_id} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

function RosterFosterCard({ row }: { row: RosterFosterRow }) {
  const foster = row.foster
  const fullName =
    foster?.first_name || foster?.last_name
      ? `${foster?.first_name ?? ''} ${foster?.last_name ?? ''}`.trim()
      : foster?.email ?? 'Unknown foster'
  const initials = getInitials(fullName)
  const location = foster?.location ?? ''
  const href = `/shelter/fosters/${row.foster_id}`

  return (
    <Card className="p-5 flex flex-col gap-4">
      <div className="flex items-start gap-3">
        <Avatar className="h-11 w-11">
          {foster?.avatar_url ? <AvatarImage src={foster.avatar_url} alt={fullName} /> : null}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="font-semibold truncate">{fullName}</div>
          {location && (
            <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{location}</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary" className="font-normal">
          {row.activeFosteringCount > 0
            ? `Currently fostering ${row.activeFosteringCount}`
            : 'Not currently fostering'}
        </Badge>
        <Badge variant="outline" className="font-normal">
          {row.source === 'application_accepted' ? 'From application' : 'From invite'}
        </Badge>
      </div>
      {foster?.bio && (
        <p className="text-sm text-muted-foreground line-clamp-3">{foster.bio}</p>
      )}
      <div className="mt-auto flex items-center justify-end">
        <Button asChild size="sm" variant="outline">
          <Link href={href}>
            View
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    </Card>
  )
}
