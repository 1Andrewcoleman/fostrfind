import Link from 'next/link'
import { Plus, Dog, FileText, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'

export default function ShelterDashboard() {
  // TODO: fetch real data from Supabase
  const stats = { activeDogs: 0, pendingApplications: 0, unreadMessages: 0 }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
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
              <Dog className="h-4 w-4" />
              Active Listings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.activeDogs}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Pending Applications
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.pendingApplications}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Unread Messages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.unreadMessages}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Applications */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Recent Applications</h2>
        <EmptyState
          title="No applications yet"
          description="Applications will appear here once fosters apply to your dogs."
        />
      </section>

      {/* Your Dogs */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Dogs</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/shelter/dogs">View all</Link>
          </Button>
        </div>
        <EmptyState
          title="No dogs listed yet"
          description="Add your first dog to start receiving foster applications."
          action={{ label: 'Add Dog', href: '/shelter/dogs/new' }}
        />
      </section>
    </div>
  )
}
