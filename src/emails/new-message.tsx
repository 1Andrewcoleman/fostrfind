import { EmailLayout, emailStyles } from '@/emails/layout'

interface NewMessageEmailProps {
  recipientName: string
  senderName: string
  dogName: string
  messagePreview: string
  threadUrl: string
}

export function NewMessageEmail({
  recipientName,
  senderName,
  dogName,
  messagePreview,
  threadUrl,
}: NewMessageEmailProps) {
  return (
    <EmailLayout
      preview={`${senderName}: ${messagePreview}`}
      heading={`New message from ${senderName}`}
      cta={{ label: 'Open the conversation', href: threadUrl }}
    >
      <p style={emailStyles.paragraph}>Hi {recipientName},</p>
      <p style={emailStyles.paragraph}>
        <strong>{senderName}</strong> sent you a message about <strong>{dogName}</strong>:
      </p>
      <blockquote
        style={{
          ...emailStyles.paragraph,
          borderLeft: '3px solid #d9c9b6',
          paddingLeft: '16px',
          margin: '16px 0',
          fontStyle: 'italic',
          color: '#5a4e42',
        }}
      >
        {messagePreview}
      </blockquote>
    </EmailLayout>
  )
}
