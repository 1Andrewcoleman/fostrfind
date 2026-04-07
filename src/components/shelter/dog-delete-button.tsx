'use client'

/**
 * DogDeleteButton — destructive action with a confirmation dialog.
 *
 * Calls DELETE /api/dogs/[id] and navigates to /shelter/dogs on success.
 * Surfaces 409 conflicts (active applications) as a descriptive toast instead
 * of a generic error so the shelter understands what to do first.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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

interface DogDeleteButtonProps {
  dogId: string
  dogName: string
}

export function DogDeleteButton({ dogId, dogName }: DogDeleteButtonProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  async function handleDelete(): Promise<void> {
    setIsDeleting(true)

    // Track whether navigation was triggered so we can skip the state update
    // on the about-to-be-unmounted component in the finally block.
    let navigating = false

    try {
      const res = await fetch(`/api/dogs/${dogId}`, { method: 'DELETE' })
      const body = await res.json()

      if (!res.ok) {
        toast.error(body.error ?? 'Failed to delete dog.')
        return
      }

      toast.success(`${dogName} has been removed.`)
      navigating = true
      router.push('/shelter/dogs')
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      // Calling setState on an unmounted component is a no-op in React 18,
      // but skipping it is cleaner and avoids potential future warnings.
      if (!navigating) {
        setIsDeleting(false)
      }
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive" size="sm" disabled={isDeleting}>
          {isDeleting ? 'Deleting…' : 'Delete Dog'}
        </Button>
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {dogName}?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove this dog listing and all associated data. Dogs with
            active applications must have those applications declined or completed first.
            <br />
            <br />
            <strong>This action cannot be undone.</strong>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            className="bg-destructive hover:bg-destructive/90"
          >
            Delete Permanently
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
