'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'
import * as Sentry from '@sentry/nextjs'
import { Button } from '@/components/ui/button'
import { SUPPORT_EMAIL } from '@/lib/constants'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('[error-boundary:root]', {
      message: error.message,
      digest: error.digest,
    })
    // Sentry auto-captures uncaught errors, but errors that hit a
    // route's error.tsx have already been "handled" by Next, so we
    // re-emit them explicitly here. The `scope` tag lets us filter
    // root-vs-portal errors in the dashboard.
    Sentry.captureException(error, {
      tags: { scope: 'root' },
      extra: { digest: error.digest },
    })
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. Try again — if the problem keeps
          happening, our support team can help.
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
            <Link href="/">
              <Home className="h-4 w-4" aria-hidden="true" />
              Go home
            </Link>
          </Button>
        </div>
        <p className="mt-6 text-xs text-muted-foreground">
          Need help?{' '}
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
