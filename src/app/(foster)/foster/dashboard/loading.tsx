import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader } from '@/components/ui/card'

export default function FosterDashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-60" />
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-9 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent applications */}
      <section className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border p-4 flex items-center gap-4">
              <Skeleton className="h-20 w-20 rounded-md shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
