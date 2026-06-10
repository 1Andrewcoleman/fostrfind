import { z } from 'zod'
import type { ApplicationCreateInput } from '@/lib/schemas'

/**
 * Draft persistence for the foster application dialog.
 *
 * Pure (de)serialization helpers — no storage access here, so the module
 * is testable in the node-env vitest setup. The dialog stores drafts in
 * `sessionStorage` (NOT localStorage): the draft contains a third
 * party's PII (emergency contact name/phone), and sessionStorage covers
 * the real failure modes (accidental dismissal, Esc, mis-click, same-tab
 * reload) without persisting that PII on shared machines after the tab
 * closes.
 */

const DRAFT_KEY_PREFIX = 'fostrfind:application-draft:'

export function applicationDraftKey(dogId: string): string {
  return `${DRAFT_KEY_PREFIX}${dogId}`
}

/**
 * Remove every stored application draft. Called on sign-out so a draft's
 * third-party PII can't be restored into the next account that signs in
 * within the same tab. Browser-only; safe no-op anywhere storage is
 * unavailable.
 */
export function clearAllApplicationDrafts(): void {
  try {
    const doomed: string[] = []
    for (let i = 0; i < window.sessionStorage.length; i++) {
      const key = window.sessionStorage.key(i)
      if (key?.startsWith(DRAFT_KEY_PREFIX)) doomed.push(key)
    }
    for (const key of doomed) window.sessionStorage.removeItem(key)
  } catch {
    // SSR or storage unavailable — nothing to clear.
  }
}

/**
 * The persisted subset: user-typed fields only. `dog_id` / `shelter_id`
 * always come from props, and `responsibilities_acknowledged` is
 * deliberately excluded — consent must be re-given on every submission.
 */
const draftSchema = z
  .object({
    available_from: z.string(),
    available_until: z.string(),
    why_this_dog: z.string(),
    emergency_contact_name: z.string(),
    emergency_contact_phone: z.string(),
    note: z.string(),
  })
  .partial()

export type ApplicationDraft = z.infer<typeof draftSchema>

const DRAFT_KEYS = [
  'available_from',
  'available_until',
  'why_this_dog',
  'emergency_contact_name',
  'emergency_contact_phone',
  'note',
] as const

/** Parse a stored draft; returns null on corrupt JSON or wrong shape. */
export function parseDraft(raw: string | null): ApplicationDraft | null {
  if (!raw) return null
  let json: unknown
  try {
    json = JSON.parse(raw)
  } catch {
    return null
  }
  const parsed = draftSchema.safeParse(json)
  if (!parsed.success) return null
  // An empty object is a valid parse but a useless draft.
  return Object.keys(parsed.data).length > 0 ? parsed.data : null
}

/** Serialize form values down to the persisted subset. */
export function serializeDraft(
  values: Partial<ApplicationCreateInput>,
): string {
  const draft: ApplicationDraft = {}
  for (const key of DRAFT_KEYS) {
    const value = values[key]
    if (typeof value === 'string') {
      draft[key] = value
    }
  }
  return JSON.stringify(draft)
}
