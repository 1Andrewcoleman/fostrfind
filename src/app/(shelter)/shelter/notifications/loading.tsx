import { Skeleton } from '@/components/ui/skeleton'

export default function ShelterNotificationsLoading() {
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
