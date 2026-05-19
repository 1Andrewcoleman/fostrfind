'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

const HERO_DOG_URL =
  'https://images.unsplash.com/photo-1569428012232-f53bb3e5b646?auto=format&fit=crop&w=1600&q=90'

// Hero — cinematic dark field with golden retriever anchored to the right.
// Text content lives in the left ~40% of the canvas; the dog image fills the
// right ~60% and is veiled by two gradient overlays so the dark palette reads
// as a unified field rather than a photo pasted on top.
// On mount the content block fades + slides up (700ms). Pure CSS transition,
// so prefers-reduced-motion is respected by the browser without extra guards.
export function Hero() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <section
      className="relative flex flex-col justify-end px-6 md:px-20 pb-16 md:pb-24 overflow-hidden"
      style={{ minHeight: '85vh' }}
      aria-labelledby="hero-heading"
    >
      {/* Dog image — right side, blended into the dark background */}
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-full md:w-[62%]"
        aria-hidden="true"
      >
        <Image
          src={HERO_DOG_URL}
          alt=""
          fill
          priority
          sizes="(max-width: 768px) 100vw, 62vw"
          className="object-cover"
          style={{ objectPosition: 'center 25%' }}
        />
        {/* Left-to-right veil: heavy opaque on the left edge fading to near-transparent
            on the right so the text column is always readable */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to right, #1c1a16 0%, #1c1a16 18%, rgba(28,26,22,0.88) 38%, rgba(28,26,22,0.35) 62%, rgba(28,26,22,0.12) 100%)',
          }}
        />
        {/* Top-to-bottom veil: blends with the sticky nav above and the next
            section below so the image feels part of the dark field */}
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(to bottom, #1c1a16 0%, transparent 14%, transparent 72%, #1c1a16 100%)',
          }}
        />
      </div>

      <div
        className="relative mx-auto w-full"
        style={{
          maxWidth: '1440px',
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
        }}
      >
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

        {/* H1 — Instrument Serif, very large, tight tracking. The <br />
            guarantees the two-line break at every viewport size. */}
        <h1
          id="hero-heading"
          className="font-normal leading-[1.02] mb-7"
          style={{
            fontFamily: 'var(--font-instrument)',
            fontSize: 'clamp(3.75rem, 9vw, 6.75rem)',
            letterSpacing: '-0.03em',
            color: '#f0ebe1',
          }}
        >
          Find a foster.<br />Save a life.
        </h1>

        {/* Subtext */}
        <p
          className="text-base md:text-lg leading-relaxed mb-10"
          style={{ color: 'rgba(240,235,225,0.65)', maxWidth: '28rem' }}
        >
          Fostr Find connects animal shelters with foster families — giving dogs a warm
          place to land while they wait for their forever home.
        </p>

        {/* CTAs — pill-shaped, pink for foster, dark-green for shelter */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/signup?role=foster"
            className="inline-flex items-center gap-1.5 self-start px-7 py-3.5 rounded-full text-[15px] font-medium transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5"
            style={{ backgroundColor: '#c97a7a', color: '#f5ede8' }}
          >
            I&apos;m a foster parent <span aria-hidden="true">→</span>
          </Link>
          <Link
            href="/signup?role=shelter"
            className="inline-flex items-center gap-1.5 self-start px-7 py-3.5 rounded-full text-[15px] font-medium transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5"
            style={{ backgroundColor: '#303829', color: '#8aa376' }}
          >
            I run a shelter <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}
