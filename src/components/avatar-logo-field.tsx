'use client'

import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type ChangeEvent,
} from 'react'
import Image from 'next/image'
import { ImageIcon, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { ALLOWED_IMAGE_TYPES, type StorageBucket } from '@/lib/constants'
import {
  storagePathFromPublicUrl,
  uploadSingleImage,
} from '@/lib/client-image'
import { createClient } from '@/lib/supabase/client'
import { validateImageFile } from '@/lib/storage'

interface AvatarLogoFieldProps {
  /** URL already saved in the DB, or null. Treated as the initial
   *  value; the component takes over state after the first interaction. */
  initialUrl: string | null
  /** Target Supabase Storage bucket. */
  bucket: StorageBucket
  /** Render shape — circle for avatars, rounded square for logos. */
  shape: 'circle' | 'square'
  /** Visible label on the left of the image. */
  label: string
  /** Helper text under the buttons. */
  helperText?: string
}

export interface AvatarLogoFieldHandle {
  /** Run pending upload + old-file cleanup. Call from the form's
   *  onSubmit BEFORE writing the entity to the DB. Returns the URL
   *  that should be saved (or null if the image was cleared).
   *  Throws with a user-safe message on upload failure. */
  flush: () => Promise<string | null>
}

/**
 * Single-image field shared by foster profile (avatar) and shelter
 * settings (logo). Uses the same upload infrastructure as DogForm's
 * multi-image uploader; the difference is at most one file and a
 * previous-file-delete on replace.
 */
export const AvatarLogoField = forwardRef<AvatarLogoFieldHandle, AvatarLogoFieldProps>(
  function AvatarLogoField(
    { initialUrl, bucket, shape, label, helperText },
    ref,
  ) {
    const [currentUrl, setCurrentUrl] = useState<string | null>(initialUrl)
    const [pendingFile, setPendingFile] = useState<File | null>(null)
    const [pendingPreview, setPendingPreview] = useState<string | null>(null)
    const [uploading, setUploading] = useState(false)
    const fileInputRef = useRef<HTMLInputElement>(null)

    const displayUrl = pendingPreview ?? currentUrl

    function handleFileSelected(e: ChangeEvent<HTMLInputElement>) {
      const file = e.target.files?.[0]
      if (!file) return

      const problem = validateImageFile(file)
      if (problem) {
        if (problem.kind === 'too-large') {
          toast.error('File is too large. Maximum 10 MB.')
        } else if (problem.kind === 'invalid-type') {
          toast.error('Unsupported file type. Use JPEG, PNG, or WebP.')
        } else {
          toast.error('Empty file.')
        }
        e.target.value = ''
        return
      }

      if (pendingPreview) URL.revokeObjectURL(pendingPreview)
      setPendingFile(file)
      setPendingPreview(URL.createObjectURL(file))
      // Reset the input so picking the same file twice re-triggers.
      e.target.value = ''
    }

    function handleRemove() {
      if (pendingPreview) URL.revokeObjectURL(pendingPreview)
      setPendingFile(null)
      setPendingPreview(null)
      setCurrentUrl(null)
    }

    useImperativeHandle(
      ref,
      () => ({
        async flush() {
          // No pending upload — the user either kept currentUrl or
          // cleared it via Remove. Either way, just report the state.
          if (!pendingFile) return currentUrl

          setUploading(true)
          try {
            const newUrl = await uploadSingleImage(pendingFile, bucket)

            // Best-effort cleanup of the previously-saved object. RLS
            // policy "storage.objects: owner can delete" enforces that
            // we can only remove files under our own userId folder.
            if (initialUrl && initialUrl !== newUrl) {
              const oldPath = storagePathFromPublicUrl(initialUrl, bucket)
              if (oldPath) {
                const supabase = createClient()
                await supabase.storage
                  .from(bucket)
                  .remove([oldPath])
                  .catch(() => {
                    // Orphan is fine — better than blocking the save.
                  })
              }
            }

            if (pendingPreview) URL.revokeObjectURL(pendingPreview)
            setPendingFile(null)
            setPendingPreview(null)
            setCurrentUrl(newUrl)
            return newUrl
          } finally {
            setUploading(false)
          }
        },
      }),
      [pendingFile, pendingPreview, currentUrl, initialUrl, bucket],
    )

    const shapeClass = shape === 'circle' ? 'rounded-full' : 'rounded-lg'

    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <input
          ref={fileInputRef}
          type="file"
          accept={ALLOWED_IMAGE_TYPES.join(',')}
          className="sr-only"
          onChange={handleFileSelected}
          aria-hidden="true"
          tabIndex={-1}
        />
        <div className="flex items-center gap-4">
          <div
            className={`relative h-16 w-16 overflow-hidden border bg-muted ${shapeClass}`}
          >
            {displayUrl ? (
              <Image
                src={displayUrl}
                alt=""
                fill
                sizes="64px"
                className="object-cover"
                /* Blob URLs from the preview stage can't go through
                 * next/image's optimizer. */
                unoptimized={pendingPreview === displayUrl}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  Uploading…
                </>
              ) : displayUrl ? (
                'Replace'
              ) : (
                'Upload'
              )}
            </Button>
            {displayUrl && !uploading && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="text-muted-foreground hover:text-destructive"
              >
                Remove
              </Button>
            )}
          </div>
        </div>
        {helperText && (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        )}
      </div>
    )
  },
)
