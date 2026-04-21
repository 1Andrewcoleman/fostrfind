import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import { getAppUrl } from '@/lib/email'
import { DOG_AGE_LABELS, DOG_SIZE_LABELS } from '@/lib/constants'

interface DogLayoutProps {
  children: React.ReactNode
  params: { id: string }
}

// Teaser-safe fields. The full dog detail includes medical notes,
// temperament, and special-needs — none of which we expose in
// crawler-facing metadata.
type MetaFields = {
  name: string
  breed: string | null
  age: 'puppy' | 'young' | 'adult' | 'senior' | null
  size: 'small' | 'medium' | 'large' | 'xl' | null
  description: string | null
}

function buildDescription(fields: MetaFields): string {
  const attrs: string[] = []
  if (fields.age) attrs.push(DOG_AGE_LABELS[fields.age])
  if (fields.size) attrs.push(DOG_SIZE_LABELS[fields.size].toLowerCase())
  if (fields.breed) attrs.push(fields.breed)
  const attrLine = attrs.length > 0 ? `${attrs.join(' · ')}. ` : ''

  const blurb = fields.description?.trim() ?? ''
  const clamped = blurb.length > 200 ? `${blurb.slice(0, 200).trimEnd()}…` : blurb
  const suffix = 'Meet them on Fostr Fix.'

  const combined = `${attrLine}${clamped}`.trim()
  return combined.length > 0 ? `${combined} ${suffix}` : suffix
}

/**
 * Server-side sibling layout that owns the tab title and social card
 * metadata for the dog detail page. The page itself branches between
 * an authenticated foster's full view and a public teaser, but metadata
 * belongs here so it attaches regardless of which branch renders.
 *
 * Metadata is deliberately teaser-safe: we expose the dog's name,
 * public attributes (age, size, breed), and a clamped excerpt of the
 * public-facing description. We do NOT expose medical notes,
 * temperament, special-needs, or shelter contact info even though those
 * fields exist on the row — they aren't calibrated for a public
 * preview and crawlers should only see the teaser's surface area.
 *
 * \`og:image\` is intentionally omitted until dogs have a required photo
 * (logged as a Phase 6 follow-up in the roadmap).
 *
 * The function never throws: a DEV_MODE fallback, \`null\` row, or any
 * network failure falls back to a static title — Next treats an
 * exception in \`generateMetadata\` as a render failure for the whole
 * route.
 */
export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  if (DEV_MODE) {
    return {
      title: 'Dog Profile',
      description: 'Meet them on Fostr Fix.',
    }
  }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('dogs')
      .select('name, breed, age, size, description')
      .eq('id', params.id)
      .maybeSingle()
    if (error || !data?.name) return { title: 'Dog Profile' }

    const fields = data as MetaFields
    const title = fields.name
    const description = buildDescription(fields)
    const url = `${getAppUrl()}/foster/dog/${params.id}`

    return {
      title,
      description,
      alternates: { canonical: url },
      openGraph: {
        type: 'article',
        url,
        title: `${title} — Fostr Fix`,
        description,
        siteName: 'Fostr Fix',
      },
      twitter: {
        card: 'summary',
        title: `${title} — Fostr Fix`,
        description,
      },
    }
  } catch {
    return { title: 'Dog Profile' }
  }
}

export default function DogLayout({ children }: DogLayoutProps) {
  return <>{children}</>
}
