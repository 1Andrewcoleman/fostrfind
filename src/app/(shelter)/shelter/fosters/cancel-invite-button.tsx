'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function CancelInviteButton({ inviteId }: { inviteId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleCancel() {
    setLoading(true)
    try {
      const res = await fetch(`/api/shelter/foster-invites/${inviteId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error((data as { error?: string }).error ?? 'Failed to cancel invite.')
        return
      }
      router.refresh()
    } catch {
      toast.error('Failed to cancel invite. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={handleCancel}>
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cancel'}
    </Button>
  )
}
