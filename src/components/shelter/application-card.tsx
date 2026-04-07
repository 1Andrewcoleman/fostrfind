import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/status-badge'
import { StarRating } from '@/components/star-rating'
import { formatDate, getInitials } from '@/lib/helpers'
import { cn } from '@/lib/utils'
import type { ApplicationWithDetails } from '@/types/database'

interface ApplicationCardProps {
  application: ApplicationWithDetails
  averageRating?: number
}

export function ApplicationCard({ application, averageRating = 0 }: ApplicationCardProps) {
  const fosterName = `${application.foster.first_name} ${application.foster.last_name}`

  return (
    <Link href={`/shelter/applications/${application.id}`}>
      <Card className={cn(
        'hover:shadow-md transition-all cursor-pointer',
        application.status === 'accepted' && 'border-l-[3px] border-l-green-500',
      )}>
        <CardContent className="p-4 flex items-center gap-4">
          <Avatar>
            <AvatarImage src={application.foster.avatar_url ?? undefined} />
            <AvatarFallback>{getInitials(fosterName)}</AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium">{fosterName}</span>
              <StatusBadge status={application.status} />
            </div>
            <p className="text-sm text-muted-foreground truncate">
              Applied for <span className="font-semibold text-foreground">{application.dog.name}</span>
            </p>
            <div className="flex items-center gap-2 mt-1">
              <StarRating value={averageRating} size="sm" />
              {averageRating > 0 && (
                <span className="text-xs text-muted-foreground">{averageRating}</span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDate(application.created_at)}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
