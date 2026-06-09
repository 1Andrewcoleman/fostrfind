import type { Rating } from '@/types/database'

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateShort(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function formatRelativeTime(dateString: string): string {
  const ms = Date.now() - new Date(dateString).getTime()
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return 'Just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return formatDateShort(dateString)
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function calculateAverageRating(ratings: Pick<Rating, 'score'>[]): number {
  if (ratings.length === 0) return 0
  const sum = ratings.reduce((acc, r) => acc + r.score, 0)
  return Math.round((sum / ratings.length) * 10) / 10
}

export const MORNING_GREETINGS = [
  'Good morning',
  'Morning',
  'Rise and shine',
  'Top of the morning',
  'Wakey wakey',
  "Hope the coffee's hot",
  'Starting the day right',
  'Up and at \'em',
  'Good day',
  "Glad you're up",
] as const

export const AFTERNOON_GREETINGS = [
  'Good afternoon',
  'Afternoon',
  "Hope the day's going well",
  'Keeping busy',
  'Good to see you',
  'Hope lunch hit the spot',
  "Hope you're having a good one",
  "Glad you're here",
  'Getting things done',
  'Powering through',
] as const

export const EVENING_GREETINGS = [
  'Good evening',
  'Evening',
  'Hope the day went well',
  'Winding down',
  "Hope it's been a good one",
  'Nice to see you tonight',
  'Almost at the finish line',
  'Hanging in there',
  "Hope you're doing well",
  'End of another day',
] as const

export function getGreeting(date: Date = new Date()): string {
  const hour = date.getHours()
  const pool =
    hour < 12 ? MORNING_GREETINGS :
    hour < 17 ? AFTERNOON_GREETINGS :
    EVENING_GREETINGS
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Haversine distance between two lat/lng pairs, in miles. Returns null if any
 * input is missing, so callers can cleanly fall back to "unknown distance".
 *
 * Accuracy: ~0.5% error over typical within-country distances; more than good
 * enough for a "within N miles" foster match filter, and crucially runs
 * client-side without a PostGIS dependency. A server-side SQL mirror lives
 * in `supabase/migrations/20240108000000_distance_miles.sql` so we can move
 * this to a `.rpc()` call later without re-designing the UI.
 */
export function haversineMiles(
  a: { latitude: number | null; longitude: number | null } | null | undefined,
  b: { latitude: number | null; longitude: number | null } | null | undefined,
): number | null {
  if (!a || !b) return null
  if (a.latitude == null || a.longitude == null) return null
  if (b.latitude == null || b.longitude == null) return null
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const earthRadiusMiles = 3958.8
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const lat1 = toRad(a.latitude)
  const lat2 = toRad(b.latitude)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h))
  return earthRadiusMiles * c
}
