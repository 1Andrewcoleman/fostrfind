import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MapPin, Globe, Phone, Mail, BadgeCheck, AtSign, ArrowLeft, Star } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BrowseDogCard } from '@/components/foster/browse-dog-card'
import { EmptyState } from '@/components/empty-state'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import { calculateAverageRating, getInitials } from '@/lib/helpers'
import { isNextControlFlowError } from '@/lib/server-errors'
import type { Dog, DogWithShelter, Shelter } from '@/types/database'

interface PageProps {
  params: { slug: string }
}

// DEV_MODE placeholder so the route is browsable without a live Supabase.
// Mirrors the two shelter slugs seeded in the browse page's PLACEHOLDER_DOGS.
// Exported so the `/shelters` index can reuse the same fixtures in DEV_MODE
// without duplicating the data or drifting when we tweak it.
export const PLACEHOLDER_SHELTERS: Record<string, Shelter> = {
  'happy-paws-rescue': {
    id: 's1',
    created_at: new Date().toISOString(),
    user_id: 'dev-shelter-1',
    name: 'Happy Paws Rescue',
    slug: 'happy-paws-rescue',
    email: 'hello@happypaws.example',
    phone: '(555) 123-4567',
    location: 'Austin, TX',
    latitude: null,
    longitude: null,
    logo_url: null,
    ein: null,
    bio: 'Happy Paws is a volunteer-run rescue that pairs dogs with loving foster families while we find their forever homes.',
    website: 'https://happypaws.example',
    instagram: 'happypawsrescue',
    is_verified: true,
  },
  'austin-animal-rescue': {
    id: 's2',
    created_at: new Date().toISOString(),
    user_id: 'dev-shelter-2',
    name: 'Austin Animal Rescue',
    slug: 'austin-animal-rescue',
    email: 'team@austinrescue.example',
    phone: null,
    location: 'Austin, TX',
    latitude: null,
    longitude: null,
    logo_url: null,
    ein: null,
    bio: 'Serving central Texas since 2014.',
    website: null,
    instagram: null,
    is_verified: false,
  },
}

interface ShelterPayload {
  shelter: Shelter
  dogs: DogWithShelter[]
  avgRating: number | null
  ratingCount: number
}

async function loadShelterBySlug(slug: string): Promise<ShelterPayload | null> {
  if (DEV_MODE) {
    const shelter = PLACEHOLDER_SHELTERS[slug]
    if (!shelter) return null
    return { shelter, dogs: [], avgRating: null, ratingCount: 0 }
  }

  const supabase = await createClient()
  const { data: shelter, error: shelterError } = await supabase
    .from('shelters')
    .select('*')
    .eq('slug', slug)
    .maybeSingle()

  if (shelterError) throw shelterError
  if (!shelter) return null

  const [dogsRes, ratingsRes] = await Promise.all([
    supabase
      .from('dogs')
      .select('*')
      .eq('shelter_id', shelter.id)
      .eq('status', 'available')
      .order('created_at', { ascending: false }),
    supabase
      .from('shelter_ratings')
      .select('score')
      .eq('shelter_id', shelter.id),
  ])

  if (dogsRes.error) throw dogsRes.error
  if (ratingsRes.error) throw ratingsRes.error

  const dogs: DogWithShelter[] = ((dogsRes.data ?? []) as Dog[]).map((dog) => ({
    ...dog,
    shelter_name: shelter.name,
    shelter_logo_url: shelter.logo_url,
    shelter_slug: shelter.slug,
  }))

  const scores = (ratingsRes.data ?? []).map((r) => ({ score: r.score as number }))
  const avgRating = scores.length > 0 ? calculateAverageRating(scores) : null
  const ratingCount = scores.length

  return { shelter, dogs, avgRating, ratingCount }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  try {
    const payload = await loadShelterBySlug(params.slug)
    if (!payload) {
      return { title: 'Shelter not found | Fostr Fix' }
    }
    const { shelter } = payload
    const description = shelter.bio
      ? shelter.bio.slice(0, 155)
      : `${shelter.name} is a partner shelter on Fostr Fix.`
    return {
      title: `${shelter.name} | Fostr Fix`,
      description,
    }
  } catch (e) {
    if (isNextControlFlowError(e)) throw e
    console.error('[shelters/:slug metadata] load failed:', e instanceof Error ? e.message : String(e))
    return { title: 'Fostr Fix' }
  }
}

