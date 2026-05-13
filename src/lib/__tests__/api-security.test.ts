import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { buildAllowedOrigins, validateMutationRequest } from '@/lib/api-security'

// ---------------------------------------------------------------------------
// buildAllowedOrigins
// ---------------------------------------------------------------------------

describe('buildAllowedOrigins', () => {
  it('returns empty set when appUrl is undefined', () => {
    expect(buildAllowedOrigins(undefined)).toEqual(new Set())
  })

  it('returns empty set when appUrl does not start with http', () => {
    expect(buildAllowedOrigins('localhost:3000')).toEqual(new Set())
  })

  it('includes both apex and www. variant for a bare domain', () => {
    const origins = buildAllowedOrigins('https://fostrfind.com')
    expect(origins).toContain('https://fostrfind.com')
    expect(origins).toContain('https://www.fostrfind.com')
    expect(origins.size).toBe(2)
  })

  it('does not double-add www. when APP_URL already has www.', () => {
    const origins = buildAllowedOrigins('https://www.fostrfind.com')
    expect(origins).toContain('https://www.fostrfind.com')
    expect(origins.size).toBe(1)
  })

  it('preserves non-standard port', () => {
    const origins = buildAllowedOrigins('http://localhost:3000')
    expect(origins).toContain('http://localhost:3000')
  })
})

// ---------------------------------------------------------------------------
// validateMutationRequest — origin checks
// ---------------------------------------------------------------------------

function makeRequest(opts: {
  origin?: string | null
  contentType?: string | null
  method?: string
}): Request {
  const headers = new Headers()
  if (opts.origin !== undefined && opts.origin !== null) headers.set('origin', opts.origin)
  if (opts.contentType !== undefined && opts.contentType !== null)
    headers.set('content-type', opts.contentType)
  return new Request('https://fostrfind.com/api/test', {
    method: opts.method ?? 'POST',
    headers,
  })
}

describe('validateMutationRequest — origin', () => {
  const originalEnv = process.env.NEXT_PUBLIC_APP_URL

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://fostrfind.com'
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalEnv
  })

  it('passes when Origin matches the configured app URL', () => {
    const req = makeRequest({ origin: 'https://fostrfind.com', contentType: 'application/json' })
    expect(validateMutationRequest(req)).toBeNull()
  })

  it('passes when Origin is the www. variant', () => {
    const req = makeRequest({ origin: 'https://www.fostrfind.com', contentType: 'application/json' })
    expect(validateMutationRequest(req)).toBeNull()
  })

  it('passes when Origin header is absent (server-to-server, curl)', () => {
    const req = makeRequest({ contentType: 'application/json' })
    expect(validateMutationRequest(req)).toBeNull()
  })

  it('passes when Origin is the string "null" (iOS PWA / in-app browser)', () => {
    const req = makeRequest({ origin: 'null', contentType: 'application/json' })
    expect(validateMutationRequest(req)).toBeNull()
  })

  it('blocks a genuinely foreign origin', () => {
    const req = makeRequest({ origin: 'https://evil.example.com', contentType: 'application/json' })
    const res = validateMutationRequest(req)
    expect(res).not.toBeNull()
    expect(res?.status).toBe(403)
  })

  it('passes when APP_URL is not configured (no origin guard)', () => {
    process.env.NEXT_PUBLIC_APP_URL = ''
    const req = makeRequest({ origin: 'https://anywhere.example.com', contentType: 'application/json' })
    expect(validateMutationRequest(req)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// validateMutationRequest — content-type checks
// ---------------------------------------------------------------------------

describe('validateMutationRequest — content-type', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://fostrfind.com'
  })

  it('passes with application/json', () => {
    const req = makeRequest({ origin: 'https://fostrfind.com', contentType: 'application/json' })
    expect(validateMutationRequest(req)).toBeNull()
  })

  it('passes when Content-Type is absent (bodyless DELETE / action routes)', () => {
    const req = makeRequest({ origin: 'https://fostrfind.com', method: 'DELETE' })
    expect(validateMutationRequest(req)).toBeNull()
  })

  it('blocks an unexpected content type', () => {
    const req = makeRequest({ origin: 'https://fostrfind.com', contentType: 'text/plain' })
    const res = validateMutationRequest(req)
    expect(res).not.toBeNull()
    expect(res?.status).toBe(415)
  })

  it('passes multipart/form-data when explicitly allowed', () => {
    const req = makeRequest({
      origin: 'https://fostrfind.com',
      contentType: 'multipart/form-data; boundary=----WebKitFormBoundary',
    })
    expect(validateMutationRequest(req, ['multipart/form-data'])).toBeNull()
  })
})
