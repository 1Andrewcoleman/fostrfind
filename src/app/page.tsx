// Trust-signal stance: **no placeholder metrics, ever.** See
// `.impeccable.md` — until real analytics land, the How-It-Works section
// is the landing page's sole trust signal. Do NOT add a "2,400+ dogs
// fostered" band, a 4.9-star rating card, or any invented social proof.
// Specificity of the product flow reads as legitimacy; invented numbers
// read as a pitch deck. When true analytics exist, add them back here
// with the data source labeled in the copy.

import Link from 'next/link'
import Image from 'next/image'
import { PawPrint, Heart, Search, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PublicFooter } from '@/components/public-footer'

// Curated editorial dog portrait from Unsplash. Hostname is allowlisted in
// next.config.mjs. This particular photo is also used in scripts/seed.ts
// for a seeded dog, so it's proven stable.
const HERO_IMAGE_SRC =
  'https://images.unsplash.com/photo-1583337130417-3346a1be7dee?auto=format&fit=crop&w=1200&q=80'

// How-It-Works step definitions. Accent maps to a tint pair: the top
// strip uses the solid token; the icon tile uses the /10 opacity variant
// so each card reads as a coordinated block of color without shouting.
// Accent is a role-token from the tri-pastel palette (see `.impeccable.md`).
// Commit 4 will re-map these to the canonical product meanings
// (peach = shelter, butter/primary = foster, sage/warm = placement); for now
// the goal of Commit 1 is only to stop referencing the dropped chart tokens.
type StepAccent = 'warm' | 'peach' | 'primary'
interface HowItWorksStep {
  title: string
  body: string
  Icon: typeof Heart
  accent: StepAccent
}
const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    title: 'Shelters list dogs',
    body: 'Rescue organizations post dogs who need temporary foster homes with full profiles, photos, and medical details.',
    Icon: Heart,
    accent: 'warm',
  },
  {
    title: 'Fosters browse & apply',
    body: 'Foster parents search by location, size, age, and temperament — then apply with a personal note.',
    Icon: Search,
    accent: 'peach',
  },
  {
    title: 'Dogs find homes',
    body: 'Shelters review foster history and ratings, accept the best match, and coordinate every step via in-app messaging.',
    Icon: CheckCircle,
    accent: 'primary',
  },
]

const ACCENT_CLASSES: Record<StepAccent, { strip: string; tile: string; icon: string; dot: string }> = {
  warm:    { strip: 'bg-warm',    tile: 'bg-warm/15',    icon: 'text-foreground', dot: 'bg-warm' },
  peach:   { strip: 'bg-peach',   tile: 'bg-peach/15',   icon: 'text-foreground', dot: 'bg-peach' },
  primary: { strip: 'bg-primary', tile: 'bg-primary/15', icon: 'text-foreground', dot: 'bg-primary' },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* -------------------------------------------------------------- */}
      {/* Top nav                                                         */}
      {/* -------------------------------------------------------------- */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-display font-extrabold text-lg tracking-tight">
            <PawPrint className="h-6 w-6 text-primary" aria-hidden="true" />
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
      {/* Calmer than the pre-redesign hero (see Phase 5-b Commit 3).
       * Grain overlay removed, italic serif accent dropped, decorative
       * washes softened to one butter radial tied to the photo corner.
       * The two CTAs now present as paired doors: peach for shelter,
       * butter for foster, weighted equally. */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-32 -right-32 h-[32rem] w-[32rem] rounded-full bg-primary/15 blur-3xl"
        />

        <div className="container mx-auto px-4 py-20 md:py-28 lg:py-32 relative">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Text column */}
            <div className="lg:col-span-7 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-warm/40 bg-warm/15 px-3 py-1 text-xs font-medium tracking-wide text-foreground/80 animate-in fade-in slide-in-from-bottom-3 duration-500 [animation-fill-mode:both] motion-reduce:animate-none">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-warm" />
                Open for new fosters
              </div>

              <h1 className="mt-6 font-display font-semibold tracking-[-0.02em] leading-[1.02] text-5xl md:text-6xl lg:text-[4.5rem] animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100 [animation-fill-mode:both] motion-reduce:animate-none">
                Find a foster.
                <br />
                Save a life.
              </h1>

              <p className="mt-6 max-w-xl text-lg text-muted-foreground leading-relaxed animate-in fade-in slide-in-from-bottom-4 duration-500 delay-200 [animation-fill-mode:both] motion-reduce:animate-none">
                Fostr Fix connects animal shelters with compassionate foster families — giving
                dogs the temporary homes they need while they wait for their forever family.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-3 max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300 [animation-fill-mode:both] motion-reduce:animate-none">
                <Button
                  size="lg"
                  asChild
                  className="h-12 flex-1 bg-peach text-foreground hover:bg-peach/85 shadow-sm"
                >
                  <Link href="/signup?role=shelter">I&apos;m a shelter</Link>
                </Button>
                <Button size="lg" asChild className="h-12 flex-1 shadow-sm">
                  <Link href="/signup?role=foster">I&apos;m a foster parent</Link>
                </Button>
              </div>
            </div>

            {/* Image column */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto w-full max-w-md lg:max-w-none animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200 [animation-fill-mode:both] motion-reduce:animate-none">
                {/* Offset butter panel — editorial magazine motif, low alpha */}
                <div
                  aria-hidden="true"
                  className="absolute inset-0 translate-x-4 translate-y-4 sm:translate-x-5 sm:translate-y-5 rounded-[1.5rem] bg-primary/25"
                />
                <div className="relative rounded-[1.5rem] overflow-hidden shadow-xl ring-1 ring-foreground/[0.04] bg-muted">
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
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- */}
      {/* How it works                                                    */}
      {/* -------------------------------------------------------------- */}
      <section id="how-it-works" className="py-20 md:py-24 px-4 bg-background scroll-mt-20">
        <div className="container mx-auto max-w-6xl">
          <div className="max-w-2xl mx-auto text-center mb-14">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warm-foreground">
              The flow
            </p>
            <h2 className="mt-3 font-display text-3xl md:text-4xl font-extrabold tracking-tight">
              How it works
            </h2>
            <p className="mt-3 text-muted-foreground">
              Three steps from listing to placement — with fewer handoffs and more warmth at every
              stage.
            </p>
          </div>

          <ol className="grid md:grid-cols-3 gap-6">
            {HOW_IT_WORKS_STEPS.map((step, index) => {
              const accent = ACCENT_CLASSES[step.accent]
              const Icon = step.Icon
              return (
                <li
                  key={step.title}
                  className="relative overflow-hidden rounded-[1.25rem] border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-fill-mode:both] motion-reduce:animate-none"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  {/* Top accent strip */}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 top-0 block h-1.5 ${accent.strip}`}
                  />

                  {/* Decorative watermark number */}
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-3 right-5 font-display font-extrabold text-[7rem] leading-none text-foreground/[0.05] select-none"
                  >
                    {index + 1}
                  </span>

                  <div className="relative p-7 pt-8">
                    <div className="flex items-start justify-between gap-4">
                      <div className={`relative inline-flex h-12 w-12 items-center justify-center rounded-2xl ${accent.tile}`}>
                        <Icon className={`h-6 w-6 ${accent.icon}`} aria-hidden="true" />
                        <span
                          aria-hidden="true"
                          className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ring-2 ring-card ${accent.dot}`}
                        />
                      </div>
                      <span className="font-display font-bold text-sm text-muted-foreground">
                        Step {index + 1}
                      </span>
                    </div>

                    <h3 className="mt-5 font-display font-bold text-xl tracking-tight">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      <PublicFooter />
    </div>
  )
}
