import { Skeleton } from '@/components/ui/skeleton'

/**
 * Matches the confirmation page's centered shape so the post-submit
 * navigation doesn't flash the applications-list skeleton from the
 * parent segment.
 */
export default function SubmittedLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6">
      <div className="flex flex-col items-center space-y-3">
        <Skeleton className="h-14 w-14 rounded-full" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-5 w-96 max-w-full" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
      <div className="flex justify-center gap-3">
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-10 w-36" />
      </div>
    </div>
  )
}
