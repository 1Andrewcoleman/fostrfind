// Trust-signal stance: **no placeholder metrics, ever.** See
// `.impeccable.md` — until real analytics land, the How-It-Works section
// is the landing page's sole trust signal. Do NOT add a "2,400+ dogs
// fostered" band, a 4.9-star rating card, or any invented social proof.
// Specificity of the product flow reads as legitimacy; invented numbers
// read as a pitch deck. When true analytics exist, add them back here
// with the data source labeled in the copy.

import Link from 'next/link'
import { PawPrint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PublicFooter } from '@/components/public-footer'
import { Hero } from '@/components/landing/hero'
import { HowItWorks } from '@/components/landing/how-it-works'
import { CTABand } from '@/components/landing/cta-band'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top nav - sticky */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 font-sans font-bold text-lg tracking-tight"
          >
            <PawPrint className="h-6 w-6 text-primary" aria-hidden="true" />
            Fostr Find
          </Link>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero section with animations */}
      <Hero
        headline="Find a foster. Save a life."
        subcopy="Fostr Find connects animal shelters with foster families — giving dogs a warm place to land while they wait for their forever home."
      />

      {/* How it works with scroll-triggered animation */}
      <HowItWorks />

      {/* CTA band with scroll-triggered animation */}
      <CTABand />

      {/* Footer */}
      <PublicFooter />
    </div>
  )
}
