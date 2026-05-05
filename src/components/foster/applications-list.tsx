'use client'

import { useState } from 'react'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/empty-state'
import { StaggerItem } from '@/components/ui/stagger-item'
import { ApplicationStatusCard } from '@/components/foster/application-status-card'
import type { Application, ApplicationWithDetails } from '@/types/database'

interface FosterApplicationsListProps {
  applications: ApplicationWithDetails[]
}

type TabValue = 'all' | 'submitted' | 'accepted' | 'previous'

interface TabFilter {
  value: TabValue
  label: string
  /** Statuses included in this tab. Empty array means "no filter". */
  statuses: ReadonlyArray<Application['status']>
  /** Empty-state copy when this tab has no rows. */
  emptyDescription: string
}

const TAB_FILTERS: ReadonlyArray<TabFilter> = [
  { value: 'all', label: 'All', statuses: [], emptyDescription: 'Browse available dogs and submit your first application.' },
  { value: 'submitted', label: 'Submitted', statuses: ['submitted', 'reviewing'], emptyDescription: 'No applications waiting on a shelter response.' },
  { value: 'accepted', label: 'Accepted', statuses: ['accepted'], emptyDescription: 'No accepted applications yet.' },
  // "Previous" surfaces every terminal state in one place so a foster can
  // see what happened to past applications at a glance — declined by the
  // shelter, withdrawn by the foster, or completed placements.
  { value: 'previous', label: 'Previous', statuses: ['declined', 'withdrawn', 'completed'], emptyDescription: 'No past applications yet.' },
] as const

export function FosterApplicationsList({ applications }: FosterApplicationsListProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('all')

  const tab = TAB_FILTERS.find((t) => t.value === activeTab) ?? TAB_FILTERS[0]
  const filtered =
    tab.statuses.length === 0
      ? applications
      : applications.filter((a) => tab.statuses.includes(a.status))

  return (
    <>
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
        <TabsList>
          {TAB_FILTERS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState
          illustration="applications"
          title="No applications yet"
          description={tab.emptyDescription}
          action={activeTab === 'all' ? { label: 'Browse Dogs', href: '/foster/browse' } : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((application, i) => (
            <StaggerItem key={application.id} index={i}>
              <ApplicationStatusCard application={application} />
            </StaggerItem>
          ))}
        </div>
      )}
    </>
  )
}
