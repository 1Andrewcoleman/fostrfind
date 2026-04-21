import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import { normalizeInviteEmail } from '@/lib/shelter-roster'
import { EmptyState } from '@/components/empty-state'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { Card } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { InviteActions } from '@/app/(foster)/foster/invites/invite-actions'

export const metadata: Metadata = { title: 'Invites' }

interface ShelterJoin {
  id: string
  name: string
  slug: string | null
  location: string
  logo_url: string | null
}

interface InviteRow {
  id: string
  created_at: string
  shelter_id: string
  email: string
  foster_id: string | null
  status: string
  message: string | null
  shelter: ShelterJoin | null
}

const PLACEHOLDER_INVITES: InviteRow[] = [
  {
    id: 'invite-dev-1',
    created_at: '2026-04-21T00:00:00Z',
    shelter_id: 's1',
    email: 'jane@example.com',
    foster_id: 'dev-foster-1',
    status: 'pending',
    message:
      'We loved your application for Buddy! Would you like to stay in our network for future matches?',
    shelter: {
      id: 's1',
      name: 'Happy Paws Rescue',
      slug: 'happy-paws-rescue',
      location: 'Austin, TX',
      logo_url: null,
    },
  },
]

export default async function FosterInvitesPage(): Promise<React.JSX.Element> {
  let invites: InviteRow[] = []
  let fetchError = false

  if (DEV_MODE) {
    invites = PLACEHOLDER_INVITES
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
        .select('id, email')
        .eq('user_id', user.id)
        .maybeSingle()
      if (!fosterRow) redirect('/onboarding')

      const fosterId = (fosterRow as { id: string; email: string | null }).id
      const email = normalizeInviteEmail(
        (fosterRow as { id: string; email: string | null }).email,
      )

      // Fetch the 50 most recent pending invites matching EITHER the
      // caller's foster_id OR a case-insensitive email match. The RLS
      // policy restricts this same pair at the database layer.
      const filter = email
        ? `foster_id.eq.${fosterId},email.ilike.${email}`
        : `foster_id.eq.${fosterId}`

      const { data, error } = await supabase
        .from('shelter_foster_invites')
        .select(
          'id, created_at, shelter_id, email, foster_id, status, message, shelter:shelters(id, name, slug, location, logo_url)',
        )
        .eq('status', 'pending')
        .or(filter)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      invites = (data ?? []) as unknown as InviteRow[]
    } catch (e) {
      if (isNextControlFlowError(e)) throw e
      console.error(
        '[foster/invites] load failed:',
        e instanceof Error ? e.message : String(e),
      )
      fetchError = true
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Invites</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Shelters inviting you to join their foster roster.
        </p>
      </div>

      {fetchError ? (
        <ServerErrorPanel />
      ) : invites.length === 0 ? (
        <EmptyState
          illustration="messages"
          title="No pending invites"
          description="When a shelter invites you to their roster, the invitation will show up here. You can accept or decline at any time."
          action={{ label: 'Browse dogs', href: '/foster/browse' }}
        />
      ) : (
        <ul className="space-y-3">
          {invites.map((invite) => (
            <InviteCard key={invite.id} invite={invite} />
          ))}
        </ul>
      )}
    </div>
  )
}

function InviteCard({ invite }: { invite: InviteRow }) {
  const shelter = invite.shelter
  const shelterName = shelter?.name ?? 'A shelter'
  const shelterLocation = shelter?.location ?? ''
  const profileHref = shelter?.slug ? `/shelters/${shelter.slug}` : null

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
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-semibold truncate">
                {profileHref ? (
                  <Link
                    href={profileHref}
                    className="hover:underline underline-offset-2"
                  >
                    {shelterName}
                  </Link>
                ) : (
                  shelterName
                )}
              </div>
              {shelterLocation && (
                <div className="text-xs text-muted-foreground truncate">
                  {shelterLocation}
                </div>
              )}
            </div>
            <Badge variant="secondary" className="shrink-0 gap-1">
              <span aria-hidden>✉</span>
              Invite
            </Badge>
          </div>
          {invite.message?.trim() && (
            <p className="mt-3 text-sm text-foreground whitespace-pre-wrap break-words">
              {invite.message.trim()}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <InviteActions inviteId={invite.id} shelterName={shelterName} />
      </div>
    </Card>
  )
}
