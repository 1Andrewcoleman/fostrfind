import { NextResponse } from 'next/server'

type NotificationType =
  | 'new_application'
  | 'application_accepted'
  | 'application_declined'
  | 'new_message'
  | 'placement_completed'

interface NotificationPayload {
  type: NotificationType
  to: string
  data: Record<string, string>
}

export async function POST(request: Request) {
  const body: NotificationPayload = await request.json()
  const { type, to, data } = body

  // TODO: uncomment when RESEND_API_KEY is set
  // const { Resend } = await import('resend')
  // const resend = new Resend(process.env.RESEND_API_KEY)

  // TODO: create email templates as React components in src/emails/
  const emailSubjects: Record<NotificationType, string> = {
    new_application: `New foster application for ${data.dogName}`,
    application_accepted: `Great news — your application for ${data.dogName} was accepted!`,
    application_declined: `Update on your application for ${data.dogName}`,
    new_message: `New message about ${data.dogName}`,
    placement_completed: `Thank you for fostering ${data.dogName}!`,
  }

  const subject = emailSubjects[type]

  // TODO: send real email
  // await resend.emails.send({
  //   from: 'Fostr Fix <noreply@fostrfix.com>',
  //   to,
  //   subject,
  //   react: EmailTemplate({ type, data }),
  // })

  console.log(`[notifications] Would send "${subject}" to ${to}`)

  return NextResponse.json({ success: true, type, subject })
}
