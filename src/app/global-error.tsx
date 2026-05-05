'use client'

/**
 * Global error boundary — last-resort fallback when an error escapes the
 * root layout itself (so even the per-segment `error.tsx` can't render).
 *
 * App Router requires `global-error.tsx` to render its own `<html>` and
 * `<body>` because the failed layout is what would have provided them.
 * This file therefore intentionally avoids any project chrome
 * (sidebar, theme provider, fonts) — those depend on the layout that
 * just crashed.
 *
 * Adding this file also silences the @sentry/nextjs startup warning:
 *   "It seems like you don't have a global error handler set up..."
 *
 * Per-segment errors continue to use the friendlier branded boundaries
 * in `src/app/error.tsx`, `(foster)/error.tsx`, and `(shelter)/error.tsx`.
 */

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('[error-boundary:global]', {
      message: error.message,
      digest: error.digest,
    })
    Sentry.captureException(error, {
      tags: { scope: 'global' },
      extra: { digest: error.digest },
    })
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          background: '#f7f4ef',
          color: '#1f1d1a',
          padding: '1rem',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '28rem',
            padding: '2rem',
            borderRadius: '1rem',
            background: '#ffffff',
            border: '1px solid #e5e0d6',
            textAlign: 'center',
          }}
        >
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '0.9rem', color: '#6b6358', margin: '0 0 1.5rem' }}>
            An unexpected error occurred while loading this page. Please try again.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: '0.75rem',
                color: '#6b6358',
                fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
                margin: '0 0 1.5rem',
              }}
            >
              Reference ID: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              appearance: 'none',
              border: 'none',
              borderRadius: '0.5rem',
              padding: '0.625rem 1.25rem',
              background: '#edafb8',
              color: '#1f1d1a',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
