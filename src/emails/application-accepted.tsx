import { EmailLayout, emailStyles } from '@/emails/layout'

interface ApplicationAcceptedEmailProps {
  fosterName: string
  dogName: string
  shelterName: string
  threadUrl: string
}

export function ApplicationAcceptedEmail({
  fosterName,
  dogName,
  shelterName,
  threadUrl,
}: ApplicationAcceptedEmailProps) {
  return (
    <EmailLayout
      preview={`Your application for ${dogName} was accepted!`}
      heading={`Great news! ${dogName} is yours to foster`}
      cta={{ label: 'Message the shelter', href: threadUrl }}
    >
      <p style={emailStyles.paragraph}>Hi {fosterName},</p>
      <p style={emailStyles.paragraph}>
        <strong>{shelterName}</strong> has accepted your application to foster{' '}
        <strong>{dogName}</strong>. Congratulations! 🎉
      </p>
      <p style={emailStyles.paragraph}>
        The next step is to coordinate pickup and handover. Open the in-app thread
        with the shelter to confirm timing, ask about feeding and medical details,
        and share anything they should know about your home.
      </p>
    </EmailLayout>
  )
}
