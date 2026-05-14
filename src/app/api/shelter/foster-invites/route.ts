import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { getAppUrl, sendEmail } from '@/lib/email'
import { ShelterFosterInviteEmail } from '@/emails/shelter-foster-invite'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { normalizeInviteEmail } from '@/lib/shelter-roster'
import { createNotification } from '@/lib/notifications'
import { sanitizeMultiline } from '@/lib/sanitize'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

/**
 * POST /api/shelter/foster-invites
 *
 * Creates a pending invite for a foster to join the caller's shelter's roster.
 *
 * Body:
 *   { email: string; message?: string }
 *
 * Side effects:
 *   - Inserts a row into shelter_foster_invites under the caller's JWT
 *     (RLS policy "shelter_foster_invites: shelter manage own" authorises
 *     this for the row's own shelter).
 *   - If the email already resolves to a foster_parents row, the invite's
 *     foster_id is populated at creation time. Otherwise it stays null
 *     and the onboarding email-match claim picks it up after signup.
 *   - If the email corresponds to a foster already on the roster, the
 *     route is a 200 no-op (no invite created, no email sent).
 *   - Sends the ShelterFosterInviteEmail via sendEmail() fire-and-forget.
 *     Email send failure does NOT fail the route — the invite row is
 *     authoritative and the foster can still discover it in-app.
 *
 * Auth: caller must own the shelter row they're inviting from. Only one
 * "caller-owned shelter" is supported; the route finds it via user_id
 * (matches the rest of the shelter portal's pattern).
 */

const bodySchema = z.object({
  email: z.string().trim().min(3).max(320).email(),
  message: z.string().trim().max(2000).optional(),
})

export async function POST(request: Request): Promise<NextResponse> {
  const guardErr = validateMutationRequest(request)
  if (guardErr) return guardErr

  const supabase = await createClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('[foster-invites/create] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 30 invites/min/user keeps accidental runaway or minor abuse in check
  // while comfortably covering normal onboarding-day bulk invites.
  const rl = await rateLimit('shelter-foster-invites:create', user.id, {
    limit: 30,
    windowMs: 60_000,
  })
  if (!rl.success) return rateLimitResponse(rl)

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof z.ZodError
            ? 'Enter a valid email and keep the message under 2000 characters.'
            : 'Invalid JSON body',
      },
      { status: 400 },
    )
  }

  // Resolve the caller's shelter.
  const { data: shelterRow, error: shelterErr } = await supabase
    .from('shelters')
    .select('id, name')
    .eq('user_id', user.id)
    .maybeSingle()

  if (shelterErr) {
    console.error('[foster-invites/create] shelter fetch failed:', shelterErr.message)
    return NextResponse.json({ error: 'Unable to resolve shelter' }, { status: 500 })
  }
  if (!shelterRow) {
    return NextResponse.json({ error: 'Caller is not a shelter' }, { status: 403 })
  }

  const normalizedEmail = normalizeInviteEmail(body.email)
  if (!normalizedEmail) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 })
  }

  // Sanitize once at the boundary. Zod gave us a trimmed string; sanitize
  // strips HTML-tag-shaped substrings and normalises whitespace. The stored
  // value and email-template value MUST match so admin reads, audit views,
  // or any future renderer can never surface raw input.
  const cleanedMessage = body.message ? sanitizeMultiline(body.message) || null : null

  // Is the email already a registered foster? If so we pre-link foster_id,
  // and we can also detect the "already on the roster" case cheaply.
  const { data: existingFoster } = await supabase
    .from('foster_parents')
    .select('id, user_id')
    .ilike('email', normalizedEmail)
    .maybeSingle()
  const existingFosterRow = existingFoster as { id: string; user_id: string } | null
  const existingFosterId = existingFosterRow?.id ?? null

  if (existingFosterId) {
    const { data: alreadyInRoster } = await supabase
      .from('shelter_fosters')
      .select('shelter_id')
      .eq('shelter_id', shelterRow.id)
      .eq('foster_id', existingFosterId)
      .maybeSingle()
    if (alreadyInRoster) {
      return privateJson({
        success: true,
        alreadyInRoster: true,
      })
    }
  }

  // Insert the pending invite. The partial unique index (shelter_id,
  // lower(email)) WHERE status='pending' enforces "one pending at a time";
  // a duplicate insertion returns a unique-violation which we surface as
  // a 409 so the shelter sees actionable feedback.
  const { data: inserted, error: insertErr } = await supabase
    .from('shelter_foster_invites')
    .insert({
      shelter_id: shelterRow.id,
      email: normalizedEmail,
      foster_id: existingFosterId,
      status: 'pending',
      message: cleanedMessage,
    })
    .select('id, email, status, foster_id, created_at')
    .single()

  if (insertErr) {
    // Postgres unique_violation code
    if ((insertErr as { code?: string }).code === '23505') {
      return NextResponse.json(
        { error: 'A pending invite already exists for this email.' },
        { status: 409 },
      )
    }
    console.error('[foster-invites/create] insert failed:', insertErr.message)
    return NextResponse.json({ error: 'Failed to create invite' }, { status: 500 })
  }

  // Fire-and-forget invite email. Point `signinUrl` at /foster/invites;
  // the sign-in flow routes to that page on return and signup completes
  // onboarding with the email-claim hook before landing the user there.
  const shelterName = shelterRow.name as string
  void sendEmail({
    to: normalizedEmail,
    subject: `${shelterName} invited you to their foster roster`,
    react: ShelterFosterInviteEmail({
      shelterName,
      fosterEmail: normalizedEmail,
      message: cleanedMessage,
      signinUrl: `${getAppUrl()}/foster/invites`,
    }),
  })

  if (existingFosterRow?.user_id) {
    void createNotification({
      userId: existingFosterRow.user_id,
      type: 'invite_received',
      title: `${shelterName} has invited you to join their foster roster`,
      link: '/foster/invites',
      metadata: { inviteId: inserted.id, shelterId: shelterRow.id },
    })
  }

  return privateJson({ success: true, invite: inserted })
}
