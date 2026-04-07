'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/empty-state'
import { ApplicationStatusCard } from '@/components/foster/application-status-card'
import type { ApplicationWithDetails } from '@/types/database'

interface FosterApplicationsListProps {
  applications: ApplicationWithDetails[]
}

const TAB_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'completed', label: 'Completed' },
] as const

export function FosterApplicationsList({ applications }: FosterApplicationsListProps) {
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
              ? 'Browse available dogs and submit your first application.'
              : `No ${activeTab} applications found.`
          }
          action={activeTab === 'all' ? { label: 'Browse Dogs', href: '/foster/browse' } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((application) => (
            <ApplicationStatusCard key={application.id} application={application} />
          ))}
        </div>
      )}
    </>
  )
}
