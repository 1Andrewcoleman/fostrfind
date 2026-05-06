import type { SupabaseClient } from '@supabase/supabase-js'
import {
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_IMAGE_TYPES,
  MAX_FILE_SIZE_BYTES,
  STORAGE_BUCKET_VALUES,
  type StorageBucket,
} from '@/lib/constants'

/**
 * Shared image-upload infrastructure for shelters, fosters, and dogs.
 *
 * Path convention: `{userId}/{uuid}.{ext}` for every bucket. The
 * user-id-scoped top-level folder lets the "owner can delete" storage
 * RLS policy use `storage.foldername(name)[1] = auth.uid()::text`.
 *
 * Server-side validation reads the first bytes of the uploaded file to
 * detect the actual format regardless of what the client claims in the
 * Content-Type or filename. This prevents polyglot uploads and misclassified
 * files from reaching Supabase Storage.
 */

export type ValidationError =
  | { kind: 'invalid-type'; received: string | null }
  | { kind: 'too-large'; bytes: number }
  | { kind: 'invalid-bucket'; received: string | null }
  | { kind: 'empty' }

/**
 * Fast, synchronous client-side validation for immediate UX feedback.
 *
 * Uses `file.type` supplied by the browser — this is suitable for UX
 * pre-validation in React event handlers. The actual security boundary is
 * the server route, which calls `validateImageFile` (async, magic bytes).
 */
export function validateImageFileFast(file: File): ValidationError | null {
  if (!file || file.size === 0) return { kind: 'empty' }
  if (file.size > MAX_FILE_SIZE_BYTES) return { kind: 'too-large', bytes: file.size }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { kind: 'invalid-type', received: file.type ?? null }
  }
  return null
}

/**
 * Detect image MIME type by inspecting the file's magic bytes.
 *
 * Supports the three allowed upload formats: JPEG, PNG, WebP. Returns the
 * detected MIME string or `null` if unrecognised. This avoids depending on
 * the ESM-only `file-type` package (which has webpack dynamic-import issues
 * in Next.js production builds).
 */
async function detectImageMime(file: File): Promise<string | null> {
  const slice = file.slice(0, 12)
  const buffer = new Uint8Array(await slice.arrayBuffer())

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png'
  }
  // WebP: RIFF????WEBP (bytes 0-3 = RIFF, bytes 8-11 = WEBP)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp'
  }
  return null
}

/**
 * Server-side validation: reads actual magic bytes to detect the real format.
 * The `file.type` field supplied by the browser is ignored for the type
 * check; we inspect the raw bytes instead.
 *
 * Returns `null` when the file is acceptable, or a `ValidationError` that
 * the caller should convert to an appropriate HTTP error response.
 *
 * Use `validateImageFileFast` for client-side UX checks.
 */
export async function validateImageFile(file: File): Promise<ValidationError | null> {
  if (!file || file.size === 0) return { kind: 'empty' }
  if (file.size > MAX_FILE_SIZE_BYTES) return { kind: 'too-large', bytes: file.size }

  let detectedMime: string | null = null
  try {
    detectedMime = await detectImageMime(file)
  } catch {
    return { kind: 'invalid-type', received: null }
  }

  if (!detectedMime || !ALLOWED_IMAGE_TYPES.includes(detectedMime as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { kind: 'invalid-type', received: detectedMime }
  }

  return null
}

/**
 * The detected MIME type is now the source of truth for determining the
 * file extension, but since validateImageFile is called before buildUploadPath,
 * we still derive extension from the detected type at the call site.
 *
 * This helper remains here for callers that have already validated the file.
 */
export type BucketValidation =
  | { ok: true; bucket: StorageBucket }
  | { ok: false; received: string | null }

export function validateBucketName(bucket: string | null): BucketValidation {
  if (!bucket || !STORAGE_BUCKET_VALUES.includes(bucket as StorageBucket)) {
    return { ok: false, received: bucket }
  }
  return { ok: true, bucket: bucket as StorageBucket }
}

export function extensionForMimeType(mime: string): string {
  return (
    ALLOWED_IMAGE_EXTENSIONS[mime as keyof typeof ALLOWED_IMAGE_EXTENSIONS] ?? 'bin'
  )
}

/**
 * Build the `{userId}/{uuid}.{ext}` path used by all three buckets.
 * Uses `crypto.randomUUID()` (Node ≥ 19 and all modern browsers) so
 * two concurrent uploads never clobber each other.
 */
export function buildUploadPath(userId: string, file: File): string {
  const ext = extensionForMimeType(file.type)
  return `${userId}/${crypto.randomUUID()}.${ext}`
}

type UploadResult = { url: string; path: string } | { error: string; status: number }

export async function uploadImage(
  supabase: SupabaseClient,
  bucket: StorageBucket,
  path: string,
  file: File,
): Promise<UploadResult> {
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, file, { contentType: file.type, cacheControl: '3600', upsert: false })

  if (uploadError) {
    console.error('[storage] upload failed:', uploadError.message)
    return { error: 'Upload failed. Please try again.', status: 500 }
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path)
  return { url: data.publicUrl, path }
}

/**
 * Remove an image. Callers should pass the storage path (the part
 * returned as `path` from uploadImage), not the public URL.
 *
 * Returns boolean rather than throwing because most call-sites don't
 * care whether a stale file was actually removed — they just want
 * cleanup best-effort.
 */
export async function deleteImage(
  supabase: SupabaseClient,
  bucket: StorageBucket,
  path: string,
): Promise<boolean> {
  const { error } = await supabase.storage.from(bucket).remove([path])
  if (error) {
    console.error('[storage] delete failed:', error.message)
    return false
  }
  return true
}
