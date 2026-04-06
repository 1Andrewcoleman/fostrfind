'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle, XCircle } from 'lucide-react'
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

interface AcceptDeclineButtonsProps {
  applicationId: string
  currentStatus: string
  dogName?: string
  fosterName?: string
}

export function AcceptDeclineButtons({
  applicationId,
  currentStatus,
  dogName = 'this dog',
  fosterName = 'this foster parent',
}: AcceptDeclineButtonsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<'accept' | 'decline' | null>(null)

  const isLocked = ['accepted', 'declined', 'completed'].includes(currentStatus)

  async function handleAccept() {
    setLoading('accept')
    try {
      // TODO: replace with real API call
      await fetch(`/api/applications/${applicationId}/accept`, { method: 'POST' })
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  async function handleDecline() {
    setLoading('decline')
    try {
      // TODO: replace with real API call
      await fetch(`/api/applications/${applicationId}/decline`, { method: 'POST' })
      router.refresh()
    } finally {
      setLoading(null)
    }
  }

  if (isLocked) {
    return (
      <p className="text-sm text-muted-foreground">
        This application has been <span className="font-medium">{currentStatus}</span>.
      </p>
    )
  }

  return (
    <div className="flex gap-3">
      {/* Accept */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button className="bg-green-600 hover:bg-green-700" disabled={!!loading}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Accept
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Accept this application?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll accept <strong>{fosterName}</strong> to foster{' '}
              <strong>{dogName}</strong>. A message thread will open and the dog will be
              marked as pending.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAccept}
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
          <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" disabled={!!loading}>
            <XCircle className="mr-2 h-4 w-4" />
            Decline
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
            <AlertDialogAction onClick={handleDecline} className="bg-destructive hover:bg-destructive/90">
              Confirm Decline
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
