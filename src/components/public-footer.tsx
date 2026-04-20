import Link from 'next/link'
import { PawPrint, Mail } from 'lucide-react'
import { SUPPORT_EMAIL } from '@/lib/constants'

/**
 * Footer for public (unauthenticated) pages: landing, /terms, /privacy.
 * Portal-authenticated surfaces use the sidebar layouts instead — this
 * component is intentionally not wired into `(foster)/` or `(shelter)/`.
 *
 * Social icons (Instagram, Twitter/X) are logged as deferred and will
 * land when real handles exist — we deliberately ship *fewer* icons
 * rather than placeholder `href="#"` links, per the Agent Code Quality
 * Protocol.
 */
export function PublicFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="container mx-auto px-4 py-12">
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div className="space-y-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 font-display font-extrabold text-lg tracking-tight"
            >
              <PawPrint className="h-6 w-6 text-warm" aria-hidden="true" />
              Fostr Fix
            </Link>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Connecting shelters with foster families so every dog has a warm place to land while
              they wait for their forever home.
            </p>
            <div className="flex items-center gap-2 pt-1">
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                aria-label={`Email support at ${SUPPORT_EMAIL}`}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-background text-muted-foreground transition-colors hover:border-warm/60 hover:text-warm-foreground hover:bg-warm/10"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          {/* Platform */}
          <FooterColumn title="Platform">
            <FooterLink href="/foster/browse">Browse dogs</FooterLink>
            <FooterLink href="/signup">Sign up</FooterLink>
            <FooterLink href="/login">Sign in</FooterLink>
          </FooterColumn>

          {/* Company */}
          <FooterColumn title="Company">
            <FooterLink href="/#how-it-works">How it works</FooterLink>
            <FooterLink href={`mailto:${SUPPORT_EMAIL}`} external>
              Contact
            </FooterLink>
          </FooterColumn>

          {/* Legal */}
          <FooterColumn title="Legal">
            <FooterLink href="/terms">Terms</FooterLink>
            <FooterLink href="/privacy">Privacy</FooterLink>
          </FooterColumn>
        </div>

        <div className="mt-12 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground">
          <span>&copy; {year} Fostr Fix. All rights reserved.</span>
          <span className="inline-flex items-center gap-1.5">
            Built with
            <PawPrint className="h-3.5 w-3.5 text-warm" aria-hidden="true" />
            for dogs.
          </span>
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground">
        {title}
      </h3>
      <ul className="space-y-2 text-sm">{children}</ul>
    </div>
  )
}

function FooterLink({
  href,
  children,
  external = false,
}: {
  href: string
  children: React.ReactNode
  external?: boolean
}) {
  const className =
    'text-muted-foreground hover:text-foreground transition-colors inline-block'

  // mailto / anchor-to-hash / cross-origin → plain <a>. Next's <Link> also
  // handles `mailto:` but a plain <a> is more predictable.
  if (external || href.startsWith('mailto:') || href.startsWith('http')) {
    return (
      <li>
        <a href={href} className={className}>
          {children}
        </a>
      </li>
    )
  }

  return (
    <li>
      <Link href={href} className={className}>
        {children}
      </Link>
    </li>
  )
}
