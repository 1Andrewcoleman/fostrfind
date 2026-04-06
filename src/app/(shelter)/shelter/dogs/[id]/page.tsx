import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { notFound } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { DogForm } from '@/components/shelter/dog-form'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { createClient } from '@/lib/supabase/server'
import type { Dog } from '@/types/database'

const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')

interface EditDogPageProps {
  params: { id: string }
}

export default async function EditDogPage({ params }: EditDogPageProps) {
  let dog: Dog | null = null

  if (!DEV_MODE) {
    const supabase = await createClient()
    const { data } = await supabase.from('dogs').select('*').eq('id', params.id).single()
    dog = data as Dog | null
    if (!dog) notFound()
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

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm">Delete Dog</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {dogName}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently remove this dog listing and all associated applications.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive hover:bg-destructive/90">
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <DogForm mode="edit" dogId={params.id} initialData={dog ?? undefined} />
    </div>
  )
}
