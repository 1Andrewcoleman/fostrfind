import Link from 'next/link'
import { PawPrint, Heart, Search, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Nav */}
      <header className="border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-lg">
            <PawPrint className="h-6 w-6" />
            Fostr Fix
          </div>
          <div className="flex gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Sign Up</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-4 py-24 bg-gradient-to-b from-background to-muted">
        <div className="mb-6 rounded-full bg-primary/10 p-4 inline-flex">
          <PawPrint className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4">
          Find a Foster.
          <br />
          <span className="text-primary">Save a Life.</span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mb-8">
          Fostr Fix connects animal shelters with compassionate foster parents — giving dogs
          the temporary homes they need while waiting for their forever family.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button size="lg" asChild>
            <Link href="/signup?role=shelter">I&apos;m a Shelter</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/signup?role=foster">I&apos;m a Foster Parent</Link>
          </Button>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4 bg-background">
        <div className="container mx-auto max-w-4xl">
          <h2 className="text-3xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Heart className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">1. Shelters List Dogs</h3>
              <p className="text-sm text-muted-foreground">
                Rescue organizations post dogs who need temporary foster homes, with full profiles
                and photos.
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Search className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">2. Fosters Browse &amp; Apply</h3>
              <p className="text-sm text-muted-foreground">
                Foster parents search by location, size, age, and temperament — then apply with a
                personal note.
              </p>
            </div>

            <div className="text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg">3. Dogs Find Homes</h3>
              <p className="text-sm text-muted-foreground">
                Shelters review foster history and ratings, accept the best match, and coordinate
                via in-app messaging.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} Fostr Fix. Built with love for dogs.
      </footer>
    </div>
  )
}
