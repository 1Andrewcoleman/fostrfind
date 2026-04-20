import Link from 'next/link'
import Image from 'next/image'
import { PawPrint, Heart, Search, CheckCircle, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Curated editorial dog portrait from Unsplash. Hostname is allowlisted in
// next.config.mjs. This particular photo is also used in scripts/seed.ts
// for a seeded dog, so it's proven stable.
const HERO_IMAGE_SRC =
  'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1200&q=80'

// Placeholder social-proof numbers. They're labeled as pilot-network figures
// below the stats grid so they don't read as fabricated analytics. Real
// numbers arrive with the Analytics integration (Remaining Items).
const STATS = [
  { value: '2,400+', label: 'Dogs fostered' },
  { value: '180+', label: 'Partner shelters' },
  { value: '4.9', label: 'Avg foster rating', prefix: '★' },
] as const

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* -------------------------------------------------------------- */}
      {/* Top nav                                                         */}
      {/* -------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-display font-extrabold text-lg tracking-tight">
            <PawPrint className="h-6 w-6 text-warm" aria-hidden="true" />
            Fostr Fix
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

      {/* -------------------------------------------------------------- */}
      {/* Hero                                                            */}
      {/* -------------------------------------------------------------- */}
      <section className="relative overflow-hidden">
        {/* Layered warm washes — decorative, aria-hidden. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 -left-24 h-[32rem] w-[32rem] rounded-full bg-warm/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl"
        />
        {/* Subtle film-grain overlay for editorial depth. */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.035] mix-blend-multiply"
        >
          <filter id="landing-hero-grain">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" />
            <feColorMatrix type="saturate" values="0" />
          </filter>
          <rect width="100%" height="100%" filter="url(#landing-hero-grain)" />
        </svg>

        <div className="container mx-auto px-4 py-20 md:py-28 lg:py-32 relative">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Text column */}
            <div className="lg:col-span-7 max-w-2xl">
              <div
                className="inline-flex items-center gap-2 rounded-full border border-warm/40 bg-warm/10 px-3 py-1 text-xs font-medium text-warm-foreground animate-in fade-in slide-in-from-bottom-3 duration-500 [animation-fill-mode:both] motion-reduce:animate-none"
              >
                <span
                  aria-hidden="true"
                  className="relative inline-flex h-1.5 w-1.5"
                >
                  <span className="absolute inline-flex h-full w-full rounded-full bg-warm opacity-70 animate-ping motion-reduce:animate-none" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warm" />
                </span>
                Open for new fosters
              </div>

              <h1 className="mt-6 font-display font-extrabold tracking-[-0.03em] leading-[0.95] text-5xl md:text-6xl lg:text-7xl animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 [animation-fill-mode:both] motion-reduce:animate-none">
                Find a foster.
                <br />
                <span className="italic text-primary">Save a life.</span>
              </h1>

              <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 [animation-fill-mode:both] motion-reduce:animate-none">
                Fostr Fix connects animal shelters with compassionate foster families — giving
                dogs the temporary homes they need while they wait for their forever family.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 [animation-fill-mode:both] motion-reduce:animate-none">
                <Button size="lg" asChild>
                  <Link href="/signup?role=shelter">I&apos;m a shelter</Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="border-2 border-primary/30 hover:border-primary hover:bg-primary/5"
                >
                  <Link href="/signup?role=foster">I&apos;m a foster parent</Link>
                </Button>
              </div>
            </div>

            {/* Image column */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto w-full max-w-md lg:max-w-none animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 [animation-fill-mode:both] motion-reduce:animate-none">
                {/* Offset warm panel — editorial magazine motif. */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 translate-x-4 translate-y-4 sm:translate-x-5 sm:translate-y-5 rounded-[1.5rem] bg-warm/25"
                />
                {/* Photo frame */}
                <div className="relative rounded-[1.5rem] overflow-hidden shadow-xl ring-1 ring-black/5 bg-muted">
                  <Image
                    src={HERO_IMAGE_SRC}
                    alt="A foster parent resting at home with a rescued husky mix"
                    width={800}
                    height={1000}
                    sizes="(max-width: 1024px) 90vw, 40vw"
                    priority
                    className="block h-auto w-full aspect-[4/5] object-cover"
                  />
                </div>
                {/* Floating rating card */}
                <div
                  className="absolute -bottom-4 left-4 sm:left-6 bg-card border border-border/70 rounded-xl shadow-lg px-3 py-2 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-500 [animation-fill-mode:both] motion-reduce:animate-none"
                  role="figure"
                  aria-label="4.9 out of 5 average foster rating"
                >
                  <div className="flex items-center gap-0.5" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <Star key={i} className="h-3.5 w-3.5 text-warm fill-warm" />
                    ))}
                  </div>
                  <div className="text-xs leading-tight">
                    <div className="font-semibold text-foreground">4.9 rating</div>
                    <div className="text-muted-foreground">from foster parents</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* Social-proof stats bar                                          */}
      {/* -------------------------------------------------------------- */}
      <section className="border-y border-border/60 bg-muted/40">
        <div className="container mx-auto px-4 py-10">
          <dl className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6 max-w-4xl mx-auto text-center">
            {STATS.map((stat) => (
              <div key={stat.label} className="flex flex-col items-center gap-1">
                <dt className="order-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  {stat.label}
                </dt>
                <dd className="order-1 font-display font-extrabold text-4xl md:text-5xl text-foreground tracking-tight">
                  {'prefix' in stat && stat.prefix ? (
                    <span className="text-warm mr-1" aria-hidden="true">
                      {stat.prefix}
                    </span>
                  ) : null}
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-center text-xs text-muted-foreground">
            Based on our pilot network of early partner shelters.
          </p>
        </div>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* How it works                                                    */}
      {/* -------------------------------------------------------------- */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-display font-bold text-center mb-12">How it works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Heart className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">1. Shelters list dogs</h3>
              <p className="text-sm text-muted-foreground">
                Rescue organizations post dogs who need temporary foster homes, with full profiles
                and photos.
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">{'2. Fosters browse & apply'}</h3>
              <p className="text-sm text-muted-foreground">
                Foster parents search by location, size, age, and temperament — then apply with a
                personal note.
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">3. Dogs find homes</h3>
              <p className="text-sm text-muted-foreground">
                Shelters review foster history and ratings, accept the best match, and coordinate
                via in-app messaging.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* Footer (Step 38 redesign is a separate commit)                  */}
      {/* -------------------------------------------------------------- */}
      <footer className="border-t py-6 text-sm text-muted-foreground">
        <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>&copy; {new Date().getFullYear()} Fostr Fix. Built with love for dogs.</span>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
