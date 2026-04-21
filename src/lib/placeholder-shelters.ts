import type { Shelter } from '@/types/database'

/**
 * DEV_MODE fixtures for the shelter surfaces (`/shelters` index and
 * `/shelters/[slug]` detail). Lives in a shared `lib/` module so both
 * pages can import from the same source and Next.js's page-file
 * export-shape constraints aren't violated (route files can only
 * export specific symbols: `default`, `metadata`, `generateMetadata`,
 * etc. — see the TS2344 failure we hit when this const was exported
 * from `src/app/shelters/[slug]/page.tsx`).
 */
export const PLACEHOLDER_SHELTERS: Record<string, Shelter> = {
  'happy-paws-rescue': {
    id: 's1',
    created_at: new Date().toISOString(),
    user_id: 'dev-shelter-1',
    name: 'Happy Paws Rescue',
    slug: 'happy-paws-rescue',
    email: 'hello@happypaws.example',
    phone: '(555) 123-4567',
    location: 'Austin, TX',
    latitude: null,
    longitude: null,
    logo_url: null,
    ein: null,
    bio: 'Happy Paws is a volunteer-run rescue that pairs dogs with loving foster families while we find their forever homes.',
    website: 'https://happypaws.example',
    instagram: 'happypawsrescue',
    is_verified: true,
  },
  'austin-animal-rescue': {
    id: 's2',
    created_at: new Date().toISOString(),
    user_id: 'dev-shelter-2',
    name: 'Austin Animal Rescue',
    slug: 'austin-animal-rescue',
    email: 'team@austinrescue.example',
    phone: null,
    location: 'Austin, TX',
    latitude: null,
    longitude: null,
    logo_url: null,
    ein: null,
    bio: 'Serving central Texas since 2014.',
    website: null,
    instagram: null,
    is_verified: false,
  },
}
