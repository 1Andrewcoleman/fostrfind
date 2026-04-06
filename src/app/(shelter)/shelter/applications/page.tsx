import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/empty-state'

export default function ShelterApplicationsPage() {
  // TODO: fetch applications for this shelter from Supabase
  const applications: [] = []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Applications</h1>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="submitted">New</TabsTrigger>
          <TabsTrigger value="reviewing">Reviewing</TabsTrigger>
          <TabsTrigger value="accepted">Accepted</TabsTrigger>
          <TabsTrigger value="declined">Declined</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>
      </Tabs>

      {applications.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="Foster parents will apply here once you list some dogs."
        />
      ) : (
        <div className="space-y-3">
          {/* TODO: map over applications and render <ApplicationCard application={app} /> */}
        </div>
      )}
    </div>
  )
}
