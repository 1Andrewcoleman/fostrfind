import { describe, expect, it, vi } from 'vitest'
import {
  activeFosteringCount,
  isInvitePending,
  normalizeInviteEmail,
} from '@/lib/shelter-roster'

describe('normalizeInviteEmail', () => {
  it('lowercases and trims real strings', () => {
    expect(normalizeInviteEmail('Foo@Example.com')).toBe('foo@example.com')
    expect(normalizeInviteEmail('  Foo@Example.com  ')).toBe('foo@example.com')
  })

  it('returns "" for non-strings', () => {
    expect(normalizeInviteEmail(null)).toBe('')
    expect(normalizeInviteEmail(undefined)).toBe('')
    expect(normalizeInviteEmail(123)).toBe('')
    expect(normalizeInviteEmail({})).toBe('')
  })

  it('returns "" for empty and whitespace-only strings', () => {
    expect(normalizeInviteEmail('')).toBe('')
    expect(normalizeInviteEmail('   ')).toBe('')
  })
})

describe('isInvitePending', () => {
  it('recognises the pending state', () => {
    expect(isInvitePending({ status: 'pending' })).toBe(true)
  })

  it('rejects every other state', () => {
    expect(isInvitePending({ status: 'accepted' })).toBe(false)
    expect(isInvitePending({ status: 'declined' })).toBe(false)
    expect(isInvitePending({ status: 'cancelled' })).toBe(false)
  })
})

describe('activeFosteringCount', () => {
  function mockSupabase(result: { count: number | null; error: Error | null }) {
    return {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue(result),
          }),
        }),
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any
  }

  it('returns the count when the query succeeds', async () => {
    const supabase = mockSupabase({ count: 3, error: null })
    expect(await activeFosteringCount(supabase, 'foster-1')).toBe(3)
  })

  it('returns 0 when count is null (no matching rows)', async () => {
    const supabase = mockSupabase({ count: null, error: null })
    expect(await activeFosteringCount(supabase, 'foster-1')).toBe(0)
  })

  it('returns 0 on error (RLS denial, network failure) and does not throw', async () => {
    const supabase = mockSupabase({ count: null, error: new Error('permission denied') })
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      expect(await activeFosteringCount(supabase, 'foster-1')).toBe(0)
      expect(spy).toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })
})
