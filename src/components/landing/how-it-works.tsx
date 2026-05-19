'use client'

import { useEffect, useRef, useState } from 'react'
import { Heart, Search, Home } from 'lucide-react'

// How It Works — three numbered steps. Whole section fades + slides up the
// first time it scrolls into view (Intersection Observer, single-fire).
// Cards lift on hover.
export function HowItWorks() {
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
      id="how-it-works"
      className="px-6 md:px-20 py-20 md:py-28 scroll-mt-16"
      style={{
        backgroundColor: '#25221c',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.8s ease-out, transform 0.8s ease-out',
      }}
      aria-labelledby="hiw-heading"
    >
      <div className="mx-auto" style={{ maxWidth: '1440px' }}>
        {/* Section eyebrow — line + label */}
        <div className="flex items-center gap-3 mb-10">
          <span
            className="block h-px w-8"
            style={{ backgroundColor: '#8a8478' }}
            aria-hidden="true"
          />
          <span
            className="text-[13px] font-semibold uppercase tracking-[0.2em]"
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
              fontSize: 'clamp(2.5rem, 5.5vw, 4rem)',
              letterSpacing: '-0.02em',
              color: '#f0ebe1',
            }}
          >
            From shelter{' '}
            <em style={{ color: '#c97a7a', fontStyle: 'italic' }}>to sofa</em>
            <br />in three steps.
          </h2>
          <p
            className="lg:pt-4 text-sm md:text-[15px] leading-relaxed"
            style={{ color: '#c8c2b4', maxWidth: '26rem' }}
          >
            No spreadsheets, group chats, or crossed wires. Fostr Find brings the whole
            journey into one calm, friendly place — so the dog gets home faster.
          </p>
        </div>

        {/* Step cards */}
        <ol className="grid md:grid-cols-3 gap-4">
          {/* Step 1 — shelters; watermark "1" in background */}
          <li
            className="relative rounded-[18px] p-6 overflow-hidden transition-transform duration-200 hover:-translate-y-1"
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
              1
            </span>
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
            className="relative rounded-[18px] p-6 overflow-hidden transition-transform duration-200 hover:-translate-y-1"
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

          {/* Step 3 — together; watermark "3" in background */}
          <li
            className="relative rounded-[18px] p-6 overflow-hidden transition-transform duration-200 hover:-translate-y-1"
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
              3
            </span>
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
  )
}
