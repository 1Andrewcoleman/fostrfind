export const DOG_STATUSES = ['available', 'pending', 'placed', 'adopted'] as const
export const APPLICATION_STATUSES = ['submitted', 'reviewing', 'accepted', 'declined', 'completed'] as const
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
}

export const DOG_STATUS_LABELS: Record<string, string> = {
  available: 'Available',
  pending: 'Pending',
  placed: 'Placed',
  adopted: 'Adopted',
}

export const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')
