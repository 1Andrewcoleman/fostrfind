import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { SUPPORT_EMAIL } from '@/lib/constants'
import { sendEmail } from '@/lib/email'
import { profileFeedbackSchema } from '@/lib/schemas'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeMultiline } from '@/lib/sanitize'
import { UserFeedbackEmail } from '@/emails/user-feedback'
import { validateMutationRequest } from '@/lib/api-security'
import { privateJson } from '@/lib/api-response'

/**
 * POST /api/feedback
 *
 * Authenticated users send product feedback from profile/settings pages only
 * (UI is mounted there). Email goes to SUPPORT_EMAIL via Resend.
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

  const parsed = profileFeedbackSchema.safeParse(body)
  if (!parsed.success) {
    const first = parsed.error.flatten().fieldErrors.message?.[0]
    return NextResponse.json({ error: first ?? 'Invalid request body' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError) {
    console.error('[feedback] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = await rateLimit('feedback:post', user.id, { limit: 8, windowMs: 900_000 })
  if (!rl.success) return rateLimitResponse(rl)

  const message = sanitizeMultiline(parsed.data.message)
  if (message.length < 10) {
    return NextResponse.json({ error: 'Message too short after sanitization.' }, { status: 400 })
  }

  const userEmail = user.email ?? 'unknown'
  const portalLabel = parsed.data.portal === 'foster' ? 'Foster' : 'Shelter'

  const result = await sendEmail({
    to: SUPPORT_EMAIL,
    subject: `[Fostr Find feedback] ${portalLabel}: ${userEmail}`,
    react: UserFeedbackEmail({
      userEmail,
      userId: user.id,
      portalLabel,
      message,
    }),
  })

  if (!result.success) {
    console.error('[feedback] sendEmail failed:', result.error)
    return NextResponse.json({ error: 'Could not send feedback. Try again shortly.' }, { status: 503 })
  }

  return privateJson({ ok: true, mocked: result.mocked })
}
