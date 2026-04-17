'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RotateCcw } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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

interface DogRelistButtonProps {
  dogId: string
  dogName: string
}

export function DogRelistButton({ dogId, dogName }: DogRelistButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleRelist(): Promise<void> {
    setLoading(true)

    try {
      const res = await fetch(`/api/dogs/${dogId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'available' }),
      })

      const body = await res.json()

      if (!res.ok) {
        toast.error(body.error ?? 'Failed to re-list dog.')
        return
      }

      toast.success(`${dogName} is available again`)
      router.refresh()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          {loading ? 'Re-listing…' : 'Re-list as Available'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Re-list {dogName} as available?</AlertDialogTitle>
          <AlertDialogDescription>
            This marks <strong>{dogName}</strong> available again and declines the
            accepted application that was holding this placement. Use this if the
            placement fell through.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleRelist}>Confirm Re-list</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
