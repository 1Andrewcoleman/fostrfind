import { EmailLayout, emailStyles } from '@/emails/layout'

interface ApplicationSubmittedEmailProps {
  shelterName: string
  dogName: string
  fosterName: string
  applicationUrl: string
}

export function ApplicationSubmittedEmail({
  shelterName,
  dogName,
  fosterName,
  applicationUrl,
}: ApplicationSubmittedEmailProps) {
  return (
    <EmailLayout
      preview={`${fosterName} applied to foster ${dogName}`}
      heading={`New foster application for ${dogName}`}
      cta={{ label: 'Review application', href: applicationUrl }}
    >
      <p style={emailStyles.paragraph}>Hi {shelterName},</p>
      <p style={emailStyles.paragraph}>
        <strong>{fosterName}</strong> just submitted a foster application for{' '}
        <strong>{dogName}</strong>.
      </p>
      <p style={emailStyles.paragraph}>
        Open the application to see their profile, housing details, and personal note —
        then accept, decline, or ask follow-up questions through the in-app messaging.
      </p>
    </EmailLayout>
  )
}
