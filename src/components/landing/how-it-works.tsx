'use client'

import { useEffect, useRef, useState } from 'react'
import { Heart, Search, CheckCircle, type LucideIcon } from 'lucide-react'

interface Step {
  n: string
  who: string
  title: string
  body: string
  icon: LucideIcon
  accent: 'primary' | 'warm' | 'peach'
}

const STEPS: Step[] = [
  {
    n: '01',
    who: 'Shelters',
    title: 'List dogs who need homes',
    body: 'Post full profiles with photos, temperament, and medical details. Each listing reaches fosters in your area instantly.',
    icon: Heart,
    accent: 'peach',
  },
  {
    n: '02',
    who: 'Fosters',
    title: 'Browse and apply',
    body: 'Search by size, age, needs, and location. Apply with a personal note explaining why you're the right match.',
    icon: Search,
    accent: 'primary',
  },
  {
    n: '03',
    who: 'Together',
    title: 'Dog finds a sofa',
    body: 'Shelter reviews applications, accepts the best fit, and coordinates pickup. All messaging happens in-app.',
    icon: CheckCircle,
    accent: 'warm',
  },
]

const ACCENT_CLASSES: Record<
  'primary' | 'warm' | 'peach',
  { strip: string; tile: string; soft: string }
> = {
  primary: {
    strip: 'bg-primary',
    tile: 'bg-primary/20',
    soft: 'text-primary/30',
  },
  warm: {
    strip: 'bg-warm',
    tile: 'bg-warm/20',
    soft: 'text-warm/30',
  },
  peach: {
    strip: 'bg-peach',
    tile: 'bg-peach/20',
    soft: 'text-peach/40',
  },
}

export function HowItWorks() {
  const [visible, setVisible] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const observerOptions = {
      threshold: 0.15,
      rootMargin: '0px 0px -100px 0px',
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.unobserve(entry.target)
        }
      })
    }, observerOptions)

    if (sectionRef.current) {
      observer.observe(sectionRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      id="how-it-works"
      className="py-32 px-20 bg-background scroll-mt-20"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.8s ease-out, transform 0.8s ease-out',
      }}
    >
      {/* Header */}
      <header className="grid grid-cols-[1.2fr_1fr] gap-14 items-end mb-20">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <span className="inline-block w-7 h-px bg-muted-foreground" />
            <span className="text-xs font-medium tracking-[0.18em] uppercase text-muted-foreground">
              How it works
            </span>
          </div>
          <h2 className="font-display text-[84px] leading-[1.0] text-foreground max-w-3xl">
            From shelter <em className="italic text-primary">to sofa</em>
            <br />
            in three steps.
          </h2>
        </div>
        <p className="text-[17px] leading-relaxed text-muted-foreground max-w-lg">
          No spreadsheets, group chats, or crossed wires. Fostr Find brings the whole journey into
          one calm, friendly place — so the dog gets home faster.
        </p>
      </header>

      {/* Steps grid */}
      <div className="grid grid-cols-3 gap-8 relative">
        {STEPS.map((step) => {
          const Icon = step.icon
          const accent = ACCENT_CLASSES[step.accent]

          return (
            <article
              key={step.n}
              className="relative p-10 bg-card rounded-2xl border border-border overflow-hidden min-h-[360px] transition-transform duration-200 hover:-translate-y-1"
            >
              {/* Top accent strip */}
              <div className={`absolute inset-x-0 top-0 h-1 ${accent.strip}`} />

              {/* Background number */}
              <div
                className={`absolute -right-3 -bottom-16 font-display text-[280px] leading-[0.8] pointer-events-none select-none ${accent.soft}`}
              >
                {step.n.replace(/^0/, '')}
              </div>

              {/* Content */}
              <div className="relative">
                {/* Icon tile */}
                <div
                  className={`w-11 h-11 rounded-xl ${accent.tile} flex items-center justify-center mb-6`}
                >
                  <Icon className="w-5 h-5 text-foreground" />
                </div>

                {/* Who */}
                <div className={`text-xs font-medium tracking-[0.14em] uppercase mb-3`}>
                  <span className={accent.strip.replace('bg-', 'text-')}>{step.who}</span>
                </div>

                {/* Title */}
                <h3 className="font-display text-[30px] leading-tight text-foreground mb-3">
                  {step.title}
                </h3>

                {/* Body */}
                <p className="text-[15px] leading-relaxed text-muted-foreground max-w-xs">
                  {step.body}
                </p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
