import { NextResponse } from 'next/server'

/**
 * POST /api/notifications/send — DISABLED (410 Gone)
 *
 * This generic client-triggered email dispatcher has been retired. It
 * previously allowed any authenticated user to send transactional-template
 * emails to an arbitrary `to` address and with arbitrary template data,
 * which could be used for phishing, Resend quota exhaustion, and sender
 * reputation damage.
 *
 * All transactional emails are now sent exclusively from server-side domain
 * event handlers that derive recipients and template data from authorised
 * DB records:
 *
 *   - Application submitted  → POST /api/applications (after insert)
 *   - Application accepted   → POST /api/applications/[id]/accept
 *   - Application declined   → POST /api/applications/[id]/decline
 *   - Placement completed    → POST /api/applications/[id]/complete
 *   - New message            → POST /api/messages
 *   - Foster invite          → POST /api/shelter/foster-invites
 *
 * If you need a new transactional email, add the send call inside the
 * relevant domain route after verifying ownership — never trust the client to
 * supply the recipient address or template values.
 */
export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    {
      error:
        'This endpoint has been removed. Transactional emails are sent ' +
        'by server-side domain event handlers after authorization checks.',
    },
    { status: 410 },
  )
}
