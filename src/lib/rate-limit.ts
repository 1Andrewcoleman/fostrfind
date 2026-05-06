// In-memory rate limiter for API routes.
//
// ┌─────────────────────────────────────────────────────────────────────────┐
// │  PRODUCTION HARDENING NOTE (hardening-audit finding 8.1)               │
// │                                                                         │
// │  This implementation is process-local and does NOT coordinate across   │
// │  serverless / multi-instance deployments. Attackers can bypass limits  │
// │  by spreading requests across multiple Vercel function instances.       │
// │                                                                         │
// │  Migration path to distributed limiting with Upstash Redis:            │
// │                                                                         │
// │    1. Create a free Upstash Redis database at console.upstash.com      │
// │    2. Add env vars: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN   │
// │       (also to .env.example and to Vercel's env settings)              │
// │    3. Install: npm install @upstash/redis @upstash/ratelimit           │
// │    4. Replace this module with:                                         │
// │                                                                         │
// │       import { Ratelimit } from '@upstash/ratelimit'                   │
// │       import { Redis } from '@upstash/redis'                           │
// │                                                                         │
// │       const redis = Redis.fromEnv()                                    │
// │                                                                         │
// │       export async function rateLimit(                                  │
// │         route: string, identifier: string, opts: RateLimitOptions      │
// │       ): Promise<RateLimitResult> {                                     │
// │         const rl = new Ratelimit({                                      │
// │           redis,                                                        │
// │           limiter: Ratelimit.fixedWindow(                              │
// │             opts.limit,                                                 │
// │             `${Math.ceil(opts.windowMs / 1000)} s`,                    │
// │           ),                                                            │
// │           prefix: `fostr:${route}`,                                    │
// │         })                                                              │
// │         const { success, remaining, reset } = await rl.limit(id)      │
// │         return { success, remaining, resetAt: reset,                   │
// │           retryAfter: success ? 0 : Math.ceil((reset-Date.now())/1e3) }│
// │       }                                                                 │
// │                                                                         │
// │    5. Update every caller: const rl = await rateLimit(...)             │
// └─────────────────────────────────────────────────────────────────────────┘
//
// Semantics:
//   - Each (key, identifier) pair gets `limit` tokens per `windowMs`.
//   - `check()` decrements a counter; when it exceeds the limit, the
//     caller is told to back off with a `retryAfter` hint (seconds).
//   - Windows are fixed (not sliding) — cheap, good enough for abuse
//     prevention, and predictable for clients.
//
// Usage from a route handler:
//
//   const identifier = await getRateLimitIdentifier(request)
//   const rl = rateLimit('applications:accept', identifier, {
//     limit: 20,
//     windowMs: 60_000,
//   })
//   if (!rl.success) {
//     return rateLimitResponse(rl)
//   }
//
// Known route keys in use today:
//   - 'applications:create'   (POST /api/applications)
//   - 'applications:accept'   (POST /api/applications/[id]/accept)
//   - 'applications:decline'  (POST /api/applications/[id]/decline)
//   - 'applications:complete' (POST /api/applications/[id]/complete)
//   - 'applications:withdraw' (POST /api/applications/[id]/withdraw)
//   - 'applications:review'   (POST /api/applications/[id]/review)
//   - 'messages:create'       (POST /api/messages)
//   - 'ratings'               (POST /api/ratings)
//   - 'reports'               (POST /api/reports)
//   - 'feedback:post'         (POST /api/feedback)
// Keep this list in sync when adding new mutation routes so future
// auditors can grep for protected endpoints.

import { NextResponse } from 'next/server'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

// Opportunistic cleanup so the Map never grows without bound under real
// traffic. We sweep at most once per second and only touch up to 200
// entries to keep worst-case request latency predictable.
let lastSweep = 0
function maybeSweep(now: number): void {
  if (now - lastSweep < 1000) return
  lastSweep = now
  let scanned = 0
  // forEach avoids the Map iterator protocol (tsconfig target is ES5).
  buckets.forEach((bucket, key) => {
    if (scanned >= 200) return
    if (bucket.resetAt <= now) buckets.delete(key)
    scanned += 1
  })
}

export interface RateLimitOptions {
  /** Max allowed requests per window. */
  limit: number
  /** Window size in milliseconds. */
  windowMs: number
}

export interface RateLimitResult {
  success: boolean
  remaining: number
  resetAt: number
  /** Seconds until the bucket refills (rounded up). */
  retryAfter: number
}

/**
 * Consume one token from the bucket for `route` + `identifier`. The
 * caller decides what "identifier" means — user id for
 * authenticated routes, IP for public ones.
 */
export function rateLimit(
  route: string,
  identifier: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now()
  maybeSweep(now)

  const key = `${route}|${identifier}`
  const existing = buckets.get(key)

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + windowMs
    buckets.set(key, { count: 1, resetAt })
    return {
      success: true,
      remaining: limit - 1,
      resetAt,
      retryAfter: 0,
    }
  }

  existing.count += 1
  const remaining = Math.max(0, limit - existing.count)
  const success = existing.count <= limit
  const retryAfter = success ? 0 : Math.ceil((existing.resetAt - now) / 1000)

  return {
    success,
    remaining,
    resetAt: existing.resetAt,
    retryAfter,
  }
}

/**
 * Derive a stable identifier for a request. Prefer the authenticated
 * user id when available; fall back to the best-effort IP. Works
 * behind proxies thanks to `x-forwarded-for`.
 */
export function getClientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    // First entry is the original client; rest are proxies.
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

/** Standard 429 response with Retry-After + structured body. */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please wait a moment and try again.' },
    {
      status: 429,
      headers: {
        'Retry-After': String(Math.max(1, result.retryAfter)),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    },
  )
}
