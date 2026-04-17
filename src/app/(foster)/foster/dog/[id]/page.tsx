'use client'

import { useState, useEffect } from 'react'
import { ChevronLeft, MapPin } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
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
import { EmptyState } from '@/components/empty-state'
import { createClient } from '@/lib/supabase/client'

interface DogDetailPageProps {
  params: { id: string }
}

const PLACEHOLDER_DOG = {
  id: '0', created_at: '', updated_at: '', shelter_id: 's1', status: 'available' as const,
  name: 'Buddy', breed: 'Labrador Mix', age: 'adult' as const, size: 'large' as const,
  gender: 'male' as const, temperament: 'Friendly, playful, great with kids.',
  medical_status: 'Vaccinated, neutered, heartworm negative.',
  special_needs: null as string | null,
  description: 'Buddy is a 3-year-old lab mix who loves fetch and long walks. He does well with other dogs but prefers to be the only dog at meal times.',
  photos: [] as string[],
}

const PLACEHOLDER_SHELTER = { name: 'Happy Paws Rescue', location: 'Austin, TX' }

export default function FosterDogDetailPage({ params }: DogDetailPageProps) {
  const [note, setNote] = useState('')
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [checkingApplied, setCheckingApplied] = useState(!DEV_MODE)
  const [applyError, setApplyError] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [dog, setDog] = useState(DEV_MODE ? PLACEHOLDER_DOG : null)
  const [shelter, setShelter] = useState(DEV_MODE ? PLACEHOLDER_SHELTER : null)

  useEffect(() => {
    if (DEV_MODE) return
    async function load() {
      const supabase = createClient()

      const { data } = await supabase
        .from('dogs')
        .select('*, shelter:shelters(name, location)')
        .eq('id', params.id)
        .maybeSingle()

      if (!data) {
        setNotFound(true)
        setCheckingApplied(false)
        return
      }

      const shelterData = data.shelter as { name: string; location: string } | null
      setDog(data as typeof PLACEHOLDER_DOG)
      setShelter(shelterData ?? PLACEHOLDER_SHELTER)

      // Check whether the current foster has already applied to this dog
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: fosterRow } = await supabase
          .from('foster_parents')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()

        if (fosterRow) {
          const { data: existingApp } = await supabase
            .from('applications')
            .select('id')
            .eq('dog_id', params.id)
            .eq('foster_id', fosterRow.id)
            .limit(1)
            .maybeSingle()

          if (existingApp) {
            setApplied(true)
          }
        }
      }

      setCheckingApplied(false)
    }
    load()
  }, [params.id])

  async function handleApply() {
    setApplying(true)
    setApplyError(null)

    if (DEV_MODE) {
      setApplied(true)
      setApplying(false)
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setApplyError('You must be logged in.'); setApplying(false); return }

    const { data: fosterRow } = await supabase
      .from('foster_parents')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!fosterRow) { setApplyError('Complete your foster profile first.'); setApplying(false); return }

    const { error } = await supabase.from('applications').insert({
      dog_id: params.id,
      foster_id: fosterRow.id,
      shelter_id: dog!.shelter_id,
      status: 'submitted',
      note: note || null,
    })

    if (error) {
      setApplyError(error.message)
      setApplying(false)
      return
    }

    setApplied(true)
    setApplying(false)
  }

  if (notFound) {
    return (
      <EmptyState
        title="Dog not found"
        description="This dog may have been removed or the link is invalid."
        action={{ label: 'Browse Dogs', href: '/foster/browse' }}
      />
    )
  }

  if (!dog || !shelter) {
    return (
      <div className="max-w-2xl space-y-6">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-72 w-full rounded-xl" />
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-10 w-36 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <div className="rounded-lg border p-4 space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    )
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
        ) : checkingApplied ? (
          <Button disabled variant="outline" size="lg">Loading&hellip;</Button>
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
                  <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{applyError}</p>
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
        <div className="rounded-lg bg-yellow-50 border border-yellow-200 p-4">
          <h2 className="font-semibold mb-1 text-yellow-900">Special Needs</h2>
          <p className="text-sm text-yellow-800">{dog.special_needs}</p>
        </div>
      )}

      {/* Shelter info */}
      <div className="rounded-lg border p-4">
        <h2 className="font-semibold mb-2">About the Shelter</h2>
        <p className="font-medium">{shelter.name}</p>
        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
          <MapPin className="h-3 w-3" />
          <span>{shelter.location}</span>
        </div>
      </div>
    </div>
  )
}
