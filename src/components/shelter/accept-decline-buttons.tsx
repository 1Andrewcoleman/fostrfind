'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle, Flag, Star } from 'lucide-react'
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
import { RatingDialog } from '@/components/shelter/rating-dialog'

interface AcceptDeclineButtonsProps {
  applicationId: string
  currentStatus: string
  dogName?: string
  fosterName?: string
  /**
   * Pass `true` when a rating already exists for this application.
   * Hides the "Rate Foster" button to avoid a confusing double-submit attempt.
   * Defaults to `false` so the button is shown when unknown.
   */
  hasExistingRating?: boolean
}

type ActionKind = 'accept' | 'decline' | 'complete'

export function AcceptDeclineButtons({
  applicationId,
  currentStatus,
  dogName = 'this dog',
  fosterName = 'this foster parent',
  hasExistingRating = false,
}: AcceptDeclineButtonsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<ActionKind | null>(null)
  const [showRatingDialog, setShowRatingDialog] = useState(false)

  const isTerminal = ['declined', 'completed'].includes(currentStatus)

  async function handleAction(action: ActionKind): Promise<void> {
    setLoading(action)

    try {
      const res = await fetch(`/api/applications/${applicationId}/${action}`, {
        method: 'POST',
      })

      const body = await res.json()

      if (!res.ok) {
        toast.error(body.error ?? `Failed to ${action} application.`)
        return
      }

      const labels: Record<ActionKind, string> = {
        accept: 'Application accepted',
        decline: 'Application declined',
        complete: 'Foster placement completed',
      }

      toast.success(labels[action])

      if (action === 'complete') {
        // Open the rating dialog before refreshing so the shelter can rate
        // the foster right away. The page refreshes when the dialog closes.
        setShowRatingDialog(true)
      } else {
        router.refresh()
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(null)
    }
  }

  function handleRatingDialogClose() {
    setShowRatingDialog(false)
    router.refresh()
  }

  if (isTerminal) {
    return (
      <>
        <p className="text-sm text-muted-foreground">
          This application has been <span className="font-medium">{currentStatus}</span>.
        </p>

        {/*
         * Show a "Rate Foster" button when the placement is completed but
         * has not yet been rated. This covers the case where the shelter
         * dismissed the post-complete rating dialog and navigated back later.
         */}
        {currentStatus === 'completed' && !hasExistingRating && (
          <>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => setShowRatingDialog(true)}
            >
              <Star className="mr-2 h-4 w-4" />
              Rate Foster
            </Button>

            <RatingDialog
              applicationId={applicationId}
              dogName={dogName}
              fosterName={fosterName}
              isOpen={showRatingDialog}
              onClose={handleRatingDialogClose}
            />
          </>
        )}
      </>
    )
  }

  // Accepted applications can only be completed
  if (currentStatus === 'accepted') {
    return (
      <>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button disabled={!!loading}>
              <Flag className="mr-2 h-4 w-4" />
              {loading === 'complete' ? 'Completing…' : 'Mark Complete'}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Complete this foster placement?</AlertDialogTitle>
              <AlertDialogDescription>
                This marks the foster of <strong>{dogName}</strong> by{' '}
                <strong>{fosterName}</strong> as completed. The dog will be recorded as placed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => handleAction('complete')}>
                Confirm Complete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <RatingDialog
          applicationId={applicationId}
          dogName={dogName}
          fosterName={fosterName}
          isOpen={showRatingDialog}
          onClose={handleRatingDialogClose}
        />
      </>
    )
  }

  // Submitted / reviewing — can accept or decline
  return (
    <div className="flex gap-3">
      {/* Accept */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button className="bg-green-600 hover:bg-green-700" disabled={!!loading}>
            <CheckCircle className="mr-2 h-4 w-4" />
            {loading === 'accept' ? 'Accepting…' : 'Accept'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept this application?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll accept <strong>{fosterName}</strong> to foster{' '}
              <strong>{dogName}</strong>. The dog will be marked as pending.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction('accept')}
              className="bg-green-600 hover:bg-green-700"
            >
              Confirm Accept
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Decline */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            disabled={!!loading}
          >
            <XCircle className="mr-2 h-4 w-4" />
            {loading === 'decline' ? 'Declining…' : 'Decline'}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Decline this application?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{fosterName}</strong> will be notified that their application for{' '}
              <strong>{dogName}</strong> was not accepted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => handleAction('decline')}
              className="bg-destructive hover:bg-destructive/90"
            >
              Confirm Decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
