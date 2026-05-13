import { NextResponse } from 'next/server'

/**
 * Validates that a state-changing API request:
 *
 * 1. Comes from an expected origin (when `NEXT_PUBLIC_APP_URL` is set).
 *    Both the configured origin and its www. variant are accepted.
 *    `Origin: null` — sent by iOS/Android home-screen (PWA standalone) mode
 *    and most in-app browsers — is treated the same as an absent header.
 *    Requests with no Origin header at all are also allowed (same-origin SSR
 *    fetches, curl, etc.). Origin checks are optional CSRF defense, not auth.
 *
 * 2. Has a `Content-Type` that matches one of `allowedContentTypes`.
 *    Defaults to `['application/json']`. Pass `['multipart/form-data']` for
 *    file-upload routes.
 *
 * Returns a `NextResponse` error if either check fails, or `null` if the
 * request is acceptable. Call at the top of every authenticated mutation
 * handler before reading the body.
 *
 * @example
 *   const guardErr = validateMutationRequest(request)
 *   if (guardErr) return guardErr
 */
export function validateMutationRequest(
  request: Request,
  allowedContentTypes: readonly string[] = ['application/json'],
): NextResponse | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const allowedOrigins = buildAllowedOrigins(appUrl)

  const origin = request.headers.get('origin')

  if (allowedOrigins.size > 0 && origin) {
    // 'null' origin is sent by iOS/Android PWA standalone mode and in-app
    // browsers (Instagram, TikTok, iMessage, etc.). It cannot be spoofed to
    // gain cross-origin access — Supabase session auth is the real gate.
    if (origin !== 'null' && !allowedOrigins.has(origin)) {
      console.warn('[api-security] blocked origin:', origin, 'allowed:', [...allowedOrigins])
      return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 })
    }
  }

  const contentType = request.headers.get('content-type')
  // Only reject when Content-Type is explicitly set to something unexpected.
  // Absence of Content-Type is allowed — it means the request has no body
  // (common for action routes like /accept, /decline, /complete), or the
  // client omitted it (handled by the JSON parse guard downstream).
  if (contentType) {
    const ct = contentType.toLowerCase()
    const matches = allowedContentTypes.some((t) => ct.startsWith(t))
    if (!matches) {
      return NextResponse.json(
        {
          error: `Unsupported content type. Expected one of: ${allowedContentTypes.join(', ')}`,
        },
        { status: 415 },
      )
    }
  }

  return null
}

/**
 * Builds the set of origins that are acceptable for a given APP_URL.
 * Includes the apex origin and its www. counterpart so that both
 * fostrfind.com and www.fostrfind.com are accepted regardless of which
 * URL a user navigated to.
 */
export function buildAllowedOrigins(appUrl: string | undefined): Set<string> {
  if (!appUrl || !appUrl.startsWith('http')) return new Set()
  const parsed = new URL(appUrl)
  const apex = parsed.origin
  const wwwVariant = parsed.hostname.startsWith('www.')
    ? null
    : `${parsed.protocol}//${`www.${parsed.hostname}`}${parsed.port ? `:${parsed.port}` : ''}`
  return new Set(wwwVariant ? [apex, wwwVariant] : [apex])
}
