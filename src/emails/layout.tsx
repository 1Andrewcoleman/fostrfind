import type { CSSProperties, ReactNode } from 'react'

/**
 * Minimal shared shell for every transactional email. Plain React +
 * inline styles by design — per the Step 11 pitfall we deliberately do
 * NOT pull in `@react-email/components`, which would balloon the bundle
 * and require its own rendering pipeline.
 *
 * Every template composes `<EmailLayout>` with a body + optional CTA
 * button. The visual language mirrors the app (warm brown primary, soft
 * neutrals) while keeping everything email-client-safe: no flex/grid,
 * fixed-pixel widths, web-safe font stack.
 */

const styles = {
  body: {
    margin: 0,
    padding: 0,
    backgroundColor: '#f5f1ec',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#2b2420',
    lineHeight: '1.5',
  } satisfies CSSProperties,
  container: {
    maxWidth: '560px',
    margin: '0 auto',
    padding: '32px 16px',
  } satisfies CSSProperties,
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid #e8e0d6',
    borderRadius: '12px',
    padding: '32px',
  } satisfies CSSProperties,
  brand: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#7c4a24',
    marginBottom: '24px',
    letterSpacing: '-0.01em',
  } satisfies CSSProperties,
  heading: {
    fontSize: '22px',
    fontWeight: 700,
    margin: '0 0 12px 0',
    color: '#2b2420',
  } satisfies CSSProperties,
  paragraph: {
    fontSize: '15px',
    margin: '0 0 16px 0',
    color: '#3a3128',
  } satisfies CSSProperties,
  button: {
    display: 'inline-block',
    padding: '12px 24px',
    backgroundColor: '#7c4a24',
    color: '#ffffff',
    textDecoration: 'none',
    borderRadius: '8px',
    fontSize: '15px',
    fontWeight: 600,
    marginTop: '8px',
  } satisfies CSSProperties,
  footer: {
    fontSize: '12px',
    color: '#8a7e73',
    textAlign: 'center' as const,
    marginTop: '24px',
  } satisfies CSSProperties,
  divider: {
    height: '1px',
    backgroundColor: '#e8e0d6',
    margin: '24px 0',
    border: 'none',
  } satisfies CSSProperties,
}

interface EmailLayoutProps {
  /** Document preview text shown in inbox list views before the user opens. */
  preview?: string
  /** h1 at the top of the card. */
  heading: string
  children: ReactNode
  /** Optional primary CTA. */
  cta?: { label: string; href: string }
}

export function EmailLayout({ preview, heading, children, cta }: EmailLayoutProps) {
  return (
    <div style={styles.body}>
      {/* Hidden preview text for inbox clients. */}
      {preview && (
        <div style={{ display: 'none', overflow: 'hidden', color: 'transparent', height: 0 }}>
          {preview}
        </div>
      )}
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={styles.brand}>Fostr Fix</div>
          <h1 style={styles.heading}>{heading}</h1>
          {children}
          {cta && (
            <p style={{ ...styles.paragraph, marginTop: '24px' }}>
              <a href={cta.href} style={styles.button}>
                {cta.label}
              </a>
            </p>
          )}
        </div>
        <p style={styles.footer}>
          You&apos;re receiving this because you have a Fostr Fix account.
        </p>
      </div>
    </div>
  )
}

export const emailStyles = styles
