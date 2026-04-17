import Link from 'next/link'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/empty-state'
import { DogCard } from '@/components/shelter/dog-card'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import type { Dog } from '@/types/database'

export default async function ShelterDogsPage() {
  let dogs: Dog[] = []

  if (!DEV_MODE) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      const { data: shelterRow } = await supabase
        .from('shelters')
        .select('id')
        .eq('user_id', user.id)
        .single()

      if (shelterRow) {
        const { data } = await supabase
          .from('dogs')
          .select('*')
          .eq('shelter_id', shelterRow.id)
          .order('created_at', { ascending: false })
        dogs = (data ?? []) as Dog[]
      }
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your Dogs</h1>
        <Button asChild>
          <Link href="/shelter/dogs/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Dog
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="available">Available</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="placed">Placed</TabsTrigger>
        </TabsList>
      </Tabs>

      {dogs.length === 0 ? (
        <EmptyState
          title="No dogs found"
          description="Add your first dog listing to start receiving foster applications."
          action={{ label: 'Add Dog', href: '/shelter/dogs/new' }}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {dogs.map((dog) => (
            <DogCard key={dog.id} dog={dog} />
          ))}
        </div>
      )}
    </div>
  )
}
