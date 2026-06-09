import { Skeleton } from '@/components/ui/skeleton'

// Shared route-level loading skeletons for pages that look identical in both
// portals. Portal-specific skeletons (dashboard, applications) stay co-located
// with their routes since their shapes intentionally differ.

/** Thread list placeholder for /foster/messages and /shelter/messages. */
export function ThreadListSkeleton() {
  return (
    <div className="space-y-6 max-w-2xl">
      <Skeleton className="h-8 w-32" />

      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 flex items-start gap-3">
            <Skeleton className="h-5 w-5 mt-0.5 shrink-0 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-3 w-4/5" />
            </div>
            <Skeleton className="h-3 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Placeholder for /foster/notifications and /shelter/notifications. */
export function NotificationsSkeleton() {
  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-80 max-w-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, idx) => (
          <Skeleton key={idx} className="h-20 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}
