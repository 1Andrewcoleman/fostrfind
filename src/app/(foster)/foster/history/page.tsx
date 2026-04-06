import { EmptyState } from '@/components/empty-state'

export default function FosterHistoryPage() {
  // TODO: fetch completed applications + ratings for this foster from Supabase
  const placements: [] = []
  const totalPlacements = 0
  const averageRating = 0

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Foster History</h1>

      {/* Stats */}
      {totalPlacements > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-lg border p-4 text-center">
            <p className="text-3xl font-bold">{totalPlacements}</p>
            <p className="text-sm text-muted-foreground">Total Placements</p>
          </div>
          <div className="rounded-lg border p-4 text-center">
            <p className="text-3xl font-bold">{averageRating > 0 ? averageRating.toFixed(1) : '—'}</p>
            <p className="text-sm text-muted-foreground">Average Rating</p>
          </div>
        </div>
      )}

      {placements.length === 0 ? (
        <EmptyState
          title="No foster history yet"
          description="Your completed fosters will appear here. Each one makes a difference — keep going!"
          action={{ label: 'Browse Dogs', href: '/foster/browse' }}
        />
      ) : (
        <div className="space-y-3">
          {/* TODO: map over placements and render <FosterHistoryCard application={p} rating={ratings[p.id]} /> */}
        </div>
      )}
    </div>
  )
}
