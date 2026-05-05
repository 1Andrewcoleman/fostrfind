export const DOG_STATUSES = ['available', 'pending', 'placed', 'adopted'] as const
export const APPLICATION_STATUSES = [
  'submitted',
  'reviewing',
  'accepted',
  'declined',
  'completed',
  'withdrawn',
] as const
export const DOG_SIZES = ['small', 'medium', 'large', 'xl'] as const
export const DOG_AGES = ['puppy', 'young', 'adult', 'senior'] as const
export const DOG_GENDERS = ['male', 'female'] as const
export const HOUSING_TYPES = ['house', 'apartment', 'townhouse', 'condo', 'other'] as const
export const EXPERIENCE_LEVELS = ['none', 'some', 'experienced'] as const

export const STORAGE_BUCKETS = {
  DOG_PHOTOS: 'dog-photos',
  SHELTER_LOGOS: 'shelter-logos',
  FOSTER_AVATARS: 'foster-avatars',
} as const

export const STORAGE_BUCKET_VALUES = Object.values(STORAGE_BUCKETS)
export type StorageBucket = (typeof STORAGE_BUCKET_VALUES)[number]

export const MAX_DOG_PHOTOS = 5

/** 10 MB — generous for phone-camera images while still rejecting abuse. */
export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

export const ALLOWED_IMAGE_EXTENSIONS: Record<(typeof ALLOWED_IMAGE_TYPES)[number], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export const DOG_SIZE_LABELS: Record<string, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  xl: 'XL',
}

export const DOG_AGE_LABELS: Record<string, string> = {
  puppy: 'Puppy',
  young: 'Young',
  adult: 'Adult',
  senior: 'Senior',
}

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  reviewing: 'Reviewing',
  accepted: 'Accepted',
  declined: 'Declined',
  completed: 'Completed',
  withdrawn: 'Withdrawn',
}

export const REPORT_CATEGORIES = [
  'safety',
  'harassment',
  'misrepresentation',
  'no_show',
  'other',
] as const

export const REPORT_CATEGORY_LABELS: Record<(typeof REPORT_CATEGORIES)[number], string> = {
  safety: 'Safety concern',
  harassment: 'Harassment or abuse',
  misrepresentation: 'Misrepresentation or dishonesty',
  no_show: 'No-show or unresponsive',
  other: 'Something else',
}

export const DOG_STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  pending: 'Pending',
  placed: 'Placed',
  adopted: 'Adopted',
}

export const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')

/**
 * Real support inbox surfaced on error boundaries and the public footer.
 * Used as a single catch-all for support, privacy, and general inquiries
 * during the pilot — see also the privacy/terms pages, which point at
 * the same address.
 */
export const SUPPORT_EMAIL = 'support@fostrfind.com'
