import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Dog, FileText, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'
import { ApplicationCard } from '@/components/shelter/application-card'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import type { ApplicationWithDetails } from '@/types/database'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

interface DashboardStats {
  activeDogs: number
  pendingApplications: number
  unreadMessages: number
}

export default async function ShelterDashboard(): Promise<React.JSX.Element> {
  let stats: DashboardStats = { activeDogs: 0, pendingApplications: 0, unreadMessages: 0 }
  let recentApplications: ApplicationWithDetails[] = []
  let shelterName = 'your shelter'

  if (!DEV_MODE) {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const { data: shelterRow } = await supabase
      .from('shelters')
      .select('id, name')
      .eq('user_id', user.id)
      .single()

    if (!shelterRow) {
      redirect('/onboarding')
    }

    const shelterId = shelterRow.id
    shelterName = shelterRow.name ?? 'your shelter'

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
      supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('sender_role', 'foster')
        .eq('read', false),
      supabase
        .from('applications')
        .select('*, dog:dogs(*), foster:foster_parents(*), shelter:shelters(*)')
        .eq('shelter_id', shelterId)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    stats = {
      activeDogs: dogsCount.count ?? 0,
      pendingApplications: appsCount.count ?? 0,
      unreadMessages: messagesCount.count ?? 0,
    }

    recentApplications = (recentApps.data ?? []) as ApplicationWithDetails[]
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
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
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
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
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
              <Link href="/shelter/applications">View all</Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {recentApplications.length === 0 ? (
            <EmptyState
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
