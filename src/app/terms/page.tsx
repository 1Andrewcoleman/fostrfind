import type { Metadata } from 'next'
import Link from 'next/link'
import { PawPrint } from 'lucide-react'
import { PublicFooter } from '@/components/public-footer'

export const metadata: Metadata = {
  title: 'Terms of Service | Fostr Fix',
  description:
    'The terms that govern your use of Fostr Fix as a foster parent or shelter partner.',
}

// Effective date is baked into the page so the history is legible without
// a CMS. Update this constant (and add a changelog entry at the bottom)
// whenever the terms change materially.
const EFFECTIVE_DATE = 'April 19, 2026'

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col bg-muted/20">
      <header className="border-b bg-background">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg">
            <PawPrint className="h-6 w-6" />
            Fostr Fix
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Home
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <article className="container mx-auto max-w-3xl px-4 py-12 prose prose-slate dark:prose-invert">
          <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">
            Terms of Service
          </h1>
          <p className="text-sm text-muted-foreground">
            Effective {EFFECTIVE_DATE}
          </p>

          <p>
            Welcome to Fostr Fix. These Terms of Service (&ldquo;Terms&rdquo;) govern your
            access to and use of the Fostr Fix website, applications, and services
            (together, the &ldquo;Service&rdquo;). By creating an account or using the
            Service you agree to be bound by these Terms.
          </p>

          <h2>1. Who We Are</h2>
          <p>
            Fostr Fix is a platform that connects animal shelters and rescues with
            prospective foster parents. We are a neutral intermediary: we do not own,
            transport, or take custody of any animal listed on the Service.
          </p>

          <h2>2. Eligibility</h2>
          <p>
            You must be at least 18 years old and able to enter into a legally binding
            agreement to use the Service. Shelters must be operating lawfully in their
            jurisdiction.
          </p>

          <h2>3. Accounts</h2>
          <p>
            You are responsible for keeping your credentials confidential and for all
            activity that occurs under your account. Notify us promptly of any
            unauthorized use. You may delete your account at any time from the
            account settings page; deletion is processed as described in our Privacy
            Policy.
          </p>

          <h2>4. Conduct</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Misrepresent your identity, role, or qualifications</li>
            <li>
              Use the Service to harass, defame, or threaten any user, shelter, or
              animal
            </li>
            <li>
              Post false medical or behavioral information about an animal, or omit
              information that is material to a foster&rsquo;s safety decision
            </li>
            <li>
              Scrape, reverse engineer, or otherwise attempt to extract source code
              or user data from the Service
            </li>
            <li>
              Circumvent the Service to solicit adoption fees, donations, or other
              payments outside the platform in a way that violates your agreement
              with the other party
            </li>
          </ul>

          <h2>5. Foster Placements</h2>
          <p>
            Fostr Fix does not make placement decisions. Shelters remain solely
            responsible for evaluating foster applications, transferring custody of
            animals, and complying with applicable animal welfare, veterinary, and
            adoption laws. Foster parents are responsible for the humane care of any
            animal placed in their home.
          </p>

          <h2>6. No Warranty</h2>
          <p>
            The Service is provided &ldquo;as is&rdquo; without warranties of any
            kind. We do not guarantee that any particular shelter or foster
            relationship will result in a successful placement, or that any animal
            description is complete or accurate.
          </p>

          <h2>7. Limitation of Liability</h2>
          <p>
            To the fullest extent permitted by law, Fostr Fix and its operators are
            not liable for any indirect, incidental, consequential, or punitive
            damages arising from your use of the Service, including any injury,
            property damage, or loss arising from a foster placement. Our total
            aggregate liability for any claim is limited to USD $100.
          </p>

          <h2>8. Termination</h2>
          <p>
            We may suspend or terminate your access to the Service at any time if we
            reasonably believe you have violated these Terms, placed an animal at
            risk, or exposed other users to harm.
          </p>

          <h2>9. Changes</h2>
          <p>
            We may update these Terms from time to time. Material changes will be
            announced in-app and/or by email. Your continued use of the Service after
            a change takes effect constitutes acceptance of the updated Terms.
          </p>

          <h2>10. Contact</h2>
          <p>
            Questions about these Terms? Reach us at{' '}
            <a href="mailto:hello@fostrfix.example">hello@fostrfix.example</a>.
          </p>

          <hr />
          <p className="text-sm text-muted-foreground">
            See also our{' '}
            <Link href="/privacy" className="underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </p>
        </article>
      </main>

      <PublicFooter />
    </div>
  )
}
