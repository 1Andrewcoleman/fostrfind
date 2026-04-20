'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  // Log the real error detail once to the browser console / Sentry-ish sink;
  // the UI itself intentionally shows static copy so we don't leak stack
  // traces, SQL fragments, or other sensitive guts to the end user.
  useEffect(() => {
    console.error('[error-boundary]', {
      message: error.message,
      digest: error.digest,
    })
  }, [error])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-2 max-w-sm">
        An unexpected error occurred. Please try again — if the problem keeps
        happening, contact support.
      </p>
      <p className="text-xs text-muted-foreground mb-6">
        {error.digest && `Error ID: ${error.digest}`}
      </p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  )
}
