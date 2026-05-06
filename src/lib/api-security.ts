import { NextResponse } from 'next/server'

/**
 * Validates that a state-changing API request:
 *
 * 1. Comes from the expected origin (when `NEXT_PUBLIC_APP_URL` is set).
 *    Requests without an `Origin` header (e.g. same-origin SSR fetches,
 *    curl without -H Origin) are allowed — origin checks are optional CSRF
 *    defense, not authentication.
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
  const allowedOrigin =
    appUrl && appUrl.startsWith('http') ? new URL(appUrl).origin : null

  const origin = request.headers.get('origin')

  // Block requests from an explicitly wrong origin. Absence of Origin header
  // is not rejected — many legitimate server-to-server or same-host requests
  // omit it.
  if (allowedOrigin && origin && origin !== allowedOrigin) {
    return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 })
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
