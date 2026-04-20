import type { Metadata } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { validateEnv } from '@/lib/env'
import './globals.css'

validateEnv()

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-display' })

const SITE_NAME = 'Fostr Fix'
const SITE_DESCRIPTION =
  'Fostr Fix connects animal shelters with compassionate foster families — giving dogs the temporary homes they need while they wait for their forever family.'

// metadataBase root: prefer NEXT_PUBLIC_APP_URL so prod social shares resolve
// absolute URLs correctly; fall back to localhost in dev. Duplicates the
// tiny bit of `lib/email.ts` `getAppUrl()` logic on purpose — we don't want
// to pull the Resend SDK into every page's bundle via a shared module.
const APP_URL = (() => {
  const raw = process.env.NEXT_PUBLIC_APP_URL
  return raw && raw.startsWith('http') ? raw.replace(/\/$/, '') : 'http://localhost:3000'
})()

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: SITE_NAME,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    locale: 'en_US',
  },
  twitter: {
    card: 'summary',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
