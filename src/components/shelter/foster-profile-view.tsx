import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { StarRating } from '@/components/star-rating'
import { getInitials } from '@/lib/helpers'
import type { FosterParent, Rating } from '@/types/database'
import { MapPin, Home, Dog, Baby, Briefcase } from 'lucide-react'

interface FosterProfileViewProps {
  foster: FosterParent
  ratings?: Rating[]
}

export function FosterProfileView({ foster, ratings = [] }: FosterProfileViewProps) {
  const fosterName = `${foster.first_name} ${foster.last_name}`
  const avgRating =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, r) => a + r.score, 0) / ratings.length) * 10) / 10
      : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={foster.avatar_url ?? undefined} />
          <AvatarFallback className="text-lg">{getInitials(fosterName)}</AvatarFallback>
        </Avatar>
        <div>
          <h2 className="text-xl font-bold">{fosterName}</h2>
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <MapPin className="h-4 w-4" />
            <span>{foster.location}</span>
          </div>
          {ratings.length > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <StarRating value={avgRating} size="sm" />
              <span className="text-sm text-muted-foreground">
                {avgRating} ({ratings.length} foster{ratings.length !== 1 ? 's' : ''})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="flex items-center gap-2">
          <Home className="h-4 w-4 text-muted-foreground" />
          <span className="capitalize">{foster.housing_type ?? 'Not specified'}</span>
          {foster.has_yard && <Badge variant="secondary" className="text-xs">Has yard</Badge>}
        </div>

        <div className="flex items-center gap-2">
          <Dog className="h-4 w-4 text-muted-foreground" />
          {foster.has_other_pets ? (
            <span>{foster.other_pets_info ?? 'Has other pets'}</span>
          ) : (
            <span className="text-muted-foreground">No other pets</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Baby className="h-4 w-4 text-muted-foreground" />
          {foster.has_children ? (
            <span>{foster.children_info ?? 'Has children'}</span>
          ) : (
            <span className="text-muted-foreground">No children</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-muted-foreground" />
          <span className="capitalize">{foster.experience ?? 'No'} experience</span>
        </div>
      </div>

      {/* Bio */}
      {foster.bio && (
        <div>
          <h3 className="font-medium mb-1">About</h3>
          <p className="text-sm text-muted-foreground">{foster.bio}</p>
        </div>
      )}

      {/* Preferences */}
      <div>
        <h3 className="font-medium mb-2">Foster Preferences</h3>
        <div className="flex flex-wrap gap-2">
          {foster.pref_size.map((s) => (
            <Badge key={s} variant="outline" className="capitalize">{s}</Badge>
          ))}
          {foster.pref_age.map((a) => (
            <Badge key={a} variant="outline" className="capitalize">{a}</Badge>
          ))}
          {foster.pref_medical && (
            <Badge variant="outline" className="text-blue-700 border-blue-300">
              Open to medical needs
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Max distance: {foster.max_distance} miles
        </p>
      </div>

      {/* Rating History */}
      {ratings.length > 0 && (
        <div>
          <h3 className="font-medium mb-2">Rating History</h3>
          <div className="space-y-2">
            {ratings.slice(0, 3).map((rating) => (
              <div key={rating.id} className="text-sm border rounded-md p-3">
                <div className="flex items-center gap-2">
                  <StarRating value={rating.score} size="sm" />
                  <span className="font-medium">{rating.score}/5</span>
                </div>
                {rating.comment && (
                  <p className="text-muted-foreground mt-1">{rating.comment}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
