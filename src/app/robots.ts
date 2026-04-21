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
 * Carve-out: `/foster/dog/` is a portal-aliased path that serves a
 * *public teaser* to anonymous visitors (and the full authenticated
 * view to fosters), so shared links should be indexable. Crawlers
 * honor the most specific matching rule, which means `/foster/dog/…`
 * is allowed while `/foster/dashboard`, `/foster/browse`, etc. stay
 * blocked. No other `/foster/*` path changes.
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
        allow: ['/', '/foster/dog/'],
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
