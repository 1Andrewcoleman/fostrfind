'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface HeroProps {
  headline: string
  subcopy: string
}

export function Hero({ headline, subcopy }: HeroProps) {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <section className="relative overflow-hidden bg-background" style={{ height: 920 }}>
      {/* Hero image */}
      <div className="absolute inset-0">
        <Image
          src="https://images.unsplash.com/photo-1530281700549-e82e7bf110d6?auto=format&fit=crop&w=1600&q=80"
          alt="Foster family with rescued dog"
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
      </div>

      {/* Gradient overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,.30) 0%, rgba(0,0,0,.10) 30%, rgba(0,0,0,.55) 100%)',
        }}
      />

      {/* Nav placeholder - will be handled by page.tsx header */}

      {/* Content */}
      <div
        className="absolute left-20 bottom-20 max-w-3xl z-10"
        style={{
          opacity: loaded ? 1 : 0,
          transform: loaded ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
        }}
      >
        {/* Available badge */}
        <div
          className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/94 shadow-lg mb-7"
          style={{ transform: 'rotate(-1.5deg)' }}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-warm opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-warm" />
          </span>
          <span className="text-xs font-medium tracking-wider uppercase text-foreground">
            We&apos;re new here — come help build it
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-[124px] leading-[0.92] text-white mb-6 max-w-3xl">
          {headline}
        </h1>

        {/* Subcopy */}
        <p className="text-lg leading-relaxed text-white/94 max-w-xl mb-10">{subcopy}</p>

        {/* CTAs */}
        <div className="flex gap-3.5 flex-wrap">
          <Link
            href="/signup?role=foster"
            className="inline-flex items-center justify-center px-7 py-4 text-[15.5px] font-medium rounded-full bg-primary text-foreground shadow-xl transition-transform hover:-translate-y-0.5"
          >
            I&apos;m a foster parent &nbsp;→
          </Link>
          <Link
            href="/signup?role=shelter"
            className="inline-flex items-center justify-center px-7 py-4 text-[15.5px] font-medium rounded-full bg-warm text-foreground shadow-xl transition-transform hover:-translate-y-0.5"
          >
            I run a shelter &nbsp;→
          </Link>
        </div>
      </div>
    </section>
  )
}
