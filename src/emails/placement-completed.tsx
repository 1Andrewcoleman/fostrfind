import { EmailLayout, emailStyles } from '@/emails/layout'

interface PlacementCompletedEmailProps {
  /** The recipient's display name (foster OR shelter, depending on who this
   *  particular send is going to). The template addresses them directly. */
  recipientName: string
  /** 'foster' when emailing the foster parent, 'shelter' when emailing the
   *  shelter. Drives the second-person phrasing. */
  recipientRole: 'foster' | 'shelter'
  dogName: string
  fosterName: string
  shelterName: string
  /** Where the recipient can leave a rating for the other party. */
  rateUrl: string
}

export function PlacementCompletedEmail({
  recipientName,
  recipientRole,
  dogName,
  fosterName,
  shelterName,
  rateUrl,
}: PlacementCompletedEmailProps) {
  const otherParty = recipientRole === 'foster' ? shelterName : fosterName
  const otherPartyLabel = recipientRole === 'foster' ? 'shelter' : 'foster'

  return (
    <EmailLayout
      preview={`${dogName}'s foster placement is complete`}
      heading={`${dogName}'s foster placement is complete`}
      cta={{ label: `Leave a rating for the ${otherPartyLabel}`, href: rateUrl }}
    >
      <p style={emailStyles.paragraph}>Hi {recipientName},</p>
      <p style={emailStyles.paragraph}>
        The foster placement of <strong>{dogName}</strong> between{' '}
        <strong>{fosterName}</strong> and <strong>{shelterName}</strong> has been
        marked complete. Thank you for the work you do.
      </p>
      <p style={emailStyles.paragraph}>
        If you&apos;d like, take a moment to leave a rating for{' '}
        <strong>{otherParty}</strong>. Ratings help future placements match the right
        dogs with the right homes.
      </p>
    </EmailLayout>
  )
}
