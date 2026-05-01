// Database types matching Supabase schema

import type { NotificationType } from '@/lib/notifications'

export interface Shelter {
  id: string
  created_at: string
  user_id: string
  name: string
  slug: string
  email: string
  phone: string | null
  location: string
  latitude: number | null
  longitude: number | null
  logo_url: string | null
  ein: string | null
  bio: string | null
  website: string | null
  instagram: string | null
  is_verified: boolean
}

export interface Dog {
  id: string
  created_at: string
  updated_at: string
  shelter_id: string
  name: string
  breed: string | null
  age: 'puppy' | 'young' | 'adult' | 'senior' | null
  size: 'small' | 'medium' | 'large' | 'xl' | null
  gender: 'male' | 'female' | null
  temperament: string | null
  medical_status: string | null
  special_needs: string | null
  description: string | null
  photos: string[]
  status: 'available' | 'pending' | 'placed' | 'adopted'
}

export interface FosterParent {
  id: string
  created_at: string
  user_id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  location: string
  latitude: number | null
  longitude: number | null
  housing_type: 'house' | 'apartment' | 'townhouse' | 'condo' | 'other' | null
  has_yard: boolean
  has_other_pets: boolean
  other_pets_info: string | null
  has_children: boolean
  children_info: string | null
  experience: 'none' | 'some' | 'experienced' | null
  bio: string | null
  avatar_url: string | null
  pref_size: string[]
  pref_age: string[]
  pref_medical: boolean
  max_distance: number
}

export interface Application {
  id: string
  created_at: string
  updated_at: string
  dog_id: string
  foster_id: string
  shelter_id: string
  status: 'submitted' | 'reviewing' | 'accepted' | 'declined' | 'completed'
  note: string | null
  shelter_note: string | null
  // Phase 7 Step 46 — structured application form fields. Legacy rows
  // pre-dating the migration default to nulls / false; the API enforces
  // them as required on new submissions.
  available_from: string | null
  available_until: string | null
  why_this_dog: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  responsibilities_acknowledged: boolean
}

export interface Rating {
  id: string
  created_at: string
  application_id: string
  shelter_id: string
  foster_id: string
  dog_id: string
  score: number // 1-5
  comment: string | null
}

// Foster's rating of a shelter after a completed placement. Mirrors
// `Rating` but the direction is reversed — foster is the author.
export interface ShelterRating {
  id: string
  created_at: string
  application_id: string
  shelter_id: string
  foster_id: string
  dog_id: string
  score: number // 1-5
  comment: string | null
}

export interface Message {
  id: string
  created_at: string
  application_id: string
  sender_id: string
  sender_role: 'shelter' | 'foster'
  body: string
  read: boolean
}

// Phase 7 Step 48 — Notification Center foundation.
export interface Notification {
  id: string
  created_at: string
  user_id: string
  type: NotificationType
  title: string
  body: string | null
  link: string | null
  read: boolean
  read_at: string | null
  metadata: Record<string, unknown> | null
}

// Phase 6.2 — roster tables.

/**
 * Source of truth for "which fosters this shelter works with." Composite key
 * (shelter_id, foster_id); future Herds membership FKs to this same pair.
 */
export interface ShelterFoster {
  shelter_id: string
  foster_id: string
  added_at: string
  source: 'application_accepted' | 'invite_accepted'
}

/**
 * Shelter-initiated invite for a foster. `email` is what the shelter typed;
 * `foster_id` is populated either at creation (if the email already resolves
 * to a foster) or at onboarding (if the foster signs up later and the email
 * matches case-insensitively).
 */
export interface ShelterFosterInvite {
  id: string
  created_at: string
  responded_at: string | null
  shelter_id: string
  email: string
  foster_id: string | null
  status: 'pending' | 'accepted' | 'declined' | 'cancelled'
  message: string | null
}

/** Private, shelter-staff-only note tied to a (shelter, foster) pair. */
export interface ShelterFosterNote {
  id: string
  created_at: string
  updated_at: string
  shelter_id: string
  foster_id: string
  author_user: string
  body: string
}

// Phase 6.5 — Saved dogs.

/** Foster bookmarks a dog. Composite key (foster_id, dog_id). */
export interface DogSave {
  foster_id: string
  dog_id: string
  saved_at: string
}

/** RPC return shape for `get_save_counts_for_my_dogs()` (shelter aggregate). */
export interface DogSaveCount {
  dog_id: string
  save_count: number
}

// Phase 6.4 — Mutual reporting.

export type ReportCategory =
  | 'safety'
  | 'harassment'
  | 'misrepresentation'
  | 'no_show'
  | 'other'

export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed'

/**
 * A flag raised by one party on an application against the other party.
 * Exactly one of `subject_foster_id` / `subject_shelter_id` is non-null,
 * enforced by a table CHECK and an RLS WITH CHECK.
 */
export interface Report {
  id: string
  created_at: string
  application_id: string
  reporter_user_id: string
  subject_foster_id: string | null
  subject_shelter_id: string | null
  category: ReportCategory
  body: string
  status: ReportStatus
}

// Composite types for UI

export interface DogWithShelter extends Dog {
  shelter_name: string
  shelter_logo_url: string | null
  shelter_slug: string | null
  /** Average rating of the dog's shelter (1-5), or null if no ratings yet. */
  shelter_avg_rating?: number | null
  /** Number of ratings that produced `shelter_avg_rating`. */
  shelter_rating_count?: number
  /** Shelter coordinates, pulled through the browse join, so the client can
   *  recompute distance when the foster's coords update without refetching. */
  shelter_latitude?: number | null
  shelter_longitude?: number | null
  distance_miles?: number
}

export interface ApplicationWithDetails extends Application {
  dog: Dog
  foster: FosterParent
  shelter: Shelter
}

export interface MessageWithSender extends Message {
  sender: {
    email: string
  }
}
