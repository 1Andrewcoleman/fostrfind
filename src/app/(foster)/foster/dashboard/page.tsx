import Link from 'next/link'
import { redirect } from 'next/navigation'
import { FileText, Heart, MessageCircle, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { ApplicationStatusCard } from '@/components/foster/application-status-card'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import { getGreeting } from '@/lib/helpers'
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

  if (!DEV_MODE) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: fosterRow } = await supabase
      .from('foster_parents')
      .select('id, first_name')
      .eq('user_id', user.id)
      .single()

    if (!fosterRow) {
      redirect('/onboarding')
    }

    const fosterId = fosterRow.id
    firstName = fosterRow.first_name || 'there'

    // Unread messages are scoped to this foster's message threads.
    // Fetch the thread ids first so we can filter messages correctly.
    const { data: myAppIdsRows } = await supabase
      .from('applications')
      .select('id')
      .eq('foster_id', fosterId)
      .in('status', ['accepted', 'completed'])
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
          ? Promise.resolve({ count: 0 })
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

    stats = {
      activeApplications: activeAppsCount.count ?? 0,
      currentlyFostering: currentlyFosteringCount.count ?? 0,
      unreadMessages: unreadMessagesCount.count ?? 0,
    }

    recentApplications = (recentApps.data ?? []) as ApplicationWithDetails[]
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <FileText className="h-4 w-4" />
              </span>
              Active Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-extrabold">{stats.activeApplications}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100 text-green-700">
                <Heart className="h-4 w-4" />
              </span>
              Currently Fostering
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-extrabold">{stats.currentlyFostering}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 text-sky-700">
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
              <Link href="/foster/applications">View all</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {recentApplications.length === 0 ? (
            <EmptyState
              title="No applications yet"
              description="Browse available dogs and submit your first application."
              action={{ label: 'Browse Dogs', href: '/foster/browse' }}
            />
          ) : (
            <div className="space-y-3">
              {recentApplications.map((app) => (
                <ApplicationStatusCard key={app.id} application={app} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
