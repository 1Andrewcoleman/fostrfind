import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

export const metadata: Metadata = { title: 'Dashboard' }
import { FileText, Heart, MessageCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { StaggerItem } from '@/components/ui/stagger-item'
import { ApplicationStatusCard } from '@/components/foster/application-status-card'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import { getGreeting } from '@/lib/helpers'
import { isNextControlFlowError } from '@/lib/server-errors'
import type { ApplicationWithDetails } from '@/types/database'

interface DashboardStats {
  activeApplications: number
  currentlyFostering: number
  unreadMessages: number
}

export default async function FosterDashboard(): Promise<React.JSX.Element> {
  let stats: DashboardStats = {
    activeApplications: 0,
    currentlyFostering: 0,
    unreadMessages: 0,
  }
  let recentApplications: ApplicationWithDetails[] = []
  let firstName = 'there'
  let fetchError = false

  if (!DEV_MODE) {
    try {
      const supabase = await createClient()
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()

      if (authError) throw authError
      if (!user) {
        redirect('/login')
      }

      // Missing row is a valid state (new user → onboarding). maybeSingle
      // keeps that path alive instead of raising an error here.
      const { data: fosterRow, error: fosterError } = await supabase
        .from('foster_parents')
        .select('id, first_name')
        .eq('user_id', user.id)
        .maybeSingle()

      if (fosterError) throw fosterError
      if (!fosterRow) {
        redirect('/onboarding')
      }

      const fosterId = fosterRow.id
      firstName = fosterRow.first_name || 'there'

      const { data: myAppIdsRows, error: myAppIdsError } = await supabase
        .from('applications')
        .select('id')
        .eq('foster_id', fosterId)
        .in('status', ['accepted', 'completed'])
      if (myAppIdsError) throw myAppIdsError
      const myAppIds = (myAppIdsRows ?? []).map((r) => r.id)

      const [activeAppsCount, currentlyFosteringCount, unreadMessagesCount, recentApps] =
        await Promise.all([
          supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .eq('foster_id', fosterId)
            .in('status', ['submitted', 'reviewing', 'accepted']),
          supabase
            .from('applications')
            .select('*', { count: 'exact', head: true })
            .eq('foster_id', fosterId)
            .eq('status', 'accepted'),
          myAppIds.length === 0
            ? Promise.resolve({ count: 0, error: null })
            : supabase
                .from('messages')
                .select('*', { count: 'exact', head: true })
                .in('application_id', myAppIds)
                .neq('sender_role', 'foster')
                .eq('read', false),
          supabase
            .from('applications')
            .select('*, dog:dogs(*), foster:foster_parents(*), shelter:shelters(*)')
            .eq('foster_id', fosterId)
            .order('created_at', { ascending: false })
            .limit(5),
        ])

      if (
        activeAppsCount.error ||
        currentlyFosteringCount.error ||
        (unreadMessagesCount as { error?: unknown }).error ||
        recentApps.error
      ) {
        throw (
          activeAppsCount.error ||
          currentlyFosteringCount.error ||
          (unreadMessagesCount as { error?: unknown }).error ||
          recentApps.error
        )
      }

      stats = {
        activeApplications: activeAppsCount.count ?? 0,
        currentlyFostering: currentlyFosteringCount.count ?? 0,
        unreadMessages: unreadMessagesCount.count ?? 0,
      }

      recentApplications = (recentApps.data ?? []) as ApplicationWithDetails[]
    } catch (e) {
      if (isNextControlFlowError(e)) throw e
      console.error('[foster/dashboard] load failed:', e instanceof Error ? e.message : String(e))
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
          <h1 className="text-2xl font-display font-bold">
            {getGreeting()}, {firstName}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Here&apos;s what&apos;s happening with your foster journey.
          </p>
        </div>
        <Button asChild>
          <Link href="/foster/browse">
            <Search className="mr-2 h-4 w-4" />
            Browse Dogs
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StaggerItem index={0}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-peach/25 text-foreground/80">
                  <FileText className="h-4 w-4" />
                </span>
                Active Applications
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-extrabold">{stats.activeApplications}</p>
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem index={1}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-warm/25 text-foreground/80">
                  <Heart className="h-4 w-4" />
                </span>
                Currently Fostering
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-extrabold">{stats.currentlyFostering}</p>
            </CardContent>
          </Card>
        </StaggerItem>

        <StaggerItem index={2}>
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
        </StaggerItem>
      </div>

      {/* Recent Applications */}
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-display font-semibold">Recent Applications</CardTitle>
          {recentApplications.length > 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/foster/applications">View all</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {recentApplications.length === 0 ? (
            <EmptyState
              illustration="applications"
              title="No applications yet"
              description="Browse available dogs and submit your first application."
              action={{ label: 'Browse Dogs', href: '/foster/browse' }}
            />
          ) : (
            <div className="space-y-3">
              {recentApplications.map((app, i) => (
                <StaggerItem key={app.id} index={i}>
                  <ApplicationStatusCard application={app} />
                </StaggerItem>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
