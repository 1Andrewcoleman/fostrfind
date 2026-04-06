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

export const MAX_DOG_PHOTOS = 5

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
