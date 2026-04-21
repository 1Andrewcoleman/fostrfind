import { Skeleton } from '@/components/ui/skeleton'

export default function ShelterFosterDetailLoading() {
  return (
    <div className="space-y-6 max-w-3xl">
      <Skeleton className="h-5 w-32" />
      <div className="flex items-start gap-4">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-5 w-48" />
        </div>
      </div>
      <Skeleton className="h-32 w-full rounded-lg" />
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  )
}
