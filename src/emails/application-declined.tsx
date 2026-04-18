import { EmailLayout, emailStyles } from '@/emails/layout'

interface ApplicationDeclinedEmailProps {
  fosterName: string
  dogName: string
  shelterName: string
  browseUrl: string
}

export function ApplicationDeclinedEmail({
  fosterName,
  dogName,
  shelterName,
  browseUrl,
}: ApplicationDeclinedEmailProps) {
  return (
    <EmailLayout
      preview={`Update on your application for ${dogName}`}
      heading={`An update on your application for ${dogName}`}
      cta={{ label: 'Browse other dogs', href: browseUrl }}
    >
      <p style={emailStyles.paragraph}>Hi {fosterName},</p>
      <p style={emailStyles.paragraph}>
        Thank you for applying to foster <strong>{dogName}</strong>. After review,{' '}
        <strong>{shelterName}</strong> has decided to go in a different direction for
        this placement.
      </p>
      <p style={emailStyles.paragraph}>
        Declines are rarely about the foster — shelters weigh a mix of timing,
        experience fit, and household details. There are plenty of other dogs
        looking for exactly your kind of home.
      </p>
    </EmailLayout>
  )
}
