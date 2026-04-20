import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  calculateAverageRating,
  formatDate,
  formatDateShort,
  formatRelativeTime,
  getGreeting,
  getInitials,
  haversineMiles,
  pluralize,
  slugify,
} from '@/lib/helpers'

describe('formatDate', () => {
  it('formats an ISO date string as "MMM d, yyyy"', () => {
    expect(formatDate('2026-04-20T12:34:56Z')).toMatch(/Apr \d{1,2}, 2026/)
  })
})

describe('formatDateShort', () => {
  it('formats as month + day only', () => {
    expect(formatDateShort('2026-04-20T12:34:56Z')).toMatch(/Apr \d{1,2}/)
  })
})

describe('formatRelativeTime', () => {
  const fixedNow = new Date('2026-04-20T12:00:00Z').getTime()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(fixedNow)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "Just now" for < 60 seconds', () => {
    const thirtySecondsAgo = new Date(fixedNow - 30 * 1000).toISOString()
    expect(formatRelativeTime(thirtySecondsAgo)).toBe('Just now')
  })

  it('returns minutes for < 60 minutes', () => {
    const fiveMinAgo = new Date(fixedNow - 5 * 60 * 1000).toISOString()
    expect(formatRelativeTime(fiveMinAgo)).toBe('5m ago')
  })

  it('returns hours for < 24 hours', () => {
    const twoHoursAgo = new Date(fixedNow - 2 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago')
  })

  it('returns days for < 7 days', () => {
    const threeDaysAgo = new Date(fixedNow - 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago')
  })

  it('falls back to short date for > 7 days', () => {
    const tenDaysAgo = new Date(fixedNow - 10 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatRelativeTime(tenDaysAgo)).toMatch(/Apr \d{1,2}/)
  })
})

describe('getInitials', () => {
  it('returns two uppercase initials from a full name', () => {
    expect(getInitials('Jane Doe')).toBe('JD')
  })

  it('truncates to 2 when name has 3+ words', () => {
    expect(getInitials('Mary Jane Doe')).toBe('MJ')
  })

  it('returns a single initial from a single-word name', () => {
    expect(getInitials('Cher')).toBe('C')
  })

  it('returns empty string for empty input', () => {
    expect(getInitials('')).toBe('')
  })
})

describe('slugify', () => {
  it('lowercases and hyphenates simple names', () => {
    expect(slugify('Happy Tails Rescue')).toBe('happy-tails-rescue')
  })

  it('strips punctuation', () => {
    expect(slugify("Paws & Claws!")).toBe('paws-claws')
  })

  it('collapses repeated separators', () => {
    expect(slugify('foo   bar___baz')).toBe('foo-bar-baz')
  })

  it('trims leading and trailing separators', () => {
    expect(slugify('  --Hello--  ')).toBe('hello')
  })

  it('returns empty string for punctuation-only input', () => {
    expect(slugify('!!!')).toBe('')
  })
})

describe('calculateAverageRating', () => {
  it('returns 0 for empty array', () => {
    expect(calculateAverageRating([])).toBe(0)
  })

  it('returns the score for a single rating', () => {
    expect(calculateAverageRating([{ score: 5 }])).toBe(5)
  })

  it('averages multiple ratings rounded to 1 decimal', () => {
    expect(calculateAverageRating([{ score: 5 }, { score: 4 }, { score: 5 }])).toBe(4.7)
  })

  it('rounds half-up to 1 decimal place', () => {
    expect(calculateAverageRating([{ score: 3 }, { score: 4 }])).toBe(3.5)
  })
})

describe('haversineMiles', () => {
  it('returns null when either point is missing', () => {
    expect(haversineMiles(null, { latitude: 1, longitude: 2 })).toBeNull()
    expect(haversineMiles({ latitude: 1, longitude: 2 }, null)).toBeNull()
    expect(haversineMiles(undefined, undefined)).toBeNull()
  })

  it('returns null when lat/lng are null on either side', () => {
    expect(
      haversineMiles(
        { latitude: null, longitude: 10 },
        { latitude: 20, longitude: 30 },
      ),
    ).toBeNull()
    expect(
      haversineMiles(
        { latitude: 20, longitude: 30 },
        { latitude: 40, longitude: null },
      ),
    ).toBeNull()
  })

  it('returns 0 for the same point', () => {
    const p = { latitude: 40.7128, longitude: -74.006 }
    expect(haversineMiles(p, p)).toBe(0)
  })

  it('computes NYC to LA as roughly 2450 miles', () => {
    const nyc = { latitude: 40.7128, longitude: -74.006 }
    const la = { latitude: 34.0522, longitude: -118.2437 }
    const dist = haversineMiles(nyc, la)
    expect(dist).not.toBeNull()
    expect(dist).toBeGreaterThan(2400)
    expect(dist).toBeLessThan(2500)
  })
})

describe('pluralize', () => {
  it('returns singular for count === 1', () => {
    expect(pluralize(1, 'dog')).toBe('1 dog')
  })

  it('returns plural for count !== 1', () => {
    expect(pluralize(0, 'dog')).toBe('0 dogs')
    expect(pluralize(2, 'dog')).toBe('2 dogs')
  })

  it('uses a custom plural form when provided', () => {
    expect(pluralize(3, 'puppy', 'puppies')).toBe('3 puppies')
  })
})

describe('getGreeting', () => {
  it('returns morning before noon', () => {
    expect(getGreeting(new Date('2026-04-20T09:00:00'))).toBe('Good morning')
  })

  it('returns afternoon between noon and 5pm', () => {
    expect(getGreeting(new Date('2026-04-20T14:00:00'))).toBe('Good afternoon')
  })

  it('returns evening after 5pm', () => {
    expect(getGreeting(new Date('2026-04-20T19:00:00'))).toBe('Good evening')
  })
})
