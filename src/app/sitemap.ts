import type { MetadataRoute } from 'next'
import { getAppUrl } from '@/lib/email'

/**
 * sitemap.xml — static list of the *public* routes on Fostr Find.
 *
 * Scope is intentionally narrow:
 * - Authenticated portal routes (`/foster/*`, `/shelter/*`) are omitted;
 *   they require a session and have no public content to index.
 * - Auth-helper routes (`/login`, `/signup`, `/auth/*`) are omitted; they
 *   are thin gateways with no content worth ranking.
 * - Shelter public profiles (`/shelters/[slug]`) would be the one place
 *   dynamic entries could live. We do NOT hit Supabase from this file
 *   because doing so at build time requires service-role creds in CI
 *   and makes the sitemap blow up on every deploy if the DB is empty.
 *   Leaving them out until we have a real shelter-profile SEO story.
 *
 * Frequency + priority values follow Google's public guidance: don't
 * lie. The landing page updates on release; terms/privacy update rarely.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getAppUrl()
  const now = new Date()
  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 1.0,
    },
    {
      url: `${base}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${base}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
}
