import { EmailLayout, emailStyles } from '@/emails/layout'
import { REPORT_CATEGORY_LABELS } from '@/lib/constants'

interface ReportNotificationEmailProps {
  reportId: string
  applicationId: string
  category: string
  reporterUserId: string
  reporterRole: 'foster' | 'shelter'
  body: string
  createdAt: string
  appUrl: string
}

export function ReportNotificationEmail({
  reportId,
  applicationId,
  category,
  reporterUserId,
  reporterRole,
  body,
  createdAt,
  appUrl,
}: ReportNotificationEmailProps) {
  const categoryLabel =
    REPORT_CATEGORY_LABELS[category as keyof typeof REPORT_CATEGORY_LABELS] ?? category

  return (
    <EmailLayout
      preview={`Safety report filed: ${categoryLabel}`}
      heading="⚠️ New safety report"
      footerText="This is an automated alert from Fostr Find. Review and triage promptly."
    >
      <p style={{ ...emailStyles.paragraph, color: '#b45309', fontWeight: 600 }}>
        A report has been filed and requires triage.
      </p>

      <p style={emailStyles.paragraph}>
        <strong>Report ID:</strong> {reportId}
        <br />
        <strong>Filed at:</strong> {new Date(createdAt).toUTCString()}
        <br />
        <strong>Category:</strong> {categoryLabel}
        <br />
        <strong>Reporter role:</strong> {reporterRole}
        <br />
        <strong>Reporter user ID:</strong> {reporterUserId}
        <br />
        <strong>Application ID:</strong> {applicationId}
      </p>

      <hr style={emailStyles.divider} />

      <p style={{ ...emailStyles.paragraph, marginBottom: 0, fontWeight: 600 }}>
        Reporter&apos;s statement
      </p>
      <pre
        style={{
          ...emailStyles.paragraph,
          fontFamily: 'ui-monospace, Menlo, Monaco, monospace',
          fontSize: '14px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          margin: '8px 0 0 0',
          padding: '12px',
          backgroundColor: '#fff7ed',
          border: '1px solid #fed7aa',
          borderRadius: '8px',
        }}
      >
        {body}
      </pre>

      <hr style={emailStyles.divider} />

      <p style={emailStyles.paragraph}>
        <a
          href={`${appUrl}/shelter/applications/${applicationId}`}
          style={{ color: '#b45309', fontWeight: 600 }}
        >
          View application →
        </a>
      </p>
    </EmailLayout>
  )
}
