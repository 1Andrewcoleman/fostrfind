import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/empty-state'

export default function ShelterMessagesPage() {
  // TODO: fetch message threads from Supabase
  const threads: [] = []

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Messages</h1>

      {threads.length === 0 ? (
        <EmptyState
          title="No messages yet"
          description="Messaging opens automatically after you accept a foster application."
        />
      ) : (
        <div className="space-y-2">
          {/* TODO: map threads */}
          <Card>
            <CardContent className="p-4">
              <Link href="/shelter/messages/placeholder-id" className="block hover:opacity-80">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Buddy · Jane Doe</p>
                    <p className="text-sm text-muted-foreground truncate">
                      Looking forward to meeting Buddy!
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">2h ago</span>
                </div>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
