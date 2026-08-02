'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PawPrint } from 'lucide-react'
import { SUPPORT_EMAIL } from '@/lib/constants'
import { HowItWorks } from '@/components/landing/how-it-works'
import { CtaBand } from '@/components/landing/cta-band'
import { WaitlistForm, type WaitlistRole } from '@/components/landing/waitlist-form'
import { WaitlistThanks } from '@/components/landing/waitlist-thanks'

// Waitlist landing (WAITLIST_MODE) — temporary pre-launch swap of the
// signup landing. Same dark editorial shell as `src/app/page.tsx`; instead
// of "Sign up", visitors join a waitlist ("Opening Late Fall 2026").
//
// Two views, one route: the form flow (hero/form + how-it-works + CTA
// band) and the thank-you view after submit. Role + step live here so the
// CTA band panels and footer links can preselect a role, jump the form to
// step 2, and smooth-scroll to it.

/** Sticky-nav height — smooth scroll target offset for the form section. */
const NAV_HEIGHT = 72

function scrollToForm() {
  const el = document.getElementById('waitlist-form')
  if (!el) return
  window.scrollTo({
    top: el.getBoundingClientRect().top + window.scrollY - NAV_HEIGHT,
    behavior: 'smooth',
  })
}

export function WaitlistLanding() {
  const [view, setView] = useState<'form' | 'done'>('form')
  const [role, setRole] = useState<WaitlistRole>('foster')
  const [step, setStep] = useState<1 | 2 | 3>(1)

  // CTA band / footer entry points: preselect the role, jump to the
  // basics step, and scroll to the form. The 50ms delay lets the form
  // view mount first when arriving from the thank-you screen.
  const joinAs = (nextRole: WaitlistRole) => {
    setView('form')
    setRole(nextRole)
    setStep(2)
    setTimeout(scrollToForm, 50)
  }

  const year = new Date().getFullYear()

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: '#1c1a16', color: '#f0ebe1' }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* Nav — same shell as the signup landing; auth links replaced by the */}
      {/* launch chip + a scroll-to-form button (chip only on the thank-you). */}
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

          <nav className="flex items-center gap-3" aria-label="Site navigation">
            <span
              className="text-xs font-medium tracking-[0.04em] rounded-full px-3.5 py-1.5"
              style={{
                color: '#c9a55f',
                border: '1px solid rgba(201,165,95,0.35)',
              }}
            >
              Opening Late Fall 2026
            </span>
            {view === 'form' && (
              <button
                type="button"
                onClick={scrollToForm}
                className="px-4 py-2 text-sm font-medium rounded-full transition-opacity hover:opacity-85"
                style={{ backgroundColor: '#f0ebe1', color: '#1c1a16' }}
              >
                Join the waitlist
              </button>
            )}
          </nav>
        </div>
      </header>

      {view === 'form' ? (
        <main>
          <WaitlistForm
            role={role}
            step={step}
            onPickRole={(picked) => {
              setRole(picked)
              setStep(2)
            }}
            onStepChange={setStep}
            onSuccess={() => setView('done')}
          />
          <HowItWorks />
          <CtaBand
            waitlist={{
              onJoinFoster: () => joinAs('foster'),
              onJoinShelter: () => joinAs('shelter'),
            }}
          />
        </main>
      ) : (
        <main>
          <WaitlistThanks
            onBackHome={() => {
              setView('form')
              setStep(1)
              window.scrollTo({ top: 0, behavior: 'auto' })
            }}
          />
        </main>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Footer — same structure as the signup landing; the Platform column */}
      {/* swaps auth links for waitlist entry points and a "soon" tag.        */}
      {/* ------------------------------------------------------------------ */}
      <footer
        className="mt-auto px-6 md:px-20 pt-14 pb-8"
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

            {/* Platform — waitlist variant */}
            <FooterColumn title="Platform">
              <li>
                <span style={{ color: '#8a8478' }}>
                  Browse dogs{' '}
                  <span
                    className="text-[10px] rounded-full ml-1"
                    style={{
                      color: '#c9a55f',
                      border: '1px solid rgba(201,165,95,0.35)',
                      padding: '1px 7px',
                    }}
                  >
                    soon
                  </span>
                </span>
              </li>
              <li>
                <FooterActionButton onClick={() => joinAs('shelter')}>
                  For shelters — join the waitlist
                </FooterActionButton>
              </li>
              <li>
                <FooterActionButton onClick={() => joinAs('foster')}>
                  For fosters — join the waitlist
                </FooterActionButton>
              </li>
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

// Plain-button footer entry that matches FooterLink styling — colors live
// in classes (not inline style) so the hover variant can apply.
function FooterActionButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left text-sm text-[#c8c2b4] transition-colors hover:text-[#f0ebe1]"
    >
      {children}
    </button>
  )
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  const cls = 'transition-colors text-[#c8c2b4] hover:text-[#f0ebe1] inline-block'

  if (href.startsWith('mailto:') || href.startsWith('http')) {
    return (
      <li>
        <a href={href} className={cls}>
          {children}
        </a>
      </li>
    )
  }

  return (
    <li>
      <Link href={href} className={cls}>
        {children}
      </Link>
    </li>
  )
}
