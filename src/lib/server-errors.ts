/**
 * Helpers for server-component error handling.
 *
 * `redirect()` and `notFound()` from next/navigation signal control flow
 * by throwing special errors tagged with a `digest` field. If a page's
 * try/catch swallows those, the redirect never happens and the user is
 * shown an inline error panel instead of being navigated. Every catch
 * that wants to surface a ServerErrorPanel must first re-throw the
 * Next.js control-flow errors so the framework can intercept them.
 *
 * Next.js does not publicly export `isRedirectError` in 14.x, so this
 * file matches on the digest prefix directly. Stable across 13.x / 14.x.
 */

export function isNextControlFlowError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const digest = (error as { digest?: unknown }).digest
  if (typeof digest === 'string') {
    if (
      digest.startsWith('NEXT_REDIRECT') ||
      digest.startsWith('NEXT_NOT_FOUND') ||
      digest.startsWith('DYNAMIC_SERVER_USAGE')
    ) {
      return true
    }
  }
  // DynamicServerError (raised when a route that tried to render
  // statically touched `cookies()` / `headers()`) does not use a
  // digest — it's detected by name + message instead. Must re-throw
  // so Next can mark the route as dynamic.
  const name = (error as { name?: unknown }).name
  if (name === 'DynamicServerError') return true
  const message = (error as { message?: unknown }).message
  if (typeof message === 'string' && message.includes('Dynamic server usage')) {
    return true
  }
  return false
}
