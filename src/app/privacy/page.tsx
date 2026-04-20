import type { Metadata } from 'next'
import Link from 'next/link'
import { PawPrint } from 'lucide-react'
import { PublicFooter } from '@/components/public-footer'

export const metadata: Metadata = {
  title: 'Privacy Policy | Fostr Fix',
  description:
    'How Fostr Fix collects, uses, and protects personal information belonging to foster parents and shelter partners.',
}

const EFFECTIVE_DATE = 'April 19, 2026'

export default function PrivacyPage() {
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
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">
            Effective {EFFECTIVE_DATE}
          </p>

          <p>
            This Privacy Policy explains what information Fostr Fix collects about
            you, how we use it, and the choices you have. It applies to our website,
            applications, and services (together, the &ldquo;Service&rdquo;).
          </p>

          <h2>1. Information We Collect</h2>
          <ul>
            <li>
              <strong>Account information</strong>: email, password (hashed), and the
              role you select at signup (foster parent or shelter).
            </li>
            <li>
              <strong>Profile information</strong>: name, location, housing details,
              foster preferences (for fosters); shelter name, location, EIN, website,
              and verification status (for shelters).
            </li>
            <li>
              <strong>Application and messaging content</strong>: dogs you list,
              applications you submit or receive, and messages you exchange with the
              other party.
            </li>
            <li>
              <strong>Ratings</strong>: the scores and comments you leave after a
              completed placement, and the scores/comments left about you.
            </li>
            <li>
              <strong>Technical data</strong>: IP address, device/browser metadata,
              and cookies required to keep you signed in.
            </li>
          </ul>

          <h2>2. How We Use Information</h2>
          <ul>
            <li>To operate the Service and enable foster/shelter matching</li>
            <li>To send transactional email (application status, messages, placement confirmations)</li>
            <li>To protect the Service from fraud, abuse, and misuse</li>
            <li>
              To improve the Service, including aggregated and de-identified analytics
            </li>
            <li>To comply with legal obligations</li>
          </ul>

          <h2>3. Sharing</h2>
          <p>
            We share your profile and application content with the other party to a
            placement (i.e., shelters see fosters who applied to their dog; fosters
            see the shelter associated with a dog they apply to). We do not sell
            personal information. We use trusted service providers (hosting,
            database, email delivery) who process data on our behalf under
            confidentiality obligations.
          </p>

          <h2>4. Retention & Deletion</h2>
          <p>
            You may delete your account at any time from account settings. When you
            delete your account:
          </p>
          <ul>
            <li>Your auth credentials are deleted from our identity provider.</li>
            <li>
              Your profile rows (shelter or foster) are anonymized — name, email, and
              contact fields are replaced with neutral placeholders — rather than
              hard-deleted, so existing applications, messages, and ratings on the
              other party&rsquo;s side remain coherent.
            </li>
            <li>
              Any active applications you own are marked declined/withdrawn; the
              historical record is preserved for the other party.
            </li>
          </ul>

          <h2>5. Security</h2>
          <p>
            We use Supabase for authentication and storage, which encrypts data in
            transit (TLS) and at rest. Access to your data is restricted via
            row-level security policies. No online service can guarantee perfect
            security; please use a strong, unique password and enable any available
            multi-factor options.
          </p>

          <h2>6. Children</h2>
          <p>
            The Service is not directed at children under 18 and we do not knowingly
            collect their personal information. If you believe a child has signed up,
            contact us and we will delete the account.
          </p>

          <h2>7. Your Rights</h2>
          <p>
            Depending on your jurisdiction (e.g., the EU, UK, California) you may
            have the right to access, correct, or erase personal data we hold about
            you. To exercise these rights, email us at{' '}
            <a href="mailto:privacy@fostrfix.example">privacy@fostrfix.example</a>.
            We will respond within the timeframe required by applicable law.
          </p>

          <h2>8. International Transfers</h2>
          <p>
            Fostr Fix is operated from the United States. If you use the Service from
            outside the US, your information will be transferred to and processed in
            the US and other countries where our service providers operate.
          </p>

          <h2>9. Changes</h2>
          <p>
            We may update this Privacy Policy from time to time. Material changes
            will be announced in-app and/or by email.
          </p>

          <h2>10. Contact</h2>
          <p>
            Questions about this policy? Reach us at{' '}
            <a href="mailto:privacy@fostrfix.example">privacy@fostrfix.example</a>.
          </p>

          <hr />
          <p className="text-sm text-muted-foreground">
            See also our{' '}
            <Link href="/terms" className="underline underline-offset-2">
              Terms of Service
            </Link>
            .
          </p>
        </article>
      </main>

      <PublicFooter />
    </div>
  )
}
