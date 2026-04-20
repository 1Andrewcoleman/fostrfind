// Translate Supabase auth errors into user-facing copy without leaking
// internal details. Unknown errors collapse to a generic message; the
// raw message is always logged to the console for debugging.

import type { AuthError } from '@supabase/supabase-js'

/**
 * Known Supabase auth error messages we trust to surface verbatim or
 * translate into friendlier copy. The match is case-insensitive on the
 * original message.
 */
const KNOWN_MAPPINGS: Array<{ match: RegExp; copy: string }> = [
  { match: /invalid login credentials/i, copy: 'Incorrect email or password.' },
  { match: /email not confirmed/i, copy: 'Please confirm your email before signing in.' },
  { match: /user already registered/i, copy: 'An account with that email already exists.' },
  { match: /already been registered/i, copy: 'An account with that email already exists.' },
  { match: /password should be at least/i, copy: 'Your password is too short.' },
  { match: /rate limit|too many/i, copy: 'Too many attempts. Please wait a moment and try again.' },
  { match: /network|fetch failed/i, copy: 'Network issue — check your connection and try again.' },
]

export function describeAuthError(
  error: AuthError | { message?: string } | null | undefined,
  fallback = 'Something went wrong. Please try again.',
): string {
  const raw = error?.message ?? ''
  if (!raw) return fallback
  for (const { match, copy } of KNOWN_MAPPINGS) {
    if (match.test(raw)) return copy
  }
  return fallback
}
