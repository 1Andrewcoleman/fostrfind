// Landing page — dark warm editorial redesign.
// All color values sourced from the Claude Design mockup (Combined_2.html):
//   bg #1c1a16 · surface #2a2620 · ink #f0ebe1 · pink #c97a7a · green #6f8a5e · amber #c9a55f
// The page overrides the app's OKLCH design-system tokens with explicit hex because
// this dark editorial theme is landing-page-only; the portals keep the light palette.
// Trust-signal stance: no fake metrics. How-It-Works is the sole trust signal.

import Link from 'next/link'
import { PawPrint, Heart, Search, Home } from 'lucide-react'
import { SUPPORT_EMAIL } from '@/lib/constants'

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
          className="mx-auto px-6 md:px-20 h-16 flex items-center justify-between"
          style={{ maxWidth: '1440px' }}
        >
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-semibold tracking-tight"
            style={{ color: '#f0ebe1' }}
          >
            <PawPrint className="h-[18px] w-[18px]" style={{ color: '#c97a7a' }} aria-hidden="true" />
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

      {/* ------------------------------------------------------------------ */}
      {/* Hero — cinematic dark field; content anchors to bottom-left        */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="flex flex-col justify-end px-6 md:px-20 pb-16 md:pb-24"
        style={{ minHeight: '85vh' }}
        aria-labelledby="hero-heading"
      >
        <div className="mx-auto w-full" style={{ maxWidth: '1440px' }}>
          {/* Eyebrow chip */}
          <div
            className="inline-flex items-center gap-2 mb-8 px-4 py-1.5 rounded-full text-xs font-medium tracking-wide"
            style={{
              backgroundColor: 'rgba(240,235,225,0.07)',
              color: '#8a8478',
              border: '1px solid rgba(240,235,225,0.1)',
            }}
          >
            We&apos;re new here — come help build it
          </div>

          {/* H1 — Instrument Serif, very large, tight tracking */}
          <h1
            id="hero-heading"
            className="font-normal leading-[1.02] mb-6"
            style={{
              fontFamily: 'var(--font-instrument)',
              fontSize: 'clamp(3.25rem, 7.5vw, 5.25rem)',
              letterSpacing: '-0.03em',
              color: '#f0ebe1',
            }}
          >
            Find a foster.<br />Save a life.
          </h1>

          {/* Subtext */}
          <p
            className="text-[15px] md:text-base leading-relaxed mb-10"
            style={{ color: 'rgba(240,235,225,0.6)', maxWidth: '22rem' }}
          >
            Fostr Find connects animal shelters with foster families — giving dogs a warm
            place to land while they wait for their forever home.
          </p>

          {/* CTAs — pill-shaped, pink for foster, dark-green for shelter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/signup?role=foster"
              className="inline-flex items-center gap-1.5 self-start px-6 py-3 rounded-full text-sm font-medium transition-opacity hover:opacity-85"
              style={{ backgroundColor: '#c97a7a', color: '#f5ede8' }}
            >
              I&apos;m a foster parent <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/signup?role=shelter"
              className="inline-flex items-center gap-1.5 self-start px-6 py-3 rounded-full text-sm font-medium transition-opacity hover:opacity-85"
              style={{ backgroundColor: '#303829', color: '#8aa376' }}
            >
              I run a shelter <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* How it works                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="how-it-works"
        className="px-6 md:px-20 py-20 md:py-28 scroll-mt-16"
        style={{ backgroundColor: '#25221c' }}
        aria-labelledby="hiw-heading"
      >
        <div className="mx-auto" style={{ maxWidth: '1440px' }}>
          {/* Section eyebrow — line + label */}
          <div className="flex items-center gap-3 mb-10">
            <span
              className="block h-px w-6"
              style={{ backgroundColor: '#8a8478' }}
              aria-hidden="true"
            />
            <span
              className="text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ color: '#8a8478' }}
            >
              How it works
            </span>
          </div>

          {/* Heading + paragraph — two columns on large screens */}
          <div className="grid lg:grid-cols-2 gap-6 lg:gap-20 mb-14 items-start">
            <h2
              id="hiw-heading"
              className="font-normal leading-[1.06]"
              style={{
                fontFamily: 'var(--font-instrument)',
                fontSize: 'clamp(2rem, 4.5vw, 3.25rem)',
                letterSpacing: '-0.02em',
                color: '#f0ebe1',
              }}
            >
              From shelter{' '}
              <em style={{ color: '#c97a7a', fontStyle: 'italic' }}>to sofa</em>
              <br />in three steps.
            </h2>
            <p
              className="lg:pt-2 text-sm md:text-[15px] leading-relaxed"
              style={{ color: '#c8c2b4', maxWidth: '26rem' }}
            >
              No spreadsheets, group chats, or crossed wires. Fostr Find brings the whole
              journey into one calm, friendly place — so the dog gets home faster.
            </p>
          </div>

          {/* Step cards */}
          <ol className="grid md:grid-cols-3 gap-4">
            {/* Step 1 — shelters */}
            <li
              className="relative rounded-[18px] p-6 overflow-hidden"
              style={{
                backgroundColor: '#2a2620',
                border: '1px solid rgba(240,235,225,0.06)',
              }}
            >
              <div
                className="inline-flex h-8 w-8 items-center justify-center rounded-full mb-5"
                style={{ backgroundColor: 'rgba(201,122,122,0.15)' }}
              >
                <Heart className="h-3.5 w-3.5" style={{ color: '#c97a7a' }} aria-hidden="true" />
              </div>
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-3"
                style={{ color: '#c97a7a' }}
              >
                For shelters
              </p>
              <h3 className="text-xl font-medium mb-3 tracking-tight" style={{ color: '#f0ebe1' }}>
                Shelters list dogs
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#8a8478' }}>
                Rescue organizations post the dogs in their care — photos, temperament notes,
                medical needs, everything a future foster should know.
              </p>
            </li>

            {/* Step 2 — fosters; watermark "2" in background */}
            <li
              className="relative rounded-[18px] p-6 overflow-hidden"
              style={{
                backgroundColor: '#2a2620',
                border: '1px solid rgba(240,235,225,0.06)',
              }}
            >
              <span
                className="pointer-events-none absolute bottom-3 right-4 font-semibold leading-none select-none"
                style={{
                  color: 'rgba(240,235,225,0.04)',
                  fontFamily: 'var(--font-instrument)',
                  fontSize: '7rem',
                }}
                aria-hidden="true"
              >
                2
              </span>
              <div
                className="inline-flex h-8 w-8 items-center justify-center rounded-full mb-5"
                style={{ backgroundColor: 'rgba(201,165,95,0.15)' }}
              >
                <Search className="h-3.5 w-3.5" style={{ color: '#c9a55f' }} aria-hidden="true" />
              </div>
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-3"
                style={{ color: '#c9a55f' }}
              >
                For foster families
              </p>
              <h3 className="text-xl font-medium mb-3 tracking-tight" style={{ color: '#f0ebe1' }}>
                Fosters browse &amp; apply
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#8a8478' }}>
                Foster families search by location, size, and energy level, then apply with
                a short note about their home.
              </p>
            </li>

            {/* Step 3 — together */}
            <li
              className="relative rounded-[18px] p-6 overflow-hidden"
              style={{
                backgroundColor: '#2a2620',
                border: '1px solid rgba(240,235,225,0.06)',
              }}
            >
              <div
                className="inline-flex h-8 w-8 items-center justify-center rounded-full mb-5"
                style={{ backgroundColor: 'rgba(111,138,94,0.18)' }}
              >
                <Home className="h-3.5 w-3.5" style={{ color: '#6f8a5e' }} aria-hidden="true" />
              </div>
              <p
                className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-3"
                style={{ color: '#6f8a5e' }}
              >
                Together
              </p>
              <h3 className="text-xl font-medium mb-3 tracking-tight" style={{ color: '#f0ebe1' }}>
                A dog finds a home
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: '#8a8478' }}>
                Shelters pick the right match and coordinate the handoff inside the app.
                Then the wait for forever begins — somewhere warm.
              </p>
            </li>
          </ol>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Pick your side                                                      */}
      {/* ------------------------------------------------------------------ */}
      <section
        className="px-6 md:px-20 py-20 md:py-28"
        style={{ backgroundColor: '#1c1a16' }}
        aria-labelledby="pick-heading"
      >
        <div className="mx-auto" style={{ maxWidth: '1440px' }}>
          {/* Centered heading */}
          <div className="text-center mb-12">
            <h2
              id="pick-heading"
              className="font-normal mb-4"
              style={{
                fontFamily: 'var(--font-instrument)',
                fontSize: 'clamp(2.25rem, 5vw, 3.75rem)',
                letterSpacing: '-0.02em',
                color: '#f0ebe1',
              }}
            >
              Pick your{' '}
              <em style={{ color: '#c97a7a', fontStyle: 'italic' }}>side</em>
              {' '}of the leash.
            </h2>
            <p className="text-sm leading-relaxed mx-auto" style={{ color: '#8a8478', maxWidth: '26rem' }}>
              We&apos;re just opening doors. Walk through one — we&apos;ll meet you on the other side.
            </p>
          </div>

          {/* Two tinted panels */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Foster — dark burgundy panel */}
            <div
              className="rounded-[18px] p-8 md:p-10 flex flex-col justify-between"
              style={{ backgroundColor: '#4a2f2f', minHeight: '280px' }}
            >
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-6"
                  style={{ color: '#d99a9a' }}
                >
                  For foster families
                </p>
                <h3
                  className="font-normal leading-tight mb-4"
                  style={{
                    fontFamily: 'var(--font-instrument)',
                    fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
                    color: '#f0ebe1',
                  }}
                >
                  Open your home.
                </h3>
                <p
                  className="text-sm leading-relaxed mb-8"
                  style={{ color: 'rgba(240,235,225,0.5)', maxWidth: '18rem' }}
                >
                  A weekend, a month, until forever finds them. You decide the chapter.
                </p>
              </div>
              <Link
                href="/signup?role=foster"
                className="inline-flex items-center gap-1.5 self-start px-5 py-2.5 rounded-full text-sm font-medium transition-opacity hover:opacity-85"
                style={{ backgroundColor: '#c97a7a', color: '#f5ede8' }}
              >
                Become a foster <span aria-hidden="true">→</span>
              </Link>
            </div>

            {/* Shelter — dark green panel */}
            <div
              className="rounded-[18px] p-8 md:p-10 flex flex-col justify-between"
              style={{ backgroundColor: '#303829', minHeight: '280px' }}
            >
              <div>
                <p
                  className="text-[10px] font-semibold uppercase tracking-[0.18em] mb-6"
                  style={{ color: '#8aa376' }}
                >
                  For shelters
                </p>
                <h3
                  className="font-normal leading-tight mb-4"
                  style={{
                    fontFamily: 'var(--font-instrument)',
                    fontSize: 'clamp(1.75rem, 3vw, 2.5rem)',
                    color: '#f0ebe1',
                  }}
                >
                  Find them a soft landing.
                </h3>
                <p
                  className="text-sm leading-relaxed mb-8"
                  style={{ color: 'rgba(240,235,225,0.5)', maxWidth: '18rem' }}
                >
                  Move dogs out of kennels and into living rooms while they wait.
                </p>
              </div>
              <Link
                href="/signup?role=shelter"
                className="inline-flex items-center gap-1.5 self-start px-5 py-2.5 rounded-full text-sm font-medium transition-opacity hover:opacity-85"
                style={{ backgroundColor: '#6f8a5e', color: '#e8f0e5' }}
              >
                List your dogs <span aria-hidden="true">→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

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
                className="inline-flex items-center gap-2 text-sm font-semibold mb-4"
                style={{ color: '#f0ebe1' }}
              >
                <PawPrint className="h-[18px] w-[18px]" style={{ color: '#c97a7a' }} aria-hidden="true" />
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
