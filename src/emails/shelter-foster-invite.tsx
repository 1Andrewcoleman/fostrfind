import { EmailLayout, emailStyles } from '@/emails/layout'

interface ShelterFosterInviteEmailProps {
  shelterName: string
  fosterEmail: string
  /** Shelter-authored message. Free text, may be empty. */
  message?: string | null
  /** Absolute URL the recipient should click. Points at /foster/invites for
   *  existing accounts, or at /signup for brand-new invitees — the route
   *  above picks the right landing page. */
  signinUrl: string
}

export function ShelterFosterInviteEmail({
  shelterName,
  fosterEmail,
  message,
  signinUrl,
}: ShelterFosterInviteEmailProps) {
  const trimmedMessage = typeof message === 'string' ? message.trim() : ''

  return (
    <EmailLayout
      preview={`${shelterName} would like to add you to their foster roster`}
      heading={`${shelterName} invited you to their foster roster`}
      cta={{ label: 'Review invite', href: signinUrl }}
    >
      <p style={emailStyles.paragraph}>Hi {fosterEmail},</p>
      <p style={emailStyles.paragraph}>
        <strong>{shelterName}</strong> would like to add you to their trusted
        group of fosters on Fostr Fix. Being on a shelter{"'"}s roster means
        they can reach out to you first when they have a dog who needs help.
      </p>
      {trimmedMessage && (
        <>
          <p style={emailStyles.paragraph}>They included a message:</p>
          <p style={{ ...emailStyles.paragraph, fontStyle: 'italic' }}>
            “{trimmedMessage}”
          </p>
        </>
      )}
      <p style={emailStyles.paragraph}>
        If you already have a Fostr Fix account, the invite is waiting for you
        in your Invites tab. If you{"'"}re new, create an account with this
        email and the invite will be linked automatically after onboarding.
      </p>
      <p style={{ ...emailStyles.paragraph, color: '#71717a' }}>
        You can decline at any time — this won{"'"}t affect any existing
        applications.
      </p>
    </EmailLayout>
  )
}
