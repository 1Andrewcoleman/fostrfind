'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useRouter } from 'next/navigation'
import { Loader2, Upload, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Dog } from '@/types/database'
import {
  ALLOWED_IMAGE_TYPES,
  DEV_MODE,
  DOG_AGES,
  DOG_GENDERS,
  DOG_SIZES,
  MAX_DOG_PHOTOS,
  STORAGE_BUCKETS,
} from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import { resizeImageForUpload } from '@/lib/client-image'
import { validateImageFile } from '@/lib/storage'

const dogSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  breed: z.string().optional(),
  age: z.enum(['puppy', 'young', 'adult', 'senior']).optional(),
  size: z.enum(['small', 'medium', 'large', 'xl']).optional(),
  gender: z.enum(['male', 'female']).optional(),
  temperament: z.string().optional(),
  medical_status: z.string().optional(),
  special_needs: z.string().optional(),
  description: z.string().optional(),
})

type DogFormValues = z.infer<typeof dogSchema>

interface DogFormProps {
  mode: 'create' | 'edit'
  dogId?: string
  initialData?: Partial<Dog>
}

export function DogForm({ mode, dogId, initialData }: DogFormProps) {
  const router = useRouter()
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ---- Photo state --------------------------------------------------------
  // existing = URLs already saved on the dog record (populated when editing)
  // pending  = File objects the user picked this session; paired with blob
  //           URLs for preview. Pending files are resized + uploaded on
  //           submit, never on file-select, so cancelling the form doesn't
  //           leave orphaned objects in Storage.
  const [existingPhotos, setExistingPhotos] = useState<string[]>(
    initialData?.photos ?? [],
  )
  const [pendingFiles, setPendingFiles] = useState<File[]>([])
  const [pendingPreviews, setPendingPreviews] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Revoke blob URLs on unmount so the browser reclaims the bytes. This
  // effect intentionally reads pendingPreviews via the ref-like closure
  // pattern: we only care about cleanup-at-unmount, not on every change.
  useEffect(() => {
    const urls = pendingPreviews
    return () => {
      urls.forEach(URL.revokeObjectURL)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalPhotos = existingPhotos.length + pendingFiles.length
  const canAddMore = totalPhotos < MAX_DOG_PHOTOS

  function handleFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(event.target.files ?? [])
    if (picked.length === 0) return

    const remaining = MAX_DOG_PHOTOS - totalPhotos
    if (remaining <= 0) {
      toast.error(`You can attach at most ${MAX_DOG_PHOTOS} photos.`)
      event.target.value = ''
      return
    }

    const accepted: File[] = []
    const rejectedTooLarge: string[] = []
    const rejectedType: string[] = []

    for (const file of picked.slice(0, remaining)) {
      const problem = validateImageFile(file)
      if (!problem) {
        accepted.push(file)
        continue
      }
      if (problem.kind === 'too-large') rejectedTooLarge.push(file.name)
      else if (problem.kind === 'invalid-type') rejectedType.push(file.name)
    }

    if (picked.length > remaining) {
      toast.error(
        `Only added ${accepted.length} — already at the ${MAX_DOG_PHOTOS}-photo limit.`,
      )
    }
    if (rejectedTooLarge.length > 0) {
      toast.error(`Too large (max 10 MB): ${rejectedTooLarge.join(', ')}`)
    }
    if (rejectedType.length > 0) {
      toast.error(`Unsupported type (need JPEG/PNG/WebP): ${rejectedType.join(', ')}`)
    }

    if (accepted.length > 0) {
      const newPreviews = accepted.map((f) => URL.createObjectURL(f))
      setPendingFiles((prev) => [...prev, ...accepted])
      setPendingPreviews((prev) => [...prev, ...newPreviews])
    }

    // Reset the input so selecting the SAME file again triggers onChange.
    event.target.value = ''
  }

  function removeExistingPhoto(index: number) {
    setExistingPhotos((prev) => prev.filter((_, i) => i !== index))
  }

  function removePendingPhoto(index: number) {
    const url = pendingPreviews[index]
    if (url) URL.revokeObjectURL(url)
    setPendingFiles((prev) => prev.filter((_, i) => i !== index))
    setPendingPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  /** Sequentially resize + upload each pending file. Returns the new URLs
   * in the same order as pendingFiles. Throws on first failure so the
   * caller can abort the whole save (partial photos would be confusing). */
  async function uploadPendingFiles(): Promise<string[]> {
    if (pendingFiles.length === 0) return []
    setUploading(true)
    const urls: string[] = []
    try {
      for (const file of pendingFiles) {
        const prepared = await resizeImageForUpload(file)
        const formData = new FormData()
        formData.append('file', prepared)
        formData.append('bucket', STORAGE_BUCKETS.DOG_PHOTOS)
        const res = await fetch('/api/upload/photo', {
          method: 'POST',
          body: formData,
        })
        const body = await res.json().catch(() => ({ error: 'Upload failed' }))
        if (!res.ok) {
          throw new Error(
            typeof body?.error === 'string' ? body.error : 'Upload failed',
          )
        }
        urls.push(body.url as string)
      }
    } finally {
      setUploading(false)
    }
    return urls
  }

  const form = useForm<DogFormValues>({
    resolver: zodResolver(dogSchema),
    defaultValues: {
      name: initialData?.name ?? '',
      breed: initialData?.breed ?? '',
      age: initialData?.age ?? undefined,
      size: initialData?.size ?? undefined,
      gender: initialData?.gender ?? undefined,
      temperament: initialData?.temperament ?? '',
      medical_status: initialData?.medical_status ?? '',
      special_needs: initialData?.special_needs ?? '',
      description: initialData?.description ?? '',
    },
  })

  async function onSubmit(values: DogFormValues) {
    setSubmitError(null)

    if (DEV_MODE) {
      router.push('/shelter/dogs')
      return
    }

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSubmitError('You must be logged in.'); return }

    const { data: shelterRow } = await supabase
      .from('shelters')
      .select('id')
      .eq('user_id', user.id)
      .single()
    if (!shelterRow) { setSubmitError('No shelter profile found.'); return }

    // Upload any newly-picked photos before writing to the dogs row.
    // If any upload fails we abort the save entirely — a dog record with
    // half the photos would leave the user without a clear recovery.
    let uploadedUrls: string[] = []
    try {
      uploadedUrls = await uploadPendingFiles()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Photo upload failed.'
      setSubmitError(message)
      toast.error(message)
      return
    }

    const photos = [...existingPhotos, ...uploadedUrls]

    const payload = {
      ...values,
      breed: values.breed || null,
      age: values.age || null,
      size: values.size || null,
      gender: values.gender || null,
      temperament: values.temperament || null,
      medical_status: values.medical_status || null,
      special_needs: values.special_needs || null,
      description: values.description || null,
      photos,
    }

    if (mode === 'create') {
      const { error } = await supabase.from('dogs').insert({
        shelter_id: shelterRow.id,
        ...payload,
      })
      if (error) { setSubmitError(error.message); return }
    } else {
      const { error } = await supabase
        .from('dogs')
        .update(payload)
        .eq('id', dogId!)
      if (error) { setSubmitError(error.message); return }
    }

    router.push('/shelter/dogs')
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {submitError && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">{submitError}</p>
        )}
        {/* Photo Upload */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between">
            <Label>Photos (max {MAX_DOG_PHOTOS})</Label>
            <span className="text-xs text-muted-foreground">
              {totalPhotos} / {MAX_DOG_PHOTOS}
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_IMAGE_TYPES.join(',')}
            multiple
            className="sr-only"
            onChange={handleFilesSelected}
            aria-hidden="true"
            tabIndex={-1}
          />

          {canAddMore && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-primary hover:bg-muted/30 focus-visible:border-primary focus-visible:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Click to add photo{totalPhotos === 0 ? 's' : ''}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                JPEG, PNG, or WebP up to 10 MB each
              </p>
            </button>
          )}

          {(existingPhotos.length > 0 || pendingPreviews.length > 0) && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {existingPhotos.map((url, i) => (
                <PhotoThumb
                  key={`existing-${url}`}
                  src={url}
                  onRemove={() => removeExistingPhoto(i)}
                />
              ))}
              {pendingPreviews.map((url, i) => (
                <PhotoThumb
                  key={`pending-${url}`}
                  src={url}
                  pending
                  onRemove={() => removePendingPhoto(i)}
                />
              ))}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Dog Name *</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Buddy" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="breed"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Breed</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Labrador Mix" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="age"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Age</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select age range" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DOG_AGES.map((age) => (
                      <SelectItem key={age} value={age} className="capitalize">
                        {age.charAt(0).toUpperCase() + age.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="size"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Size</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select size" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DOG_SIZES.map((size) => (
                      <SelectItem key={size} value={size} className="capitalize">
                        {size === 'xl' ? 'XL' : size.charAt(0).toUpperCase() + size.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="gender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Gender</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DOG_GENDERS.map((g) => (
                      <SelectItem key={g} value={g} className="capitalize">
                        {g.charAt(0).toUpperCase() + g.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="temperament"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Temperament</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the dog's personality and behavior..."
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="medical_status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Medical Status</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. Vaccinated, spayed, heartworm negative..."
                  rows={2}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="special_needs"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Special Needs</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. No cats, needs medication twice daily..."
                  rows={2}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Tell fosters everything they need to know about this dog..."
                  rows={5}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button type="submit" disabled={uploading || form.formState.isSubmitting}>
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading photos…
              </>
            ) : form.formState.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : mode === 'create' ? (
              'Add Dog'
            ) : (
              'Save Changes'
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={uploading || form.formState.isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Form>
  )
}

interface PhotoThumbProps {
  src: string
  pending?: boolean
  onRemove: () => void
}

function PhotoThumb({ src, pending, onRemove }: PhotoThumbProps) {
  return (
    <div className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
      <Image
        src={src}
        alt=""
        fill
        sizes="(min-width: 640px) 25vw, 33vw"
        className="object-cover"
        /* Blob URLs can't go through next/image's optimizer. */
        unoptimized={pending}
      />
      {pending && (
        <span className="absolute bottom-1 left-1 rounded bg-black/60 text-white text-[10px] uppercase tracking-wide px-1.5 py-0.5">
          New
        </span>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="absolute top-1 right-1 rounded-full bg-black/60 text-white p-1 hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Remove photo"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  )
}
