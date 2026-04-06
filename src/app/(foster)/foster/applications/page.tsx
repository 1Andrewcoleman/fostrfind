import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/empty-state'

export default function FosterApplicationsPage() {
  // TODO: fetch applications for this foster from Supabase
  const applications: [] = []

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">My Applications</h1>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="submitted">Submitted</TabsTrigger>
          <TabsTrigger value="accepted">Accepted</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {applications.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Browse available dogs and submit your first application."
          action={{ label: 'Browse Dogs', href: '/foster/browse' }}
        />
      ) : (
        <div className="space-y-3">
          {/* TODO: map over applications and render <ApplicationStatusCard application={app} /> */}
        </div>
      )}
    </div>
  )
}
