import Link from 'next/link'
import Image from 'next/image'
import { MessageCircle, History } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/status-badge'
import { formatDate } from '@/lib/helpers'
import type { ApplicationWithDetails } from '@/types/database'

interface ApplicationStatusCardProps {
  application: ApplicationWithDetails
}

export function ApplicationStatusCard({ application }: ApplicationStatusCardProps) {
  return (
    <Card>
      <CardContent className="p-4 flex gap-4">
        {/* Dog thumbnail */}
        <div className="relative h-20 w-20 flex-shrink-0 rounded-md overflow-hidden bg-muted">
          {application.dog.photos[0] ? (
            <Image
              src={application.dog.photos[0]}
              alt={application.dog.name}
              fill
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No photo
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold">{application.dog.name}</h3>
            <StatusBadge status={application.status} />
          </div>
          <p className="text-sm text-muted-foreground">{application.shelter.name}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Applied {formatDate(application.created_at)}
          </p>

          <div className="flex gap-2 mt-3">
            {application.status === 'accepted' && (
              <Button size="sm" variant="outline" asChild>
                <Link href={`/foster/messages/${application.id}`}>
                  <MessageCircle className="mr-1 h-3 w-3" />
                  Messages
                </Link>
              </Button>
            )}
            {application.status === 'completed' && (
              <Button size="sm" variant="ghost" asChild>
                <Link href="/foster/history">
                  <History className="mr-1 h-3 w-3" />
                  View History
                </Link>
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
