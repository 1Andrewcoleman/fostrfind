import Link from 'next/link'
import Image from 'next/image'
import { MapPin, Calendar, Ruler, PawPrint, Heart, ArrowRight, Star } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { DogWithShelter } from '@/types/database'
import { DOG_AGE_LABELS, DOG_SIZE_LABELS } from '@/lib/constants'

interface BrowseDogCardProps {
  dog: DogWithShelter
}

export function BrowseDogCard({ dog }: BrowseDogCardProps) {
  return (
    <Card className="overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-200">
      <div className="relative aspect-[4/3] bg-muted">
        {dog.photos[0] ? (
          <Image
            src={dog.photos[0]}
            alt={dog.name}
            fill
            className="object-cover object-top"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-primary/15">
            <PawPrint className="h-12 w-12 text-foreground/40" />
          </div>
        )}
        {dog.special_needs && (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-medium text-rose-700">
            <Heart className="h-3 w-3" />
            Special needs
          </span>
        )}
      </div>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-display font-bold text-lg">{dog.name}</h3>
          {dog.breed && (
            <p className="text-sm text-muted-foreground">{dog.breed}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {dog.age && (
            <Badge variant="secondary" className="bg-amber-50 text-amber-800 hover:bg-amber-50 gap-1">
              <Calendar className="h-3 w-3" />
              {DOG_AGE_LABELS[dog.age]}
            </Badge>
          )}
          {dog.size && (
            <Badge variant="secondary" className="bg-teal-50 text-teal-800 hover:bg-teal-50 gap-1">
              <Ruler className="h-3 w-3" />
              {DOG_SIZE_LABELS[dog.size]}
            </Badge>
          )}
          {dog.gender && (
            <Badge
              variant="secondary"
              className={`capitalize gap-1 ${
                dog.gender === 'female'
                  ? 'bg-pink-50 text-pink-800 hover:bg-pink-50'
                  : 'bg-sky-50 text-sky-800 hover:bg-sky-50'
              }`}
            >
              {dog.gender}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          {dog.shelter_logo_url ? (
            <Avatar className="h-4 w-4">
              <AvatarImage src={dog.shelter_logo_url} alt="" />
              <AvatarFallback className="text-[8px]">
                {dog.shelter_name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          ) : (
            <MapPin className="h-3 w-3 shrink-0" />
          )}
          {dog.shelter_slug ? (
            <Link
              href={`/shelters/${dog.shelter_slug}`}
              className="truncate hover:text-primary hover:underline underline-offset-2"
            >
              {dog.shelter_name}
            </Link>
          ) : (
            <span className="truncate">{dog.shelter_name}</span>
          )}
          {dog.shelter_avg_rating !== undefined && dog.shelter_avg_rating !== null && (
            <span className="flex items-center gap-0.5 shrink-0">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              <span className="font-medium text-foreground">
                {dog.shelter_avg_rating.toFixed(1)}
              </span>
            </span>
          )}
          {dog.distance_miles !== undefined && (
            <span className="ml-auto shrink-0">· {Math.round(dog.distance_miles)} mi away</span>
          )}
        </div>

        <Button variant="outline" asChild className="w-full group">
          <Link href={`/foster/dog/${dog.id}`}>
            View Dog
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}
