import type { Metadata } from 'next'
import { Source_Serif_4 } from 'next/font/google'
import localFont from 'next/font/local'
import { Toaster } from '@/components/ui/sonner'
import { validateEnv } from '@/lib/env'
import './globals.css'

validateEnv()

// Switzer — self-hosted via next/font/local. See `.impeccable.md` for why
// Switzer over system sans: its geometric-humanist balance holds calm at
// UI scale the way Inter does, but with slightly softer terminals that
// read closer to the "dog daycare" end of our brand tension. Weights are
// kept to the five we actually use (300/400/500/600/700) to cap the
// transfer size.
const switzer = localFont({
  src: [
    { path: './fonts/switzer/switzer-300.woff2', weight: '300', style: 'normal' },
    { path: './fonts/switzer/switzer-400.woff2', weight: '400', style: 'normal' },
    { path: './fonts/switzer/switzer-500.woff2', weight: '500', style: 'normal' },
    { path: './fonts/switzer/switzer-600.woff2', weight: '600', style: 'normal' },
    { path: './fonts/switzer/switzer-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-sans',
  display: 'swap',
  fallback: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
})

// Source Serif 4 — Google Fonts. Reserved for page-level H1s and a single
// editorial accent per page (principle #3 in `.impeccable.md`). Two weights
// only — 400 for running serif body (rare, only in quotes) and 600 for
// display headings.
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-display',
  display: 'swap',
})

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
    <html
      lang="en"
      className={`${switzer.variable} ${sourceSerif.variable}`}
      // `next-themes` writes `class="light"` / `"dark"` to <html> at mount
      // for the authenticated portals (see `PortalThemeProvider`). That
      // conflicts with SSR's empty class attribute and triggers React's
      // hydration warning. Suppressing here rather than inside the portal
      // layouts because this is the element that actually gets mutated.
      suppressHydrationWarning
    >
      <body className="font-sans">
        {children}
        <Toaster />
      </body>
    </html>
  )
}
