/**
 * Client-only image utilities. Do not import from server components.
 *
 * Primary responsibility: resize user-selected images in the browser
 * before uploading. Keeps `/api/upload/photo` fast and bounded, and
 * reduces Supabase Storage cost. See Roadmap Phase 1 Step 8 for the
 * server-side rationale for doing resize here rather than on the server.
 */

/** Longest edge cap in pixels. Chosen to cover any reasonable phone / DSLR shot
 * when displayed on a mobile browse grid, dog detail, or foster profile. */
export const MAX_IMAGE_DIMENSION = 1200

/** JPEG quality for re-encoded photos. 0.85 is visually indistinguishable
 * from source for natural photography while cutting bytes ~3×. */
const JPEG_QUALITY = 0.85

/**
 * Resize and re-encode to JPEG. Respects EXIF orientation (phones often
 * store landscape-display images as portrait+rotation).
 *
 * Silently falls back to the original file if:
 *   - the browser lacks `createImageBitmap`
 *   - the image cannot be decoded
 *   - the Canvas 2D context cannot be obtained
 *   - the resulting Blob is empty
 *
 * Callers should treat the return value as "the file to upload" and not
 * rely on the name or mime matching the input.
 */
export async function resizeImageForUpload(file: File): Promise<File> {
  if (typeof createImageBitmap !== 'function') return file

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    return file
  }

  try {
    const { width, height } = bitmap
    const longest = Math.max(width, height)
    const scale = longest > MAX_IMAGE_DIMENSION ? MAX_IMAGE_DIMENSION / longest : 1
    const targetW = Math.round(width * scale)
    const targetH = Math.round(height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)

    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    if (!blob || blob.size === 0) return file

    const renamed = file.name.replace(/\.[^.]+$/, '') + '.jpg'
    return new File([blob], renamed, { type: 'image/jpeg', lastModified: Date.now() })
  } finally {
    bitmap.close()
  }
}
