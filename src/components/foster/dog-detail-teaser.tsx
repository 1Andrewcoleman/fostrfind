import Link from 'next/link'
import { ArrowRight, MapPin, PawPrint } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { PublicFooter } from '@/components/public-footer'
import { ForceLightTheme } from '@/components/force-light-theme'
import { ShareButton } from '@/components/foster/share-button'
import { DOG_AGE_LABELS, DOG_SIZE_LABELS } from '@/lib/constants'

type DogStatus = 'available' | 'pending' | 'placed' | 'adopted'

interface DogDetailTeaserProps {
  dog: {
    id: string
    name: string
    breed: string | null
    age: 'puppy' | 'young' | 'adult' | 'senior' | null
    size: 'small' | 'medium' | 'large' | 'xl' | null
    gender: 'male' | 'female' | null
    description: string | null
    status: DogStatus
  }
  shelter: {
    name: string
    location: string
    slug: string | null
  }
  canonicalUrl: string
}

/**
 * Status-specific copy for the public teaser CTA. Each variant tells
 * the visitor exactly what state the dog is in and the most useful next
 * action — applying only makes sense when `status === 'available'`.
 */
const STATUS_COPY: Record<DogStatus, { headline: (name: string) => string; body: string; cta: 'apply' | 'browse' }> = {
  available: {
    headline: (name) => `Want to foster ${name}?`,
    body: 'Create a free foster account to apply, message the shelter, and see every dog available near you.',
    cta: 'apply',
  },
  pending: {
    headline: (name) => `${name} has a pending foster`,
    body: "This pup is currently being matched. Browse other dogs nearby — your next foster is waiting.",
    cta: 'browse',
  },
  placed: {
    headline: (name) => `${name} is in foster care`,
    body: "This dog is settled with a foster family for now. Plenty of others still need a home — take a look.",
    cta: 'browse',
  },
  adopted: {
    headline: (name) => `${name} found a forever home`,
    body: "Wonderful news! This dog has been adopted. Browse other dogs that still need fostering.",
    cta: 'browse',
  },
}

/**
 * Public teaser view for \`/foster/dog/[id]\`.
 *
 * Rendered to anonymous visitors and to logged-in users without a
 * foster profile (shelter staff, mid-onboarding users) on the same
 * canonical URL as the authenticated foster's full detail view. The
 * URL is unchanged so a shared link does not add a \`?mode=public\`
 * fork and the OG card / tweet embed / inbound referrer works the
 * same either way.
 *
 * Deliberately omitted versus the full view:
 *
 *   - Apply dialog / "Apply to Foster" button.
 *   - Medical status, temperament, and special-needs blocks — those
 *     are foster-facing signals, not marketing copy.
 *   - "Already applied" indicator.
 *   - Foster portal chrome (sidebar, mobile nav, DEV_MODE banner).
 *
 * Deliberately included:
 *
 *   - A clamped public-safe excerpt of the description.
 *   - Age, size, gender badges (they're already exposed on the public
 *     browse listing via the shelter profile).
 *   - Share button so a visitor can forward the link.
 *   - Primary CTA to sign up, secondary to sign in.
 *   - Link through to the shelter's public profile.
 *   - \`ForceLightTheme\` sibling to strip any lingering \`dark\` class a
 *     visitor might have inherited from a prior portal tab.
 */
export function DogDetailTeaser({ dog, shelter, canonicalUrl }: DogDetailTeaserProps) {
  const blurb = dog.description?.trim() ?? ''
  const clamped = blurb.length > 280 ? `${blurb.slice(0, 280).trimEnd()}…` : blurb

  const copy = STATUS_COPY[dog.status]
  const signUpHref = `/signup?next=${encodeURIComponent(`/foster/dog/${dog.id}`)}`
  const signInHref = `/login?next=${encodeURIComponent(`/foster/dog/${dog.id}`)}`

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <ForceLightTheme />

      <header className="border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <PawPrint className="h-6 w-6" />
            Fostr Find
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Home
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-10 md:py-14 space-y-8">
          <Card className="overflow-hidden">
            <div className="h-56 md:h-72 bg-muted flex items-center justify-center text-muted-foreground">
              <PawPrint className="h-14 w-14 opacity-40" />
              <span className="sr-only">No photo available</span>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
                    {dog.name}
                  </h1>
                  {dog.breed && (
                    <p className="text-muted-foreground mt-1">{dog.breed}</p>
                  )}
                </div>
                <ShareButton
                  url={canonicalUrl}
                  title={dog.name}
                  text={`Meet ${dog.name} on Fostr Find${dog.breed ? ` — ${dog.breed}` : ''}`}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {dog.age && <Badge variant="secondary">{DOG_AGE_LABELS[dog.age]}</Badge>}
                {dog.size && <Badge variant="secondary">{DOG_SIZE_LABELS[dog.size]}</Badge>}
                {dog.gender && (
                  <Badge variant="secondary" className="capitalize">
                    {dog.gender}
                  </Badge>
                )}
                {dog.status !== 'available' && (
                  <Badge variant="outline" className="capitalize">
                    {dog.status}
                  </Badge>
                )}
              </div>

              {clamped && (
                <p className="text-sm leading-relaxed text-foreground/80">{clamped}</p>
              )}

              <div className="rounded-lg border p-4 bg-muted/30">
                <h2 className="font-semibold mb-1">About the shelter</h2>
                <div className="flex items-center gap-2 mt-1">
                  {shelter.slug ? (
                    <Link
                      href={`/shelters/${shelter.slug}`}
                      className="font-medium hover:text-primary hover:underline underline-offset-2"
                    >
                      {shelter.name}
                    </Link>
                  ) : (
                    <span className="font-medium">{shelter.name}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                  <MapPin className="h-3 w-3" />
                  {shelter.location}
                </div>
              </div>
            </div>
          </Card>

          <div className="rounded-xl border bg-background p-5 md:p-6 space-y-3 text-center">
            <h2 className="font-display text-lg md:text-xl font-semibold">
              {copy.headline(dog.name)}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">{copy.body}</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-1">
              {copy.cta === 'apply' ? (
                <>
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href={signUpHref}>
                      Sign up to apply
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                    <Link href={signInHref}>Sign in</Link>
                  </Button>
                </>
              ) : (
                <>
                  <Button asChild size="lg" className="w-full sm:w-auto">
                    <Link href="/signup">
                      Sign up to browse
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                    <Link href={signInHref}>Sign in</Link>
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
