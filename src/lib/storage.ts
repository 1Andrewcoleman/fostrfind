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
 * This module intentionally stays small and synchronous-looking: real
 * image processing (resize, EXIF strip) happens client-side in the
 * browser with Canvas. The server's job is to authenticate, validate,
 * and hand the already-small bytes to Supabase Storage.
 *
 * Path convention: `{userId}/{uuid}.{ext}` for every bucket. The
 * user-id-scoped top-level folder lets the "owner can delete" storage
 * RLS policy use `storage.foldername(name)[1] = auth.uid()::text`.
 */

export type ValidationError =
  | { kind: 'invalid-type'; received: string | null }
  | { kind: 'too-large'; bytes: number }
  | { kind: 'invalid-bucket'; received: string | null }
  | { kind: 'empty' }

export function validateImageFile(file: File): ValidationError | null {
  if (!file || file.size === 0) return { kind: 'empty' }
  if (file.size > MAX_FILE_SIZE_BYTES) return { kind: 'too-large', bytes: file.size }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { kind: 'invalid-type', received: file.type ?? null }
  }
  return null
}

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
