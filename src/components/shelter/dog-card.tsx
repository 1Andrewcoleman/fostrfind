import Link from 'next/link'
import Image from 'next/image'
import { FileText } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/status-badge'
import type { Dog } from '@/types/database'

interface DogCardProps {
  dog: Dog
  applicationCount?: number
}

export function DogCard({ dog, applicationCount = 0 }: DogCardProps) {
  return (
    <Link href={`/shelter/dogs/${dog.id}`}>
      <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
        <div className="relative h-48 bg-muted">
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
          <div className="absolute top-2 right-2">
            <StatusBadge status={dog.status} />
          </div>
        </div>
        <CardContent className="p-4">
          <h3 className="font-semibold text-lg">{dog.name}</h3>
          <p className="text-sm text-muted-foreground">
            {[dog.breed, dog.age, dog.size].filter(Boolean).join(' · ')}
          </p>
          <div className="mt-3 flex items-center gap-1 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>{applicationCount} application{applicationCount !== 1 ? 's' : ''}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
