'use client'

import { useState } from 'react'
import { Flag, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  REPORT_CATEGORIES,
  REPORT_CATEGORY_LABELS,
} from '@/lib/constants'
import type { ReportCategory } from '@/types/database'

interface ReportApplicationDialogProps {
  applicationId: string
  /** Display label for the *subject* — the other party this report is about. */
  subjectLabel: string
  /** Compact button used in inline action rows (foster application card). */
  compact?: boolean
}

/**
 * Mutual reporting dialog (Phase 6.4). Used from both the foster application
 * card and the shelter application detail page; the subject is inferred
 * server-side from the caller's identity, so the same dialog body works in
 * both directions.
 */
export function ReportApplicationDialog({
  applicationId,
  subjectLabel,
  compact = false,
}: ReportApplicationDialogProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const [category, setCategory] = useState<ReportCategory | ''>('')
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  function reset(): void {
    setCategory('')
    setBody('')
  }

  async function handleSubmit(): Promise<void> {
    if (!category || !body.trim()) {
      toast.error('Pick a category and describe the issue.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          applicationId,
          category,
          body: body.trim(),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(json?.error ?? 'Failed to file report.')
        return
      }
      toast.success('Report received. Our team will review it.')
      setOpen(false)
      reset()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size={compact ? 'sm' : 'default'}
          className="text-muted-foreground hover:text-destructive"
        >
          <Flag className={compact ? 'mr-1 h-3 w-3' : 'mr-2 h-4 w-4'} />
          Report
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report {subjectLabel}</DialogTitle>
          <DialogDescription>
            Reports are reviewed privately by the Fostr Fix team. We use them to
            keep both fosters and shelters safe — they are never shared with
            the other party.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="report-category">Category</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as ReportCategory)}
            >
              <SelectTrigger id="report-category">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {REPORT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {REPORT_CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="report-body">What happened?</Label>
            <Textarea
              id="report-body"
              rows={5}
              maxLength={4000}
              placeholder="Share dates, what was said or done, and anything we should know to follow up."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              By submitting you agree to our{' '}
              <Link
                href="/terms"
                className="underline underline-offset-2 hover:text-foreground"
                target="_blank"
              >
                Terms
              </Link>{' '}
              and{' '}
              <Link
                href="/privacy"
                className="underline underline-offset-2 hover:text-foreground"
                target="_blank"
              >
                Privacy Policy
              </Link>
              . Retaliation is not tolerated on either side.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
