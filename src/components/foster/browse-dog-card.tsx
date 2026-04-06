import Link from 'next/link'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
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
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative h-52 bg-muted">
        {dog.photos[0] ? (
          <Image
            src={dog.photos[0]}
            alt={dog.name}
            fill
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
            No photo
          </div>
        )}
      </div>
      <CardContent className="p-4 space-y-3">
        <div>
          <h3 className="font-bold text-lg">{dog.name}</h3>
          {dog.breed && (
            <p className="text-sm text-muted-foreground">{dog.breed}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1">
          {dog.age && <Badge variant="secondary">{DOG_AGE_LABELS[dog.age]}</Badge>}
          {dog.size && <Badge variant="secondary">{DOG_SIZE_LABELS[dog.size]}</Badge>}
          {dog.gender && (
            <Badge variant="secondary" className="capitalize">{dog.gender}</Badge>
          )}
        </div>

        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="h-3 w-3" />
          <span>{dog.shelter_name}</span>
          {dog.distance_miles !== undefined && (
            <span className="ml-auto">· {Math.round(dog.distance_miles)} mi away</span>
          )}
        </div>

        <Button asChild className="w-full">
          <Link href={`/foster/dog/${dog.id}`}>View Dog</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
