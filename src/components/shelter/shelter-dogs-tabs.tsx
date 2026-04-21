'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/empty-state'
import { StaggerItem } from '@/components/ui/stagger-item'
import { DogCard } from '@/components/shelter/dog-card'
import type { Dog } from '@/types/database'

export interface PlacedDogEntry {
  dog: Dog
  fosterName: string
}

interface ShelterDogsTabsProps {
  activeDogs: Dog[]
  placedDogs: PlacedDogEntry[]
}

export function ShelterDogsTabs({ activeDogs, placedDogs }: ShelterDogsTabsProps) {
  return (
    <Tabs defaultValue="active" className="space-y-6">
      <TabsList>
        <TabsTrigger value="active">Active ({activeDogs.length})</TabsTrigger>
        <TabsTrigger value="placed">Placed ({placedDogs.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="active" className="mt-0">
        {activeDogs.length === 0 ? (
          <EmptyState
            illustration="dog"
            title="No active dogs"
            description="Add your first dog listing to start receiving foster applications."
            action={{ label: 'Add Dog', href: '/shelter/dogs/new' }}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeDogs.map((dog, i) => (
              <StaggerItem key={dog.id} index={i}>
                <DogCard dog={dog} />
              </StaggerItem>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="placed" className="mt-0">
        {placedDogs.length === 0 ? (
          <EmptyState
            illustration="history"
            title="No placed dogs yet"
            description="Dogs you've placed with a foster will appear here once the placement is complete."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {placedDogs.map(({ dog, fosterName }, i) => (
              <StaggerItem key={dog.id} index={i}>
                <DogCard dog={dog} fosteredBy={fosterName} />
              </StaggerItem>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
