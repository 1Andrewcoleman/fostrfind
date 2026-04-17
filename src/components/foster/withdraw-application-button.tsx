'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Trash2 } from 'lucide-react'
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

interface WithdrawApplicationButtonProps {
  applicationId: string
  dogName: string
}

export function WithdrawApplicationButton({
  applicationId,
  dogName,
}: WithdrawApplicationButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleWithdraw(): Promise<void> {
    setLoading(true)

    try {
      const res = await fetch(`/api/applications/${applicationId}/withdraw`, {
        method: 'POST',
      })

      const body = await res.json()

      if (!res.ok) {
        toast.error(body.error ?? 'Failed to withdraw application.')
        return
      }

      toast.success('Application withdrawn')
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
        <Button
          size="sm"
          variant="outline"
          className="border-destructive text-destructive hover:bg-destructive/10"
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="mr-1 h-3 w-3" />
          )}
          {loading ? 'Withdrawing…' : 'Withdraw'}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Withdraw your application?</AlertDialogTitle>
          <AlertDialogDescription>
            This will remove your application for <strong>{dogName}</strong>. You can apply
            again later if the dog is still available.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleWithdraw}
            className="bg-destructive hover:bg-destructive/90"
          >
            Confirm Withdraw
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
