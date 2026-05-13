import { describe, it, expect } from 'vitest'
import {
  buildUploadPath,
  extensionForMimeType,
  validateBucketName,
  validateImageFileFast,
  validateImageFile,
} from '@/lib/storage'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(opts: { size?: number; type?: string; bytes?: number[] }): File {
  const size = opts.size ?? 100
  const type = opts.type ?? 'image/jpeg'
  const raw = opts.bytes
    ? new Uint8Array(opts.bytes)
    : new Uint8Array(size)
  return new File([raw], 'test.jpg', { type })
}

// Magic byte sequences
const JPEG_MAGIC = [0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]
const PNG_MAGIC  = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]
const WEBP_MAGIC = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]
const BAD_MAGIC  = [0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b]

// ---------------------------------------------------------------------------
// validateImageFileFast
// ---------------------------------------------------------------------------

describe('validateImageFileFast', () => {
  it('returns null for a valid JPEG', () => {
    expect(validateImageFileFast(makeFile({ type: 'image/jpeg' }))).toBeNull()
  })

  it('returns null for PNG and WebP', () => {
    expect(validateImageFileFast(makeFile({ type: 'image/png' }))).toBeNull()
    expect(validateImageFileFast(makeFile({ type: 'image/webp' }))).toBeNull()
  })

  it('rejects empty file', () => {
    const f = makeFile({ size: 0 })
    expect(validateImageFileFast(f)).toMatchObject({ kind: 'empty' })
  })

  it('rejects file over 10 MB', () => {
    const f = makeFile({ size: 11 * 1024 * 1024 })
    expect(validateImageFileFast(f)).toMatchObject({ kind: 'too-large' })
  })

  it('rejects unsupported MIME type', () => {
    const f = makeFile({ type: 'image/gif' })
    expect(validateImageFileFast(f)).toMatchObject({ kind: 'invalid-type' })
  })
})

// ---------------------------------------------------------------------------
// validateImageFile (magic bytes, async)
// ---------------------------------------------------------------------------

describe('validateImageFile', () => {
  it('accepts a real JPEG and returns its detected MIME', async () => {
    const f = makeFile({ bytes: JPEG_MAGIC, type: 'image/jpeg' })
    const result = await validateImageFile(f)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.detectedMime).toBe('image/jpeg')
  })

  it('accepts a real PNG and returns its detected MIME', async () => {
    const f = makeFile({ bytes: PNG_MAGIC, type: 'image/png' })
    const result = await validateImageFile(f)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.detectedMime).toBe('image/png')
  })

  it('accepts a real WebP and returns its detected MIME', async () => {
    const f = makeFile({ bytes: WEBP_MAGIC, type: 'image/webp' })
    const result = await validateImageFile(f)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.detectedMime).toBe('image/webp')
  })

  it('detects JPEG even when client claims PNG (uses magic bytes, not file.type)', async () => {
    const f = makeFile({ bytes: JPEG_MAGIC, type: 'image/png' })
    const result = await validateImageFile(f)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.detectedMime).toBe('image/jpeg')
  })

  it('rejects unknown magic bytes regardless of claimed MIME', async () => {
    const f = makeFile({ bytes: BAD_MAGIC, type: 'image/jpeg' })
    const result = await validateImageFile(f)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('invalid-type')
  })

  it('rejects empty file', async () => {
    const f = makeFile({ size: 0 })
    const result = await validateImageFile(f)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('empty')
  })

  it('rejects file over 10 MB', async () => {
    const f = makeFile({ size: 11 * 1024 * 1024 })
    const result = await validateImageFile(f)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error.kind).toBe('too-large')
  })
})

// ---------------------------------------------------------------------------
// validateBucketName
// ---------------------------------------------------------------------------

describe('validateBucketName', () => {
  it('accepts valid bucket names', () => {
    expect(validateBucketName('dog-photos')).toMatchObject({ ok: true, bucket: 'dog-photos' })
    expect(validateBucketName('shelter-logos')).toMatchObject({ ok: true, bucket: 'shelter-logos' })
    expect(validateBucketName('foster-avatars')).toMatchObject({ ok: true, bucket: 'foster-avatars' })
  })

  it('rejects unknown bucket names', () => {
    expect(validateBucketName('evil-bucket')).toMatchObject({ ok: false })
    expect(validateBucketName('')).toMatchObject({ ok: false })
    expect(validateBucketName(null)).toMatchObject({ ok: false })
  })
})

// ---------------------------------------------------------------------------
// extensionForMimeType
// ---------------------------------------------------------------------------

describe('extensionForMimeType', () => {
  it('maps known types correctly', () => {
    expect(extensionForMimeType('image/jpeg')).toBe('jpg')
    expect(extensionForMimeType('image/png')).toBe('png')
    expect(extensionForMimeType('image/webp')).toBe('webp')
  })

  it('falls back to bin for unknown types', () => {
    expect(extensionForMimeType('image/gif')).toBe('bin')
  })
})

// ---------------------------------------------------------------------------
// buildUploadPath
// ---------------------------------------------------------------------------

describe('buildUploadPath', () => {
  it('uses the detected MIME for the extension, not anything from the file', () => {
    const path = buildUploadPath('user-123', 'image/jpeg')
    expect(path).toMatch(/^user-123\/[0-9a-f-]+\.jpg$/)
  })

  it('generates a unique path on every call', () => {
    const a = buildUploadPath('user-123', 'image/png')
    const b = buildUploadPath('user-123', 'image/png')
    expect(a).not.toBe(b)
  })
})
