import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function ShelterProfileLoading(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12 space-y-8">
        <Skeleton className="h-8 w-32" />

        <Card className="overflow-hidden">
          <div className="h-24 bg-peach/30" />
          <div className="p-6 md:p-8 -mt-12 md:-mt-16 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <Skeleton className="h-24 w-24 md:h-28 md:w-28 rounded-full ring-4 ring-background" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-7 w-64" />
                <Skeleton className="h-4 w-40" />
              </div>
            </div>
            <Skeleton className="h-4 w-full max-w-2xl" />
            <Skeleton className="h-4 w-3/4 max-w-xl" />
            <div className="flex gap-2 pt-2">
              <Skeleton className="h-9 w-24 rounded-md" />
              <Skeleton className="h-9 w-28 rounded-md" />
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <div className="flex items-baseline justify-between">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border p-4 space-y-3">
                <Skeleton className="h-40 w-full rounded-lg" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
