import { NextResponse } from 'next/server'
import type { ReactElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { ApplicationSubmittedEmail } from '@/emails/application-submitted'
import { ApplicationAcceptedEmail } from '@/emails/application-accepted'
import { ApplicationDeclinedEmail } from '@/emails/application-declined'
import { PlacementCompletedEmail } from '@/emails/placement-completed'
import { NewMessageEmail } from '@/emails/new-message'
import { ShelterFosterInviteEmail } from '@/emails/shelter-foster-invite'

/**
 * POST /api/notifications/send
 *
 * Body: `{ type, to, data }`
 *
 * Dispatches to one of the five transactional email templates. The
 * actual sending is delegated to `sendEmail()` in `@/lib/email`,
 * which console-logs when no real Resend API key is configured so
 * Step 12's trigger points can fire safely in dev.
 *
 * Auth: any authenticated user can trigger. Trigger points are
 * themselves auth-guarded (API routes that fire these emails verify
 * shelter/foster ownership before firing). This endpoint exists to
 * support client-side trigger points — e.g. a foster submitting an
 * application from `/foster/dog/[id]` — where calling sendEmail()
 * directly isn't possible because Resend's server SDK can't be
 * imported into a `'use client'` bundle.
 */

const TYPES = [
  'application-submitted',
  'application-accepted',
  'application-declined',
  'placement-completed',
  'new-message',
  'shelter-foster-invite',
] as const
type NotificationType = (typeof TYPES)[number]

interface BaseBody {
  type: NotificationType
  to: string
  data: Record<string, unknown>
}

function isValidType(value: unknown): value is NotificationType {
  return typeof value === 'string' && (TYPES as readonly string[]).includes(value)
}

function assertString(v: unknown, field: string): string {
  if (typeof v !== 'string' || v.length === 0) {
    throw new Error(`Missing or invalid field: ${field}`)
  }
  return v
}

/**
 * Turn a `(type, data)` pair into the subject line + rendered React
 * element. Throws when required fields are missing. Keeps per-type
 * branching in one place so the POST handler stays declarative.
 */
function renderNotification(
  type: NotificationType,
  data: Record<string, unknown>,
): { subject: string; react: ReactElement } {
  switch (type) {
    case 'application-submitted': {
      const shelterName = assertString(data.shelterName, 'shelterName')
      const dogName = assertString(data.dogName, 'dogName')
      const fosterName = assertString(data.fosterName, 'fosterName')
      const applicationUrl = assertString(data.applicationUrl, 'applicationUrl')
      return {
        subject: `New foster application for ${dogName}`,
        react: ApplicationSubmittedEmail({
          shelterName,
          dogName,
          fosterName,
          applicationUrl,
        }),
      }
    }
    case 'application-accepted': {
      const fosterName = assertString(data.fosterName, 'fosterName')
      const dogName = assertString(data.dogName, 'dogName')
      const shelterName = assertString(data.shelterName, 'shelterName')
      const threadUrl = assertString(data.threadUrl, 'threadUrl')
      return {
        subject: `Great news — your application for ${dogName} was accepted`,
        react: ApplicationAcceptedEmail({
          fosterName,
          dogName,
          shelterName,
          threadUrl,
        }),
      }
    }
    case 'application-declined': {
      const fosterName = assertString(data.fosterName, 'fosterName')
      const dogName = assertString(data.dogName, 'dogName')
      const shelterName = assertString(data.shelterName, 'shelterName')
      const browseUrl = assertString(data.browseUrl, 'browseUrl')
      return {
        subject: `An update on your application for ${dogName}`,
        react: ApplicationDeclinedEmail({
          fosterName,
          dogName,
          shelterName,
          browseUrl,
        }),
      }
    }
    case 'placement-completed': {
      const recipientName = assertString(data.recipientName, 'recipientName')
      const recipientRole = data.recipientRole
      if (recipientRole !== 'foster' && recipientRole !== 'shelter') {
        throw new Error('Missing or invalid field: recipientRole')
      }
      const dogName = assertString(data.dogName, 'dogName')
      const fosterName = assertString(data.fosterName, 'fosterName')
      const shelterName = assertString(data.shelterName, 'shelterName')
      const rateUrl = assertString(data.rateUrl, 'rateUrl')
      return {
        subject: `${dogName}'s foster placement is complete`,
        react: PlacementCompletedEmail({
          recipientName,
          recipientRole,
          dogName,
          fosterName,
          shelterName,
          rateUrl,
        }),
      }
    }
    case 'new-message': {
      const recipientName = assertString(data.recipientName, 'recipientName')
      const senderName = assertString(data.senderName, 'senderName')
      const dogName = assertString(data.dogName, 'dogName')
      const messagePreview = assertString(data.messagePreview, 'messagePreview')
      const threadUrl = assertString(data.threadUrl, 'threadUrl')
      return {
        subject: `New message from ${senderName} about ${dogName}`,
        react: NewMessageEmail({
          recipientName,
          senderName,
          dogName,
          messagePreview,
          threadUrl,
        }),
      }
    }
    case 'shelter-foster-invite': {
      const shelterName = assertString(data.shelterName, 'shelterName')
      const fosterEmail = assertString(data.fosterEmail, 'fosterEmail')
      const signinUrl = assertString(data.signinUrl, 'signinUrl')
      // `message` is optional free text
      const message = typeof data.message === 'string' ? data.message : null
      return {
        subject: `${shelterName} invited you to their foster roster`,
        react: ShelterFosterInviteEmail({
          shelterName,
          fosterEmail,
          message,
          signinUrl,
        }),
      }
    }
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) {
    console.error('[notifications/send] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Notifications are fire-and-forget from trigger points (message send,
  // application submit, etc.) — legitimate volume is small. Keep tight.
  const rl = rateLimit('notifications:send', user.id, { limit: 30, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  let body: BaseBody
  try {
    body = (await request.json()) as BaseBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!isValidType(body.type)) {
    return NextResponse.json({ error: 'Unknown notification type' }, { status: 400 })
  }

  if (typeof body.to !== 'string' || body.to.length === 0) {
    return NextResponse.json({ error: 'Missing recipient (to)' }, { status: 400 })
  }

  if (!body.data || typeof body.data !== 'object') {
    return NextResponse.json({ error: 'Missing data payload' }, { status: 400 })
  }

  let subject: string
  let react: ReactElement
  try {
    ;({ subject, react } = renderNotification(body.type, body.data))
  } catch (err) {
    console.error('[notifications/send] renderNotification failed:', err instanceof Error ? err.message : String(err))
    return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
  }

  const result = await sendEmail({ to: body.to, subject, react })

  if (!result.success) {
    console.error('[notifications/send] sendEmail failed:', result.error)
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 502 })
  }

  return NextResponse.json({ success: true, mocked: result.mocked })
}
