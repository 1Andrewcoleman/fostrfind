'use client'

import { Button } from '@/components/ui/button'

interface ErrorPageProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
      <p className="text-muted-foreground mb-2 max-w-sm">
        {error.message || 'An unexpected error occurred.'}
      </p>
      <p className="text-xs text-muted-foreground mb-6">
        {error.digest && `Error ID: ${error.digest}`}
      </p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  )
}
