import Link from 'next/link'
import Image from 'next/image'
import { PawPrint, Heart, Search, CheckCircle, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PublicFooter } from '@/components/public-footer'

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

// How-It-Works step definitions. Accent maps to a tint pair: the top
// strip uses the solid token; the icon tile uses the /10 opacity variant
// so each card reads as a coordinated block of color without shouting.
type StepAccent = 'warm' | 'sage' | 'primary'
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
    accent: 'sage',
  },
  {
    title: 'Dogs find homes',
    body: 'Shelters review foster history and ratings, accept the best match, and coordinate every step via in-app messaging.',
    Icon: CheckCircle,
    accent: 'primary',
  },
]

const ACCENT_CLASSES: Record<StepAccent, { strip: string; tile: string; icon: string; dot: string }> = {
  warm:    { strip: 'bg-warm',           tile: 'bg-warm/10',          icon: 'text-warm-foreground',    dot: 'bg-warm' },
  sage:    { strip: 'bg-chart-2/70',     tile: 'bg-chart-2/10',       icon: 'text-chart-2',            dot: 'bg-chart-2/80' },
  primary: { strip: 'bg-primary',        tile: 'bg-primary/10',       icon: 'text-primary',            dot: 'bg-primary' },
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
