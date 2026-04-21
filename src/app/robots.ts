import type { MetadataRoute } from 'next'
import { getAppUrl } from '@/lib/email'

/**
 * robots.txt — allow public marketing pages, disallow everything that
 * lives behind auth or that is a thin auth-gateway.
 *
 * We explicitly disallow:
 * - `/foster/*` and `/shelter/*` — authenticated portals; indexing
 *   these would either 404 or bounce crawlers through the login gate.
 * - `/auth/*`, `/login`, `/signup`, `/onboarding` — auth helpers with
 *   no standalone content value.
 * - `/api/*` — server routes should never be surfaced in search.
 *
 * `sitemap` points at `/sitemap.xml`, which `src/app/sitemap.ts`
 * generates for the same three public URLs.
 */
export default function robots(): MetadataRoute.Robots {
  const base = getAppUrl()
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/foster/',
          '/shelter/',
          '/auth/',
          '/login',
          '/signup',
          '/onboarding',
          '/api/',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
