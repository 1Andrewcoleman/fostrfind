import { NextResponse } from 'next/server'

/**
 * Returns a JSON `NextResponse` with `Cache-Control: no-store, private` set.
 *
 * Use this for every API response that contains user-specific data. Prevents
 * browsers, shared proxies, and CDN edge nodes from caching personalised
 * content even if caching is configured elsewhere in the stack.
 *
 * Public / unauthenticated API responses that are safe to cache (e.g. a
 * shelter listing with no PII) can continue to use `NextResponse.json()`.
 *
 * @example
 *   return privateJson({ success: true, applicationId: params.id })
 *   return privateJson(message, { status: 201 })
 */
export function privateJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', 'no-store, private')
  return NextResponse.json(body, { ...init, headers })
}
