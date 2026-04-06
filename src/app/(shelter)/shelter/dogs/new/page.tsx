import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { DogForm } from '@/components/shelter/dog-form'

export default function NewDogPage() {
  return (
    <div className="max-w-2xl space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/shelter/dogs" className="hover:text-foreground">Dogs</Link>
        <ChevronRight className="h-4 w-4" />
        <span className="text-foreground">New Dog</span>
      </nav>

      <h1 className="text-2xl font-bold">Add New Dog</h1>

      <DogForm mode="create" />
    </div>
  )
}
