import { describe, expect, it } from 'vitest'
import {
  applicationDraftKey,
  parseDraft,
  serializeDraft,
} from '@/lib/application-draft'

describe('applicationDraftKey', () => {
  it('namespaces by dog id', () => {
    expect(applicationDraftKey('abc')).toBe('fostrfind:application-draft:abc')
  })
})

describe('serializeDraft / parseDraft round-trip', () => {
  it('round-trips the user-typed fields', () => {
    const raw = serializeDraft({
      available_from: '2026-07-01',
      available_until: '',
      why_this_dog: 'We love labs.',
      emergency_contact_name: 'John Smith',
      emergency_contact_phone: '555-0100',
      note: 'Weekends work best.',
    })
    expect(parseDraft(raw)).toEqual({
      available_from: '2026-07-01',
      available_until: '',
      why_this_dog: 'We love labs.',
      emergency_contact_name: 'John Smith',
      emergency_contact_phone: '555-0100',
      note: 'Weekends work best.',
    })
  })

  it('strips ids and the consent checkbox from the persisted draft', () => {
    const raw = serializeDraft({
      dog_id: '00000000-0000-4000-8000-000000000001',
      shelter_id: '00000000-0000-4000-8000-0000000000a1',
      responsibilities_acknowledged: true,
      why_this_dog: 'Big yard.',
    })
    const parsed = parseDraft(raw)
    expect(parsed).toEqual({ why_this_dog: 'Big yard.' })
    expect(raw).not.toContain('dog_id')
    expect(raw).not.toContain('shelter_id')
    expect(raw).not.toContain('responsibilities_acknowledged')
  })
})

describe('parseDraft hardening', () => {
  it('returns null for null/empty input', () => {
    expect(parseDraft(null)).toBeNull()
    expect(parseDraft('')).toBeNull()
  })

  it('returns null for corrupt JSON', () => {
    expect(parseDraft('{not json')).toBeNull()
  })

  it('returns null for non-object JSON', () => {
    expect(parseDraft('"a string"')).toBeNull()
    expect(parseDraft('[1,2,3]')).toBeNull()
  })

  it('returns null when fields have wrong types', () => {
    expect(parseDraft('{"why_this_dog": 42}')).toBeNull()
    expect(parseDraft('{"note": ["x"]}')).toBeNull()
  })

  it('returns null for an empty draft object', () => {
    expect(parseDraft('{}')).toBeNull()
  })
})
