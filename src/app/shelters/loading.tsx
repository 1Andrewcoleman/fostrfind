import { PawPrint } from 'lucide-react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export default function SheltersIndexLoading(): React.JSX.Element {
  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <PawPrint className="h-6 w-6" />
            Fostr Fix
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Home
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-5xl px-4 py-10 md:py-14 space-y-8">
          <div className="space-y-3">
            <Skeleton className="h-10 w-40" />
            <Skeleton className="h-4 w-2/3 max-w-2xl" />
            <Skeleton className="h-4 w-1/2 max-w-xl" />
          </div>

          <Skeleton className="h-10 w-full max-w-md rounded-md" />

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="flex flex-col p-5 gap-4">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
                <div className="mt-auto space-y-2 pt-2">
                  <Skeleton className="h-8 w-full rounded-md" />
                  <Skeleton className="h-8 w-full rounded-md" />
                </div>
              </Card>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
