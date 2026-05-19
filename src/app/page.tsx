// Landing page — dark warm editorial redesign.
// All color values sourced from the Claude Design mockup (Combined_2.html):
//   bg #1c1a16 · surface #2a2620 · ink #f0ebe1 · pink #c97a7a · green #6f8a5e · amber #c9a55f
// The page overrides the app's OKLCH design-system tokens with explicit hex because
// this dark editorial theme is landing-page-only; the portals keep the light palette.
// Trust-signal stance: no fake metrics. How-It-Works is the sole trust signal.
//
// Three animated sections live in `src/components/landing/`:
//   - <Hero>       fades + slides up on page load (700ms)
//   - <HowItWorks> fades + slides up on scroll-in   (800ms, threshold 0.15)
//   - <CtaBand>    fades + slides up on scroll-in   (800ms, threshold 0.15)
// All motion is CSS-transition-based, so prefers-reduced-motion is respected
// by the browser automatically.

import Link from 'next/link'
import { PawPrint } from 'lucide-react'
import { SUPPORT_EMAIL } from '@/lib/constants'
import { Hero } from '@/components/landing/hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { CtaBand } from '@/components/landing/cta-band'

export default function LandingPage() {
  const year = new Date().getFullYear()

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#1c1a16', color: '#f0ebe1' }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Nav                                                                 */}
      {/* ------------------------------------------------------------------ */}
      <header
        className="sticky top-0 z-40 backdrop-blur-sm"
        style={{
          backgroundColor: 'rgba(28,26,22,0.92)',
          borderBottom: '1px solid rgba(240,235,225,0.08)',
        }}
      >
        <div
          className="mx-auto px-6 md:px-20 h-[72px] flex items-center justify-between"
          style={{ maxWidth: '1440px' }}
        >
          <Link
            href="/"
            className="flex items-center gap-2.5 text-base font-semibold tracking-tight"
            style={{ color: '#f0ebe1' }}
          >
            <PawPrint className="h-6 w-6" style={{ color: '#c97a7a' }} aria-hidden="true" />
            Fostr Find
          </Link>

          <nav className="flex items-center gap-1" aria-label="Site navigation">
            <Link
              href="/login"
              className="px-4 py-2 text-sm font-medium rounded-md transition-colors"
              style={{ color: '#c8c2b4' }}
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="px-4 py-2 text-sm font-medium rounded-full transition-opacity hover:opacity-85"
              style={{ backgroundColor: '#f0ebe1', color: '#1c1a16' }}
            >
              Sign up
            </Link>
          </nav>
        </div>
      </header>

      <Hero />
      <HowItWorks />
      <CtaBand />

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                              */}
      {/* ------------------------------------------------------------------ */}
      <footer
        className="px-6 md:px-20 pt-14 pb-8"
        style={{
          backgroundColor: '#1c1a16',
          borderTop: '1px solid rgba(240,235,225,0.08)',
        }}
      >
        <div className="mx-auto" style={{ maxWidth: '1440px' }}>
          <div className="grid gap-10 lg:grid-cols-[2fr_1fr_1fr_1fr]">
            {/* Brand */}
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2.5 text-base font-semibold mb-4"
                style={{ color: '#f0ebe1' }}
              >
                <PawPrint className="h-6 w-6" style={{ color: '#c97a7a' }} aria-hidden="true" />
                Fostr Find
              </Link>
              <p className="text-sm leading-relaxed" style={{ color: '#8a8478', maxWidth: '18rem' }}>
                Connecting shelters with foster families so every dog has a warm place to land
                while they wait for their forever home.
              </p>
            </div>

            {/* Platform */}
            <FooterColumn title="Platform">
              <FooterLink href="/foster/browse">Browse dogs</FooterLink>
              <FooterLink href="/signup?role=shelter">For shelters</FooterLink>
              <FooterLink href="/signup?role=foster">For fosters</FooterLink>
            </FooterColumn>

            {/* Company */}
            <FooterColumn title="Company">
              <FooterLink href="/#how-it-works">How it works</FooterLink>
              <FooterLink href={`mailto:${SUPPORT_EMAIL}`}>Contact</FooterLink>
              <FooterLink href="/#how-it-works">Mission</FooterLink>
            </FooterColumn>

            {/* Legal */}
            <FooterColumn title="Legal">
              <FooterLink href="/terms">Terms</FooterLink>
              <FooterLink href="/privacy">Privacy</FooterLink>
              <FooterLink href="/privacy">Cookies</FooterLink>
            </FooterColumn>
          </div>

          {/* Bottom bar */}
          <div
            className="mt-12 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs"
            style={{
              borderTop: '1px solid rgba(240,235,225,0.06)',
              color: '#8a8478',
            }}
          >
            <span>© {year} Fostr Find. A new project, just getting started.</span>
            <span className="flex items-center gap-1.5">
              Built with{' '}
              <PawPrint className="h-3.5 w-3.5" style={{ color: '#c97a7a' }} aria-hidden="true" />
              {' '}for dogs.
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-4"
        style={{ color: '#8a8478' }}
      >
        {title}
      </h3>
      <ul className="space-y-2 text-sm">{children}</ul>
    </div>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const cls = 'transition-colors hover:text-[#f0ebe1] inline-block'
  const style = { color: '#c8c2b4' }

  if (href.startsWith('mailto:') || href.startsWith('http')) {
    return (
      <li>
        <a href={href} className={cls} style={style}>
          {children}
        </a>
      </li>
    )
  }

  return (
    <li>
      <Link href={href} className={cls} style={style}>
        {children}
      </Link>
    </li>
  )
}
