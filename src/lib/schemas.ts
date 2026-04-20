// Shared zod schemas for form validation.
//
// These schemas provide a single source of truth for field-level validation
// rules. They are consumed by react-hook-form (auth forms) and by direct
// safeParse() calls (profile / settings forms that retain their existing
// stateful UI — see docs/roadmap.md Deferred Follow-ups for the RHF
// migration of those forms).

import { z } from 'zod'
import { DOG_SIZES, DOG_AGES, HOUSING_TYPES, EXPERIENCE_LEVELS } from '@/lib/constants'

// We use Zod's built-in .trim() so input and output types stay `string`;
// this keeps useForm<SchemaType>() typings clean (z.preprocess would yield
// `unknown` on the input side and collide with @hookform/resolvers types).

// An "optional trimmed" string: after trim, an empty string is treated as
// undefined so the caller can tell "user intentionally cleared" apart
// from "the field wasn't touched".
const optionalTrimmedString = (maxLen: number, tooLong?: string) =>
  z
    .string()
    .trim()
    .max(maxLen, tooLong ?? `Keep this under ${maxLen} characters`)
    .transform((v) => (v === '' ? undefined : v))
    .optional()

export const PASSWORD_MIN = 8
export const PASSWORD_MAX = 100

export const emailSchema = z
  .string()
  .trim()
  .email('Enter a valid email address')

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`)
  .max(PASSWORD_MAX, `Password must be at most ${PASSWORD_MAX} characters`)

// ---------- Auth forms ----------

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password'),
})
export type LoginInput = z.infer<typeof loginSchema>

export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    // The checkbox is a plain boolean in the form; refine below ensures
    // the final submission must be true without forcing the input type.
    acceptTerms: z.boolean(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
  .refine((data) => data.acceptTerms === true, {
    message: 'You must agree to the Terms of Service and Privacy Policy',
    path: ['acceptTerms'],
  })
export type SignupInput = z.infer<typeof signupSchema>

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

export const resetPasswordSchema = z
  .object({
    newPassword: passwordSchema,
    confirmPassword: z.string().min(1, 'Confirm your new password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>

// ---------- Profile / settings ----------

// Free-text bio lengths here mirror the existing upper bounds; the DB is
// TEXT so we enforce reasonable caps in the app layer only.
const BIO_MAX = 2000
const NAME_MAX = 80
const LOCATION_MAX = 120

export const fosterProfileSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(NAME_MAX),
  last_name: z.string().trim().min(1, 'Last name is required').max(NAME_MAX),
  email: emailSchema,
  phone: optionalTrimmedString(40, 'Phone number is too long'),
  location: z.string().trim().min(1, 'Location is required').max(LOCATION_MAX),
  housing_type: z.enum(HOUSING_TYPES).nullable().optional(),
  has_yard: z.boolean(),
  has_other_pets: z.boolean(),
  other_pets_info: optionalTrimmedString(500),
  has_children: z.boolean(),
  children_info: optionalTrimmedString(500),
  experience: z.enum(EXPERIENCE_LEVELS).nullable().optional(),
  bio: optionalTrimmedString(BIO_MAX, `Keep your bio under ${BIO_MAX} characters`),
  pref_size: z.array(z.enum(DOG_SIZES)),
  pref_age: z.array(z.enum(DOG_AGES)),
  pref_medical: z.boolean(),
  max_distance: z.number().int().min(1).max(500),
})
export type FosterProfileInput = z.infer<typeof fosterProfileSchema>

// Slug is a URL segment. We allow lowercase letters, digits, and hyphens.
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// Accept URLs with or without protocol; normalizeWebsiteUrl prepends https:
// when missing. Limit length loosely to catch obvious garbage pastes.
const URL_LOOSE_REGEX = /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}([/?#][^\s]*)?$/i

export const shelterSettingsSchema = z.object({
  name: z.string().trim().min(1, 'Shelter name is required').max(NAME_MAX),
  slug: z
    .string()
    .trim()
    .min(3, 'Slug must be at least 3 characters')
    .max(60, 'Slug is too long')
    .regex(SLUG_REGEX, 'Use lowercase letters, numbers, and hyphens only'),
  email: emailSchema,
  phone: optionalTrimmedString(40, 'Phone number is too long'),
  location: z.string().trim().min(1, 'Location is required').max(LOCATION_MAX),
  bio: optionalTrimmedString(BIO_MAX, `Keep your bio under ${BIO_MAX} characters`),
  website: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === '' ? undefined : v))
    .optional()
    .refine((v) => v === undefined || URL_LOOSE_REGEX.test(v), {
      message: 'Enter a valid website URL',
    }),
  instagram: z
    .string()
    .trim()
    .max(60)
    .transform((v) => (v === '' ? undefined : v))
    .optional()
    .refine((v) => v === undefined || /^@?[a-zA-Z0-9._]+$/.test(v), {
      message: 'Enter a valid Instagram handle',
    }),
})
export type ShelterSettingsInput = z.infer<typeof shelterSettingsSchema>
