'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { PawPrint } from 'lucide-react'

// "Pick your side of the leash" — two tinted panels (foster + shelter).
// Whole section fades + slides up on first scroll-in. Panels and buttons
// lift on hover. Each panel has a decorative paw cluster in the top-right
// to fill the empty space next to the short body copy.

interface PawDecorationProps {
  /** Tint color including alpha, e.g. 'rgba(217,154,154,0.25)' */
  color: string
}

// Three staggered paw prints, rotated for a hand-placed feel. Decorative,
// hidden from assistive tech.
function PawDecoration({ color }: PawDecorationProps) {
  return (
    <div
      className="pointer-events-none absolute top-6 right-6 flex items-end gap-1.5"
      aria-hidden="true"
    >
      <PawPrint
        className="h-3.5 w-3.5"
        style={{ color, transform: 'rotate(-12deg)' }}
      />
      <PawPrint
        className="h-[18px] w-[18px]"
        style={{ color, transform: 'rotate(8deg)' }}
      />
      <PawPrint
        className="h-3.5 w-3.5"
        style={{ color, transform: 'rotate(22deg)' }}
      />
    </div>
  )
}

export function CtaBand() {
  const [visible, setVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const node = sectionRef.current
    if (!node) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15, rootMargin: '0px 0px -100px 0px' }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="px-6 md:px-20 py-20 md:py-28"
      style={{
        backgroundColor: '#1c1a16',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.8s ease-out, transform 0.8s ease-out',
      }}
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
            className="relative rounded-[18px] p-8 md:p-10 flex flex-col justify-between transition-transform duration-200 hover:-translate-y-1"
            style={{ backgroundColor: '#4a2f2f', minHeight: '280px' }}
          >
            <PawDecoration color="rgba(217,154,154,0.25)" />
            {/* Caveat-script watermark in the lower-right negative space */}
            <span
              className="pointer-events-none absolute bottom-2 right-6 leading-none select-none"
              style={{
                fontFamily: 'var(--font-caveat)',
                fontSize: 'clamp(5rem, 10vw, 8rem)',
                color: 'rgba(217,154,154,0.12)',
                transform: 'rotate(-4deg)',
                transformOrigin: 'bottom right',
              }}
              aria-hidden="true"
            >
              home
            </span>
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
              className="inline-flex items-center gap-1.5 self-start px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5"
              style={{ backgroundColor: '#c97a7a', color: '#f5ede8' }}
            >
              Become a foster <span aria-hidden="true">→</span>
            </Link>
          </div>

          {/* Shelter — dark green panel */}
          <div
            className="relative rounded-[18px] p-8 md:p-10 flex flex-col justify-between transition-transform duration-200 hover:-translate-y-1"
            style={{ backgroundColor: '#303829', minHeight: '280px' }}
          >
            <PawDecoration color="rgba(138,163,118,0.25)" />
            {/* Caveat-script watermark in the lower-right negative space */}
            <span
              className="pointer-events-none absolute bottom-2 right-6 leading-none select-none whitespace-nowrap"
              style={{
                fontFamily: 'var(--font-caveat)',
                fontSize: 'clamp(4rem, 8vw, 6.5rem)',
                color: 'rgba(138,163,118,0.12)',
                transform: 'rotate(-4deg)',
                transformOrigin: 'bottom right',
              }}
              aria-hidden="true"
            >
              soft landing
            </span>
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
              className="inline-flex items-center gap-1.5 self-start px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5"
              style={{ backgroundColor: '#6f8a5e', color: '#e8f0e5' }}
            >
              List your dogs <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
