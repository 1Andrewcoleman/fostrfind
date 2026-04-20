import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DEV_MODE } from '@/lib/constants'
import {
  buildUploadPath,
  uploadImage,
  validateBucketName,
  validateImageFile,
} from '@/lib/storage'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'

/**
 * POST /api/upload/photo
 *
 * Multipart body:
 *   - file      : File (required, jpg/png/webp ≤ 10 MB)
 *   - bucket    : string (required, one of STORAGE_BUCKET_VALUES)
 *
 * Returns: { url, path } on success.
 *
 * Auth: any signed-in user can upload to any of the three public
 * buckets. The storage path is forced to `{userId}/{uuid}.{ext}` so
 * the "owner can delete" RLS policy works correctly — callers cannot
 * specify a path or overwrite someone else's file.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (DEV_MODE) {
    // No real Supabase to talk to — return a placeholder that keeps
    // form submissions usable for UI work, but cannot be actually
    // rendered (invalid hostname). Document this behavior in the stub.
    return NextResponse.json(
      { url: 'https://placeholder.supabase.co/dev-mode-upload.jpg', path: 'dev/placeholder.jpg' },
      { status: 200 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError) {
    console.error('[upload/photo] getUser failed:', authError.message)
    return NextResponse.json({ error: 'Authentication service unavailable' }, { status: 503 })
  }
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Uploads are expensive (bandwidth + storage writes). Cap at 30 per
  // minute per user — enough for realistic profile/dog onboarding flows
  // but well below what a script could exfiltrate our storage quota with.
  const rl = rateLimit('upload:photo', user.id, { limit: 30, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl)

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid multipart body' }, { status: 400 })
  }

  const file = formData.get('file')
  const bucketRaw = formData.get('bucket')

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file' }, { status: 400 })
  }

  const bucketResult = validateBucketName(typeof bucketRaw === 'string' ? bucketRaw : null)
  if (!bucketResult.ok) {
    return NextResponse.json(
      { error: `Invalid bucket "${bucketResult.received ?? ''}"` },
      { status: 400 },
    )
  }

  const fileError = validateImageFile(file)
  if (fileError) {
    if (fileError.kind === 'too-large') {
      return NextResponse.json(
        { error: 'File is too large. Maximum size is 10 MB.' },
        { status: 413 },
      )
    }
    if (fileError.kind === 'invalid-type') {
      return NextResponse.json(
        { error: 'Unsupported file type. Use JPEG, PNG, or WebP.' },
        { status: 415 },
      )
    }
    return NextResponse.json({ error: 'Empty file' }, { status: 400 })
  }

  const path = buildUploadPath(user.id, file)
  const result = await uploadImage(supabase, bucketResult.bucket, path, file)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ url: result.url, path: result.path })
}
