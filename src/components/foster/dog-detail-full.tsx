'use client'

import { useState } from 'react'
import { ChevronLeft, MapPin, Star } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { DEV_MODE, DOG_AGE_LABELS, DOG_SIZE_LABELS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { sanitizeMultiline } from '@/lib/sanitize'

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
  /** The current foster's display name (for notification email payloads). */
  fosterName: string
  /** Row id in `foster_parents` for the current user. */
  fosterId: string
}

/**
 * Authenticated-foster dog detail view.
 *
 * Extracted from the original \`/foster/dog/[id]/page.tsx\` so the route
 * can live outside the \`(foster)\` route group — the route now branches
 * server-side between this "full" view and a public teaser. All
 * preloaded data is passed in as props, replacing the original page's
 * useEffect-based fetches; this also means the "already applied"
 * indicator is correct on first paint instead of flashing "Apply" and
 * then swapping.
 *
 * The apply handler is near-identical to the original: insert into
 * applications, fire-and-forget the shelter notification, flip local
 * state to "applied". No re-fetch of \`getUser()\` on apply — we already
 * have the foster id from the server render, and RLS enforces the
 * foster owning the row.
 */
export function DogDetailFull({
  dog,
  shelter,
  shelterRating,
  initialApplied,
  fosterName,
  fosterId,
}: DogDetailFullProps) {
  const [note, setNote] = useState('')
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(initialApplied)
  const [applyError, setApplyError] = useState<string | null>(null)

  async function handleApply() {
    setApplying(true)
    setApplyError(null)

    if (DEV_MODE) {
      setApplied(true)
      setApplying(false)
      return
    }

    const supabase = createClient()
    const cleanNote = note ? sanitizeMultiline(note) : ''
    const { data: inserted, error } = await supabase
      .from('applications')
      .insert({
        dog_id: dog.id,
        foster_id: fosterId,
        shelter_id: dog.shelter_id,
        status: 'submitted',
        note: cleanNote || null,
      })
      .select('id')
      .single()

    if (error || !inserted) {
      console.error('[foster/dog/apply] insert failed:', error?.message)
      setApplyError('Could not submit application. Please try again.')
      setApplying(false)
      return
    }

    // Fire-and-forget: notify the shelter that a new application landed.
    // Uses the client-side /api/notifications/send route because the
    // Resend SDK can't be imported into a 'use client' bundle. Silently
    // swallows failure — a slow mailer should never block the user's
    // "I applied!" confirmation.
    if (shelter.email) {
      void fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'application-submitted',
          to: shelter.email,
          data: {
            shelterName: shelter.name,
            dogName: dog.name,
            fosterName: fosterName || 'A foster parent',
            applicationUrl: `${window.location.origin}/shelter/applications/${inserted.id}`,
          },
        }),
      }).catch(() => {
        // Notification outage must not affect the apply UX.
      })
    }

    setApplied(true)
    setApplying(false)
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Link
        href="/foster/browse"
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Browse
      </Link>

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

        {applied ? (
          <Button disabled variant="outline">Application Sent &#10003;</Button>
        ) : (
          <Dialog>
            <DialogTrigger asChild>
              <Button size="lg">Apply to Foster</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Apply to foster {dog.name}</DialogTitle>
                <DialogDescription>
                  Add a personal note to introduce yourself to the shelter (optional).
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label>Your Note</Label>
                  <Textarea
                    placeholder="Tell the shelter why you'd be a great foster for this dog..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={4}
                  />
                </div>
                {applyError && (
                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                    {applyError}
                  </p>
                )}
                <Button onClick={handleApply} disabled={applying} className="w-full">
                  {applying ? 'Submitting...' : 'Submit Application'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
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
