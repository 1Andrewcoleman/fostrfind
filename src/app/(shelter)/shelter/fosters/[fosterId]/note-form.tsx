'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface NoteFormProps {
  fosterId: string
}

export function NoteForm({ fosterId }: NoteFormProps) {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [, startTransition] = useTransition()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) {
      toast.error('Write something first.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/shelter/foster-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fosterId, body: trimmed }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(
          typeof body?.error === 'string' ? body.error : 'Could not save note',
        )
      }
      toast.success('Note saved')
      setValue('')
      startTransition(() => router.refresh())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save note')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Add a private note visible only to your shelter…"
        rows={3}
        maxLength={4000}
        disabled={submitting}
      />
      <div className="flex items-center justify-end">
        <Button type="submit" size="sm" disabled={submitting || !value.trim()}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Pencil className="h-4 w-4" />
              Add note
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
