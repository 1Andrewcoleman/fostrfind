'use client'

import { useState } from 'react'
import { ChevronLeft, MapPin, Star } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { DOG_AGE_LABELS, DOG_SIZE_LABELS } from '@/lib/constants'
import { ShareButton } from '@/components/foster/share-button'
import { SaveDogButton } from '@/components/foster/save-dog-button'
import { ApplicationFormDialog } from '@/components/foster/application-form-dialog'

// Slim projection of `Dog` — we only need the fields this view renders.
// Keeping a local shape (rather than pulling the full DB type) means the
// server page can massage the payload before handing it down without
// type-friction from optional DB columns.
export interface DogDetailDog {
  id: string
  shelter_id: string
  name: string
  breed: string | null
  age: 'puppy' | 'young' | 'adult' | 'senior' | null
  size: 'small' | 'medium' | 'large' | 'xl' | null
  gender: 'male' | 'female' | null
  temperament: string | null
  medical_status: string | null
  special_needs: string | null
  description: string | null
  photos: string[]
}

export interface DogDetailShelter {
  id: string
  name: string
  location: string
  email: string | null
  slug: string | null
}

export interface DogDetailShelterRating {
  avg: number
  count: number
}

interface DogDetailFullProps {
  dog: DogDetailDog
  shelter: DogDetailShelter
  shelterRating: DogDetailShelterRating | null
  /** True when the current foster already has an application on this dog. */
  initialApplied: boolean
  /** Phase 6.5 — true when the current foster has hearted this dog. */
  initialSaved: boolean
  /** Canonical absolute URL for this dog, built server-side. Fed into
   * the Share button so native share sheets + the clipboard fallback
   * both produce a link anyone (logged in or not) can open. */
  canonicalUrl: string
}

/**
 * Authenticated-foster dog detail view.
 *
 * Extracted from the original `/foster/dog/[id]/page.tsx` so the route
 * can live outside the `(foster)` route group — the route now branches
 * server-side between this "full" view and a public teaser. All
 * preloaded data is passed in as props, replacing the original page's
 * useEffect-based fetches; this also means the "already applied"
 * indicator is correct on first paint instead of flashing "Apply" and
 * then swapping.
 *
 * Phase 7 Step 46: the apply UX is now a structured form rendered by
 * `ApplicationFormDialog`, which posts to `/api/applications`. The
 * server route owns auth, validation, dog/shelter integrity, and
 * (Step 48) notification firing — this component just owns the
 * "applied / not applied" visual state and cleans up after the dialog.
 */
export function DogDetailFull({
  dog,
  shelter,
  shelterRating,
  initialApplied,
  initialSaved,
  canonicalUrl,
}: DogDetailFullProps) {
  const [applied, setApplied] = useState(initialApplied)

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link
          href="/foster/browse"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Browse
        </Link>
        <div className="flex items-center gap-2">
          <SaveDogButton
            dogId={dog.id}
            dogName={dog.name}
            initialSaved={initialSaved}
          />
          <ShareButton
            url={canonicalUrl}
            title={dog.name}
            text={`Meet ${dog.name} on Fostr Find${dog.breed ? ` — ${dog.breed}` : ''}`}
          />
        </div>
      </div>

      {/* Photo carousel placeholder */}
      <div className="h-72 bg-muted rounded-xl flex items-center justify-center text-muted-foreground">
        No photos yet
        {/* TODO: replace with image carousel once photos are uploaded */}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">{dog.name}</h1>
          {dog.breed && <p className="text-muted-foreground">{dog.breed}</p>}
        </div>

        <ApplicationFormDialog
          dogId={dog.id}
          dogName={dog.name}
          shelterId={dog.shelter_id}
          shelterName={shelter.name}
          alreadyApplied={applied}
          onAppliedSuccess={() => setApplied(true)}
        />
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-2">
        {dog.age && <Badge variant="secondary">{DOG_AGE_LABELS[dog.age]}</Badge>}
        {dog.size && <Badge variant="secondary">{DOG_SIZE_LABELS[dog.size]}</Badge>}
        {dog.gender && <Badge variant="secondary" className="capitalize">{dog.gender}</Badge>}
      </div>

      {/* Description */}
      {dog.description && (
        <div>
          <h2 className="font-semibold mb-2">About {dog.name}</h2>
          <p className="text-sm leading-relaxed">{dog.description}</p>
        </div>
      )}

      {/* Temperament */}
      {dog.temperament && (
        <div>
          <h2 className="font-semibold mb-2">Temperament</h2>
          <p className="text-sm text-muted-foreground">{dog.temperament}</p>
        </div>
      )}

      {/* Medical */}
      {dog.medical_status && (
        <div>
          <h2 className="font-semibold mb-2">Medical Status</h2>
          <p className="text-sm text-muted-foreground">{dog.medical_status}</p>
        </div>
      )}

      {/* Special needs */}
      {dog.special_needs && (
        <div className="rounded-lg bg-peach/25 border border-peach/40 p-4">
          <h2 className="font-semibold mb-1 text-foreground">Special Needs</h2>
          <p className="text-sm text-foreground/80">{dog.special_needs}</p>
        </div>
      )}

      {/* Shelter info */}
      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-2">About the Shelter</h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {shelter.slug ? (
            <Link
              href={`/shelters/${shelter.slug}`}
              className="font-medium hover:text-primary hover:underline underline-offset-2"
            >
              {shelter.name}
            </Link>
          ) : (
            <p className="font-medium">{shelter.name}</p>
          )}
          {shelterRating && (
            <span className="flex items-center gap-1 text-sm">
              <Star className="h-3.5 w-3.5 fill-peach text-peach" />
              <span className="font-medium">{shelterRating.avg.toFixed(1)}</span>
              <span className="text-muted-foreground">
                ({shelterRating.count} {shelterRating.count === 1 ? 'review' : 'reviews'})
              </span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
          <MapPin className="h-3 w-3" />
          <span>{shelter.location}</span>
        </div>
      </div>
    </div>
  )
}
