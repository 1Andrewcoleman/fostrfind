import type { ReactElement } from 'react'
import { Resend } from 'resend'

/**
 * Thin wrapper around Resend. Every application-generated email (shelter
 * accepts an application, foster is notified, etc.) flows through this
 * helper so:
 *
 *   - The "no real API key" case degrades gracefully to a console log
 *     during local dev, letting Step 12's trigger points fire safely.
 *   - The `from` address and brand wrapper are controlled centrally.
 *   - Errors are logged but never thrown — callers should fire-and-forget
 *     (`void sendEmail(...)`) so an email outage never fails a user
 *     action like accepting an application.
 *
 * When wiring a real Resend account you MUST verify the sending domain
 * in the Resend dashboard first; otherwise `resend.emails.send` returns
 * a 403 with `from_validation_failed`. The fallback `from` address
 * below uses the Resend sandbox domain (`onboarding@resend.dev`) which
 * is always allowed but only delivers to the Resend-registered email
 * of the account owner.
 */

export type SendResult =
  | { success: true; mocked: boolean }
  | { success: false; error: string }

const FROM_ADDRESS = process.env.RESEND_FROM ?? 'Fostr Find <onboarding@resend.dev>'

/**
 * Base URL used to build absolute links inside email templates. Trigger
 * points pass `${getAppUrl()}/foster/messages/…` etc. Reads
 * NEXT_PUBLIC_APP_URL from .env so prod and dev point at the right
 * origin. Falls back to localhost so dev runs work out of the box even
 * if the env var is missing.
 */
export function getAppUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (url && url.startsWith('http')) {
    return url.replace(/\/$/, '')
  }
  return 'http://localhost:3000'
}

function hasRealKey(): boolean {
  const key = process.env.RESEND_API_KEY
  // Resend keys are of the form `re_xxxxxxxx…`. The `.env.example`
  // placeholder is `your_resend_api_key_here`, so reject that too.
  return typeof key === 'string' && key.startsWith('re_') && key.length > 10
}

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string
  subject: string
  react: ReactElement
}): Promise<SendResult> {
  if (!hasRealKey()) {
    console.log(`[email] (mock) "${subject}" → ${to}`)
    return { success: true, mocked: true }
  }

  const resend = new Resend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject,
    react,
  })

  if (error) {
    console.error('[email] send failed:', error.message)
    return { success: false, error: error.message }
  }

  return { success: true, mocked: false }
}
