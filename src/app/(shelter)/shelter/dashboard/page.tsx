import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Dog, FileText, MessageCircle } from 'lucide-react'

export const metadata: Metadata = { title: 'Dashboard' }
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { ApplicationCard } from '@/components/shelter/application-card'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import { getGreeting } from '@/lib/helpers'
import { isNextControlFlowError } from '@/lib/server-errors'
import type { ApplicationWithDetails } from '@/types/database'

interface DashboardStats {
  activeDogs: number
  pendingApplications: number
  unreadMessages: number
}

export default async function ShelterDashboard(): Promise<React.JSX.Element> {
  let stats: DashboardStats = { activeDogs: 0, pendingApplications: 0, unreadMessages: 0 }
  let recentApplications: ApplicationWithDetails[] = []
  let shelterName = 'your shelter'
  let fetchError = false

  if (!DEV_MODE) {
    try {
      const supabase = await createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!user) redirect('/login')

      // Missing row is a valid state (new user → onboarding), so use
      // maybeSingle so this path doesn't turn into a fetch failure.
      const { data: shelterRow, error: shelterError } = await supabase
        .from('shelters')
        .select('id, name')
        .eq('user_id', user.id)
        .maybeSingle()

      if (shelterError) throw shelterError
      if (!shelterRow) redirect('/onboarding')

      const shelterId = shelterRow.id
      shelterName = shelterRow.name ?? 'your shelter'

      // Unread messages need to be scoped to this shelter's application threads.
      // Without this filter, RLS would still scope reads, but then a shelter
      // with multiple accounts (test / transfer / etc.) could double-count,
      // and the query is clearer when the filter is explicit.
      const { data: shelterAppIdsRows, error: shelterAppIdsError } = await supabase
        .from('applications')
        .select('id')
        .eq('shelter_id', shelterId)
        .in('status', ['accepted', 'completed'])
      if (shelterAppIdsError) throw shelterAppIdsError
      const shelterAppIds = (shelterAppIdsRows ?? []).map((r) => r.id)

      const [dogsCount, appsCount, messagesCount, recentApps] = await Promise.all([
        supabase
          .from('dogs')
          .select('*', { count: 'exact', head: true })
          .eq('shelter_id', shelterId)
          .eq('status', 'available'),
        supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .eq('shelter_id', shelterId)
          .in('status', ['submitted', 'reviewing']),
        shelterAppIds.length === 0
          ? Promise.resolve({ count: 0, error: null })
          : supabase
              .from('messages')
              .select('*', { count: 'exact', head: true })
              .in('application_id', shelterAppIds)
              .eq('sender_role', 'foster')
              .eq('read', false),
        supabase
          .from('applications')
          .select('*, dog:dogs(*), foster:foster_parents(*), shelter:shelters(*)')
          .eq('shelter_id', shelterId)
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      if (dogsCount.error || appsCount.error || (messagesCount as { error?: unknown }).error || recentApps.error) {
        throw (
          dogsCount.error ||
          appsCount.error ||
          (messagesCount as { error?: unknown }).error ||
          recentApps.error
        )
      }

      stats = {
        activeDogs: dogsCount.count ?? 0,
        pendingApplications: appsCount.count ?? 0,
        unreadMessages: messagesCount.count ?? 0,
      }

      recentApplications = (recentApps.data ?? []) as ApplicationWithDetails[]
    } catch (e) {
      if (isNextControlFlowError(e)) throw e
      console.error('[shelter/dashboard] load failed:', e instanceof Error ? e.message : String(e))
      fetchError = true
    }
  }

  if (fetchError) {
    return <ServerErrorPanel />
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">{getGreeting()}, {shelterName}</h1>
          <p className="text-muted-foreground text-sm mt-1">Here&apos;s what&apos;s happening today.</p>
        </div>
        <Button asChild>
          <Link href="/shelter/dogs/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Dog
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warm/25 text-foreground/80">
                <Dog className="h-4 w-4" />
              </span>
              Active Listings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-extrabold">{stats.activeDogs}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-peach/25 text-foreground/80">
                <FileText className="h-4 w-4" />
              </span>
              Pending Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-extrabold">{stats.pendingApplications}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/25 text-foreground/80">
                <MessageCircle className="h-4 w-4" />
              </span>
              Unread Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-extrabold">{stats.unreadMessages}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Applications */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-display font-semibold">Recent Applications</CardTitle>
          {recentApplications.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/shelter/applications">View all</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {recentApplications.length === 0 ? (
            <EmptyState
              illustration="applications"
              title="No applications yet"
              description="Applications will appear here once fosters apply to your dogs."
              action={
                stats.activeDogs === 0
                  ? { label: 'Add your first dog', href: '/shelter/dogs/new' }
                  : { label: 'View applications', href: '/shelter/applications' }
              }
            />
          ) : (
            <div className="space-y-3">
              {recentApplications.map((app) => (
                <ApplicationCard key={app.id} application={app} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Your Dogs */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-display font-semibold">Your Dogs</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/shelter/dogs">View all</Link>
          </Button>
        </div>
        {stats.activeDogs === 0 ? (
          <EmptyState
            illustration="dog"
            title="No dogs listed yet"
            description="Add your first dog to start receiving foster applications."
            action={{ label: 'Add Dog', href: '/shelter/dogs/new' }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            You have {stats.activeDogs} active listing{stats.activeDogs !== 1 ? 's' : ''}.{' '}
            <Link href="/shelter/dogs" className="text-primary hover:underline">
              Manage your dogs
            </Link>
          </p>
        )}
      </section>
    </div>
  )
}
