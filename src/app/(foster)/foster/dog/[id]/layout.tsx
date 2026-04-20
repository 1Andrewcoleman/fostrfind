import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'

interface DogLayoutProps {
  children: React.ReactNode
  params: { id: string }
}

/**
 * Server-side sibling layout that owns the tab title for the dog
 * detail page. The page itself is `'use client'` so it cannot export
 * metadata; we fetch the dog name here and fall back to a static
 * title if anything goes sideways (no Supabase in DEV_MODE, row not
 * found, network error — `generateMetadata` must never throw or the
 * whole route breaks).
 */
export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  if (DEV_MODE) return { title: 'Dog Profile' }
  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('dogs')
      .select('name')
      .eq('id', params.id)
      .maybeSingle()
    if (error || !data?.name) return { title: 'Dog Profile' }
    return { title: data.name }
  } catch {
    return { title: 'Dog Profile' }
  }
}

export default function DogLayout({ children }: DogLayoutProps) {
  return <>{children}</>
}
