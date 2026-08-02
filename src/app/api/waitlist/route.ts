import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import { waitlistSignupSchema } from '@/lib/schemas'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeText, sanitizeMultiline } from '@/lib/sanitize'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

/** Postgres unique-violation SQLSTATE — duplicate email on the waitlist. */
const UNIQUE_VIOLATION = '23505'

/**
 * POST /api/waitlist
 *
 * Public (unauthenticated) — visitors add themselves to the pre-launch
 * waitlist from the WAITLIST_MODE landing page. Inserts into
 * `waitlist_signups` (insert-only RLS; nobody can read the list back).
 *
 * Rate limited by IP rather than user id since there is no session.
 * A duplicate email is treated as success — resubmitting must read as
 * "you're on the list", not leak whether an address already signed up.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const guardErr = validateMutationRequest(request)
  if (guardErr) return guardErr

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = waitlistSignupSchema.safeParse(body)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const first = Object.values(fieldErrors).flat()[0]
    return NextResponse.json({ error: first ?? 'Invalid request body' }, { status: 400 })
  }

  // Rate limit: 5 signups per 10 minutes per IP. First hop of
  // x-forwarded-for is the client IP on Vercel; 'unknown' collapses
  // header-less callers (curl, some proxies) into one shared bucket.
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const rl = rateLimit('waitlist:post', ip, { limit: 5, windowMs: 600_000 })
  if (!rl.success) return rateLimitResponse(rl)

  // DEV_MODE has no real Supabase backend — accept the signup so the
  // flow is walkable locally, mirroring the app's placeholder-data stance.
  if (DEV_MODE) return privateJson({ ok: true, mocked: true })

  const { role } = parsed.data
  const name = sanitizeText(parsed.data.name)
  const cityState = sanitizeText(parsed.data.city_state)
  const shelterName = role === 'shelter' ? sanitizeText(parsed.data.shelter_name) : ''
  const note = sanitizeMultiline(parsed.data.note)

  if (!name || !cityState || (role === 'shelter' && !shelterName)) {
    return NextResponse.json({ error: 'Fields empty after sanitization.' }, { status: 400 })
  }

  const supabase = await createClient()
  const { error } = await supabase.from('waitlist_signups').insert({
    role,
    name,
    email: parsed.data.email.toLowerCase(),
    shelter_name: shelterName || null,
    city_state: cityState,
    note: note || null,
  })

  if (error && error.code !== UNIQUE_VIOLATION) {
    console.error('[waitlist] insert failed:', error.message)
    return NextResponse.json(
      { error: 'Could not save your spot. Try again shortly.' },
      { status: 503 },
    )
  }

  return privateJson({ ok: true })
}
