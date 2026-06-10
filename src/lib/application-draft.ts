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

export function applicationDraftKey(dogId: string): string {
  return `fostrfind:application-draft:${dogId}`
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
