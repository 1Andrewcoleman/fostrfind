import { AlertTriangle } from 'lucide-react'

interface ServerErrorPanelProps {
  /** Short user-facing title. Defaults to "Something went wrong". */
  title?: string
  /** Optional body copy. Defaults to a refresh-suggestion message. */
  description?: string
}

/**
 * Inline error panel for server-rendered pages whose data fetch failed.
 *
 * Exists so an uncaught Supabase / network error doesn't fall through
 * to the closest error.tsx boundary — that would blow away the whole
 * route group's sidebar + nav and give the user a jarring blank-page
 * crash. Instead each page wraps its data fetching in a try/catch and
 * renders this panel inside the normal layout chrome.
 *
 * Server Components cannot register onClick handlers, so "refresh" is
 * copy-only; the user recovers by reloading the page. Bullet-proof.
 */
export function ServerErrorPanel({
  title = 'Something went wrong',
  description = 'We could not load this page right now. Please refresh in a moment — if the problem keeps happening, contact support.',
}: ServerErrorPanelProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-destructive/10 p-4">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
