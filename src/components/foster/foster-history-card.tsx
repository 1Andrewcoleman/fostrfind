import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { StarRating } from '@/components/star-rating'
import { formatDate } from '@/lib/helpers'
import type { ApplicationWithDetails, Rating } from '@/types/database'

interface FosterHistoryCardProps {
  application: ApplicationWithDetails
  rating?: Rating
}

export function FosterHistoryCard({ application, rating }: FosterHistoryCardProps) {
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
        <div className="flex-1">
          <h3 className="font-semibold">{application.dog.name}</h3>
          <p className="text-sm text-muted-foreground">{application.shelter.name}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDate(application.created_at)} → {formatDate(application.updated_at)}
          </p>

          <div className="mt-2">
            {rating ? (
              <div className="flex items-center gap-2">
                <StarRating value={rating.score} size="sm" />
                {rating.comment && (
                  <span className="text-xs text-muted-foreground italic">
                    &ldquo;{rating.comment}&rdquo;
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">Not yet rated</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
