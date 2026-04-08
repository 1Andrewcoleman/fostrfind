'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/empty-state'
import { ApplicationCard } from '@/components/shelter/application-card'
import type { ApplicationWithDetails } from '@/types/database'

interface ShelterApplicationsListProps {
  applications: ApplicationWithDetails[]
}

const TAB_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'New' },
  { value: 'reviewing', label: 'Reviewing' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'declined', label: 'Declined' },
  { value: 'completed', label: 'Completed' },
] as const

export function ShelterApplicationsList({ applications }: ShelterApplicationsListProps) {
  const [activeTab, setActiveTab] = useState('all')

  const filtered =
    activeTab === 'all'
      ? applications
      : applications.filter((a) => a.status === activeTab)

  return (
    <>
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          {TAB_FILTERS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description={
            activeTab === 'all'
              ? 'Foster parents will apply here once you list some dogs.'
              : `No ${activeTab} applications found.`
          }
          action={
            activeTab === 'all'
              ? { label: 'Add a dog', href: '/shelter/dogs/new' }
              : undefined
          }
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((application) => (
            <ApplicationCard key={application.id} application={application} />
          ))}
        </div>
      )}
    </>
  )
}