function normalizeInstagramHandle(raw: string): string {
  return raw.replace(/^@/, '').trim()
}

function normalizeWebsiteUrl(raw: string): string {
  if (/^https?:\/\//i.test(raw)) return raw
  return `https://${raw}`
}

export default async function ShelterProfilePage({ params }: PageProps): Promise<React.JSX.Element> {
  let payload: ShelterPayload | null = null
  let fetchError = false

  try {
    payload = await loadShelterBySlug(params.slug)
    if (!payload) notFound()
  } catch (e) {
    if (isNextControlFlowError(e)) throw e
    console.error('[shelters/:slug] load failed:', e instanceof Error ? e.message : String(e))
    fetchError = true
  }

  if (fetchError || !payload) {
    return (
      <div className="min-h-screen bg-muted/30">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12 space-y-8">
          <div>
            <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1">
              <Link href="/foster/browse">
                <ArrowLeft className="h-4 w-4" />
                Back to browse
              </Link>
            </Button>
          </div>
          <ServerErrorPanel />
        </div>
      </div>
    )
  }

  const { shelter, dogs, avgRating, ratingCount } = payload

  const instagramHandle = shelter.instagram ? normalizeInstagramHandle(shelter.instagram) : null

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="mx-auto w-full max-w-5xl px-4 py-8 md:py-12 space-y-8">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1">
            <Link href="/foster/browse">
              <ArrowLeft className="h-4 w-4" />
              Back to browse
            </Link>
          </Button>
        </div>

        <Card className="overflow-hidden">
          <div className="h-24 bg-peach/30" />
          <div className="p-6 md:p-8 -mt-12 md:-mt-16 space-y-6">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <Avatar className="h-24 w-24 md:h-28 md:w-28 ring-4 ring-background shadow-sm">
                {shelter.logo_url ? (
                  <AvatarImage src={shelter.logo_url} alt={`${shelter.name} logo`} />
                ) : null}
                <AvatarFallback className="text-2xl bg-peach/25 text-foreground font-display font-semibold">
                  {getInitials(shelter.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-2xl md:text-3xl font-bold">
                    {shelter.name}
                  </h1>
                  {shelter.is_verified && (
                    <Badge className="gap-1 bg-warm/25 text-foreground hover:bg-warm/25">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Verified
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {shelter.location}
                  </span>
                  {avgRating !== null && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-peach text-peach" />
                      <span className="font-medium text-foreground">{avgRating.toFixed(1)}</span>
                      <span>
                        ({ratingCount} {ratingCount === 1 ? 'review' : 'reviews'})
                      </span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {shelter.bio && (
              <p className="text-sm md:text-base leading-relaxed text-muted-foreground max-w-2xl">
                {shelter.bio}
              </p>
            )}

            <div className="flex flex-wrap gap-3 pt-2">
              {shelter.website && (
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <a
                    href={normalizeWebsiteUrl(shelter.website)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Globe className="h-4 w-4" />
                    Website
                  </a>
                </Button>
              )}
              {instagramHandle && (
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <a
                    href={`https://instagram.com/${instagramHandle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <AtSign className="h-4 w-4" />
                    {instagramHandle}
                  </a>
                </Button>
              )}
              {shelter.email && (
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <a href={`mailto:${shelter.email}`}>
                    <Mail className="h-4 w-4" />
                    Email
                  </a>
                </Button>
              )}
              {shelter.phone && (
                <Button asChild variant="outline" size="sm" className="gap-2">
                  <a href={`tel:${shelter.phone}`}>
                    <Phone className="h-4 w-4" />
                    {shelter.phone}
                  </a>
                </Button>
              )}
            </div>
          </div>
        </Card>

        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl md:text-2xl font-bold">
              Available dogs
            </h2>
            <span className="text-sm text-muted-foreground">
              {dogs.length} {dogs.length === 1 ? 'dog' : 'dogs'}
            </span>
          </div>

          {dogs.length === 0 ? (
            <EmptyState
              illustration="dog"
              title="No dogs currently listed"
              description={`${shelter.name} doesn't have any dogs available for fostering right now. Check back soon.`}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {dogs.map((dog) => (
                <BrowseDogCard key={dog.id} dog={dog} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
