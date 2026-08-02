'use client'

import { useEffect, useState } from 'react'

// Thank-you view shown after a successful waitlist signup (WAITLIST_MODE).
// Centered column, fade-up entrance (same CSS-transition pattern as the
// form so reduced-motion is respected), scrolls to top on entry.
// Intentionally spare: no watermark, no icon above the H1.

const NEXT_STEPS: ReadonlyArray<{ numeral: string; color: string; text: string }> = [
  { numeral: '1', color: '#c97a7a', text: 'Your spot is saved — nothing else to do.' },
  { numeral: '2', color: '#c9a55f', text: 'Beta invites go out in waves, in signup order.' },
  { numeral: '3', color: '#6f8a5e', text: 'Doors open Late Fall 2026 — first in line, first through.' },
]

export function WaitlistThanks({ onBackHome }: { onBackHome: () => void }) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
    const timer = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <section
      className="px-6 md:px-20 pt-[120px] pb-32 flex flex-col items-center text-center"
      style={{
        opacity: loaded ? 1 : 0,
        transform: loaded ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
      }}
      aria-labelledby="thanks-heading"
    >
      <div className="flex flex-col items-center" style={{ maxWidth: '620px' }}>
        <h1
          id="thanks-heading"
          className="font-normal mb-5"
          style={{
            fontFamily: 'var(--font-instrument)',
            fontSize: 'clamp(3.25rem, 6vw, 4.5rem)',
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            color: '#f0ebe1',
          }}
        >
          You&apos;re on the list.
        </h1>
        <p
          className="text-[17px] mb-11"
          style={{ lineHeight: 1.65, color: 'rgba(240,235,225,0.65)', maxWidth: '30rem' }}
        >
          Thanks for raising your hand. We&apos;ll send one email when doors open — Late Fall
          2026. Until then, we&apos;ll be building.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 w-full mb-11">
          {NEXT_STEPS.map((item) => (
            <div
              key={item.numeral}
              className="rounded-[14px] p-5 text-left"
              style={{
                backgroundColor: '#25221c',
                border: '1px solid rgba(240,235,225,0.06)',
              }}
            >
              <span
                className="block mb-2"
                style={{
                  fontFamily: 'var(--font-instrument)',
                  fontSize: '22px',
                  color: item.color,
                }}
              >
                {item.numeral}
              </span>
              <p className="text-[13px]" style={{ lineHeight: 1.55, color: '#c8c2b4' }}>
                {item.text}
              </p>
            </div>
          ))}
        </div>
        {/* Ghost button — border/text colors are classes so hover applies. */}
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-1.5 px-6 py-[11px] rounded-full text-sm font-medium bg-transparent border border-[rgba(240,235,225,0.18)] text-[#c8c2b4] transition-all duration-200 hover:border-[rgba(240,235,225,0.4)] hover:text-[#f0ebe1]"
        >
          ← Back to the front page
        </button>
      </div>
    </section>
  )
}
