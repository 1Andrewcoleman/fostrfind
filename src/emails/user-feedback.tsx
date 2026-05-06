import { EmailLayout, emailStyles } from '@/emails/layout'

interface UserFeedbackEmailProps {
  userEmail: string
  userId: string
  portalLabel: string
  message: string
}

export function UserFeedbackEmail({
  userEmail,
  userId,
  portalLabel,
  message,
}: UserFeedbackEmailProps) {
  return (
    <EmailLayout
      preview={`Feedback from ${userEmail}`}
      heading="Profile feedback"
      footerText="Sent via the Fostr Find profile feedback form."
    >
      <p style={emailStyles.paragraph}>
        <strong>From:</strong> {userEmail}
        <br />
        <strong>User id:</strong> {userId}
        <br />
        <strong>Portal:</strong> {portalLabel}
      </p>
      <hr style={emailStyles.divider} />
      <p style={{ ...emailStyles.paragraph, marginBottom: 0, fontWeight: 600 }}>Message</p>
      <pre
        style={{
          ...emailStyles.paragraph,
          fontFamily: 'ui-monospace, Menlo, Monaco, monospace',
          fontSize: '14px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          margin: '8px 0 0 0',
          padding: '12px',
          backgroundColor: '#f9f6f1',
          border: '1px solid #e8e0d6',
          borderRadius: '8px',
        }}
      >
        {message}
      </pre>
    </EmailLayout>
  )
}
