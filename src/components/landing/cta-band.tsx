'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

interface DoorProps {
  tone: 'primary' | 'warm'
  tag: string
  headline: string
  body: string
  cta: string
  href: string
}

function BigDoor({ tone, tag, headline, body, cta, href }: DoorProps) {
  const toneClasses = {
    primary: {
      bg: 'bg-primary/10',
      border: 'border-primary/20',
      accent: 'text-primary',
      button: 'bg-primary text-foreground hover:bg-primary/85',
    },
    warm: {
      bg: 'bg-warm/10',
      border: 'border-warm/20',
      accent: 'text-warm',
      button: 'bg-warm text-foreground hover:bg-warm/85',
    },
  }

  const classes = toneClasses[tone]

  return (
    <div
      className={`${classes.bg} ${classes.border} border-2 rounded-3xl p-10 transition-transform duration-200 hover:-translate-y-1`}
    >
      <div className={`text-xs font-medium tracking-[0.14em] uppercase ${classes.accent} mb-3`}>
        {tag}
      </div>
      <h3 className="font-display text-4xl leading-tight text-foreground mb-4">{headline}</h3>
      <p className="text-muted-foreground leading-relaxed mb-8 max-w-md">{body}</p>
      <Link
        href={href}
        className={`inline-flex items-center justify-center px-6 py-3 text-sm font-medium rounded-full ${classes.button} transition-transform hover:-translate-y-0.5 shadow-sm`}
      >
        {cta}
      </Link>
    </div>
  )
}

export function CTABand() {
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
      className="py-32 px-20 bg-muted/40 border-t border-border relative overflow-hidden"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: 'opacity 0.8s ease-out, transform 0.8s ease-out',
      }}
    >
      {/* Header */}
      <header className="text-center mb-16">
        <h2 className="font-display text-[76px] leading-none text-foreground mb-5">
          Pick your <em className="italic text-primary">side</em> of the leash.
        </h2>
        <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
          We&apos;re just opening doors. Walk through one — we&apos;ll meet you on the other side.
        </p>
      </header>

      {/* Doors grid */}
      <div className="grid grid-cols-2 gap-7 max-w-6xl mx-auto">
        <BigDoor
          tone="primary"
          tag="For foster families"
          headline="Open your home."
          body="A weekend, a month, until forever finds them. You decide the chapter."
          cta="Become a foster"
          href="/signup?role=foster"
        />
        <BigDoor
          tone="warm"
          tag="For shelters"
          headline="Find them a soft landing."
          body="Move dogs out of kennels and into living rooms while they wait."
          cta="List your dogs"
          href="/signup?role=shelter"
        />
      </div>
    </section>
  )
}
