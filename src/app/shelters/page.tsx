import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, MapPin, PawPrint, Search } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/empty-state'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { PublicFooter } from '@/components/public-footer'
import { PLACEHOLDER_SHELTERS } from '@/lib/placeholder-shelters'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import { getInitials } from '@/lib/helpers'
import { isNextControlFlowError } from '@/lib/server-errors'
import type { Shelter } from '@/types/database'

// Row shape the index renders. We pull a narrow projection instead of
// `select('*')` so the bio truncation + payload stays small for the grid.
type ShelterIndexRow = Pick<
  Shelter,
  'id' | 'name' | 'slug' | 'location' | 'logo_url' | 'bio' | 'is_verified'
>

// Hard upper bound on rows fetched per request. No pagination in v1 —
// logged as a deferral; realistic shelter counts are well under this.
const MAX_ROWS = 200

interface PageProps {
  searchParams: { q?: string | string[] }
}

/**
 * Escape Postgres LIKE wildcard characters (`%`, `_`, `\`) so an input
 * like "50%" doesn't accidentally match everything. We escape with a
 * literal backslash and wrap the whole search value in `%...%` at the
 * call site for an "anywhere in the name" match.
 */
function escapeLikeWildcards(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`)
}

function normaliseQuery(raw: PageProps['searchParams']['q']): string {
  const first = Array.isArray(raw) ? raw[0] : raw
  return (first ?? '').trim().slice(0, 100)
}

async function loadShelters(q: string): Promise<ShelterIndexRow[]> {
  if (DEV_MODE) {
    const all = Object.values(PLACEHOLDER_SHELTERS)
    const filtered = q
      ? all.filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
      : all
    return filtered
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, MAX_ROWS)
      .map(({ id, name, slug, location, logo_url, bio, is_verified }) => ({
        id,
        name,
        slug,
        location,
        logo_url,
        bio,
        is_verified,
      }))
  }

  const supabase = await createClient()
  let query = supabase
    .from('shelters')
    .select('id, name, slug, location, logo_url, bio, is_verified')
    .order('name', { ascending: true })
    .limit(MAX_ROWS)

  if (q) {
    query = query.ilike('name', `%${escapeLikeWildcards(q)}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as ShelterIndexRow[]
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const q = normaliseQuery(searchParams.q)
  if (q) {
    return {
      title: `Shelters matching "${q}" — Fostr Find`,
      description: `Browse shelters on Fostr Find matching "${q}".`,
    }
  }
  return {
    title: 'Shelters — Fostr Find',
    description:
      'Browse animal shelters and rescues on Fostr Find. Every shelter here is partnered to place dogs in foster homes.',
  }
}

export default async function SheltersIndexPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const q = normaliseQuery(searchParams.q)

  let shelters: ShelterIndexRow[] = []
  let fetchError = false

  try {
    shelters = await loadShelters(q)
  } catch (e) {
    if (isNextControlFlowError(e)) throw e
    console.error('[shelters index] load failed:', e instanceof Error ? e.message : String(e))
    fetchError = true
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
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
        <div className="container mx-auto max-w-5xl px-4 py-10 md:py-14 space-y-8">
          <div className="space-y-3">
            <h1 className="font-display text-3xl md:text-4xl font-semibold tracking-tight">
              Shelters
            </h1>
            <p className="text-muted-foreground max-w-2xl">
              Every shelter listed here is partnered with Fostr Find to place dogs in foster
              homes. Visit a profile to see their story, or jump straight to the dogs they
              have available.
            </p>
          </div>

          {/*
           * Plain GET form so search works without JS. The `name="q"`
           * maps to the same searchParam we parse above.
           */}
          <form method="get" className="max-w-md">
            <label htmlFor="shelters-search" className="sr-only">
              Search shelters by name
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="shelters-search"
                type="search"
                name="q"
                defaultValue={q}
                placeholder="Search shelters by name..."
                className="pl-9"
                maxLength={100}
              />
            </div>
          </form>

          {fetchError ? (
            <ServerErrorPanel />
          ) : shelters.length === 0 ? (
            q ? (
              <EmptyState
                illustration="search"
                title={`No shelters match "${q}"`}
                description="Try a different name or browse all shelters."
                action={{ label: 'Clear search', href: '/shelters' }}
              />
            ) : (
              <EmptyState
                illustration="shelter"
                title="No shelters yet"
                description="Partner shelters will appear here as they join Fostr Find."
              />
            )
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {shelters.map((shelter) => (
                <ShelterCard key={shelter.id} shelter={shelter} />
              ))}
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}

function ShelterCard({ shelter }: { shelter: ShelterIndexRow }) {
  const bioPreview =
    shelter.bio && shelter.bio.trim().length > 0
      ? shelter.bio.length > 140
        ? `${shelter.bio.slice(0, 140).trimEnd()}…`
        : shelter.bio
      : null

  return (
    <Card className="flex flex-col overflow-hidden p-5 gap-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12 flex-shrink-0">
          {shelter.logo_url ? (
            <AvatarImage src={shelter.logo_url} alt={`${shelter.name} logo`} />
          ) : null}
          <AvatarFallback className="bg-peach/25 text-foreground font-display font-semibold">
            {getInitials(shelter.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="font-display font-semibold truncate">{shelter.name}</h2>
            {shelter.is_verified && (
              <Badge className="bg-warm/25 text-foreground hover:bg-warm/25 text-[11px] px-1.5 py-0 h-5">
                Verified
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{shelter.location}</span>
          </div>
        </div>
      </div>

      {bioPreview && (
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {bioPreview}
        </p>
      )}

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <Button asChild variant="outline" size="sm" className="w-full justify-between group">
          <Link href={`/shelters/${shelter.slug}`}>
            View profile
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
        <Button asChild size="sm" className="w-full justify-between group">
          <Link href={`/foster/browse?shelter=${shelter.slug}`}>
            See their dogs
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </Card>
  )
}
