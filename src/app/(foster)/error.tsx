'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw, PawPrint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SUPPORT_EMAIL } from '@/lib/constants'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

/**
 * Error boundary for the foster portal route group. Rendered outside the
 * (foster) layout tree (so no sidebar chrome) — must be self-contained
 * and stay on-brand with the warm palette. User-facing copy is static
 * by design (Phase 3 Step 29) so nothing from the raw error message
 * leaks; the digest is the only correlating ID we surface.
 */
export default function FosterErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[error-boundary:foster]', {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          We hit a snag loading this page
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This isn&apos;t you — something on our side didn&apos;t cooperate.
          Try again, or head back to browsing while we sort it out.
        </p>
        {error.digest && (
          <p className="mt-4 text-xs text-muted-foreground">
            Reference ID: <span className="font-mono">{error.digest}</span>
          </p>
        )}
        <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
          <Button onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link href="/foster/browse">
              <PawPrint className="h-4 w-4" aria-hidden="true" />
              Back to browse
            </Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Still stuck?{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  )
}
