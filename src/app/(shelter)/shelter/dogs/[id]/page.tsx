import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { notFound } from 'next/navigation'

/**
 * Dynamic tab title — "Edit <Dog Name>" — to help shelter staff keep
 * multiple open edit tabs straight. Must never throw; falls back to
 * a generic title on any error path or in DEV_MODE.
 */
export async function generateMetadata({
  params,
}: {
  params: { id: string }
}): Promise<Metadata> {
  if (DEV_MODE) return { title: 'Edit Dog' }
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('dogs')
      .select('name')
      .eq('id', params.id)
      .maybeSingle()
    return { title: data?.name ? `Edit ${data.name}` : 'Edit Dog' }
  } catch {
    return { title: 'Edit Dog' }
  }
}
import { Card, CardContent } from '@/components/ui/card'
import { ServerErrorPanel } from '@/components/server-error-panel'
import { DogForm } from '@/components/shelter/dog-form'
import { DogDeleteButton } from '@/components/shelter/dog-delete-button'
import { DogRelistButton } from '@/components/shelter/dog-relist-button'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import { isNextControlFlowError } from '@/lib/server-errors'
import type { Dog } from '@/types/database'

interface EditDogPageProps {
  params: { id: string }
}

export default async function EditDogPage({ params }: EditDogPageProps) {
  let dog: Dog | null = null
  let fetchError = false

  if (!DEV_MODE) {
    try {
      const supabase = await createClient()
      const { data, error } = await supabase.from('dogs').select('*').eq('id', params.id).single()
      if (error) throw error
      dog = data as Dog | null
      if (!dog) notFound()
    } catch (e) {
      if (isNextControlFlowError(e)) throw e
      console.error('[shelter/dogs/:id] load failed:', e instanceof Error ? e.message : String(e))
      fetchError = true
    }
  }

  if (fetchError) {
    return (
      <div className="max-w-2xl space-y-6">
        <nav className="flex items-center gap-1 text-sm text-muted-foreground">
          <Link href="/shelter/dogs" className="hover:text-foreground">Dogs</Link>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground">Edit</span>
        </nav>
        <ServerErrorPanel />
      </div>
    )
  }

  const dogName = dog?.name ?? 'Dog'

  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/shelter/dogs" className="hover:text-foreground">Dogs</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">Edit {dogName}</span>
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Edit {dogName}</h1>
        {dog && <DogDeleteButton dogId={dog.id} dogName={dogName} />}
      </div>

      {dog?.status === 'pending' && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-start justify-between gap-4 py-4">
            <div>
              <p className="font-medium">This dog is currently pending placement</p>
              <p className="text-sm text-muted-foreground">
                If the placement fell through, you can re-list this dog. The accepted
                application will be declined automatically.
              </p>
            </div>
            <DogRelistButton dogId={dog.id} dogName={dogName} />
          </CardContent>
        </Card>
      )}

      <DogForm mode="edit" dogId={params.id} initialData={dog ?? undefined} />
    </div>
  )
}
