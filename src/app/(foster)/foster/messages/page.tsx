import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'

export default function FosterMessagesPage() {
  // TODO: fetch message threads from Supabase
  const threads: [] = []

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Messages</h1>

      {threads.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Once a shelter accepts your application, you&apos;ll be able to message them here."
        />
      ) : (
        <div className="space-y-2">
          {/* TODO: map threads */}
          <Card>
            <CardContent className="p-4">
              <Link href="/foster/messages/placeholder-id" className="block hover:opacity-80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Buddy · Happy Paws Rescue</p>
                    <p className="text-sm text-muted-foreground truncate">
                      We&apos;d love to have you meet Buddy!
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">1h ago</span>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
