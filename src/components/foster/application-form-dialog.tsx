'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { DEV_MODE } from '@/lib/constants'
import {
  applicationCreateSchema,
  type ApplicationCreateInput,
} from '@/lib/schemas'

interface ApplicationFormDialogProps {
  dogId: string
  dogName: string
  shelterId: string
  /** Currently unused inside the dialog body but kept on the prop
   * surface so future copy ("Apply to {shelter} for {dog}") can read
   * it without re-plumbing the parent. */
  shelterName: string
  /** True when the foster already has a row on this dog. Disables the
   * trigger and swaps its label to "Application Submitted". */
  alreadyApplied: boolean
  /** Called after a successful submit so the parent can flip its local
   * "applied" state without waiting for a router refresh round-trip. */
  onAppliedSuccess?: () => void
}

// Replicates the visual treatment of the shadcn Input component so the
// native date control sits flush with the rest of the form. We use a
// raw <input type="date"> rather than the wrapped Input because iOS
// Safari falls back to a free-text field unless type="date" is set on
// the literal element — see the Step 46 pitfall in FinalRoadmap.
const DATE_INPUT_CLASSNAME = cn(
  'flex h-11 md:h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background',
  'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
)

const WHY_MAX = 1000
const NOTE_MAX = 1000

export function ApplicationFormDialog({
  dogId,
  dogName,
  shelterId,
  shelterName: _shelterName,
  alreadyApplied,
  onAppliedSuccess,
}: ApplicationFormDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setError,
    formState: { errors },
  } = useForm<ApplicationCreateInput>({
    resolver: zodResolver(applicationCreateSchema),
    defaultValues: {
      dog_id: dogId,
      shelter_id: shelterId,
      available_from: '',
      available_until: '',
      why_this_dog: '',
      emergency_contact_name: '',
      emergency_contact_phone: '',
      responsibilities_acknowledged: false,
      note: '',
    },
  })

  const whyValue = watch('why_this_dog') ?? ''
  const noteValue = watch('note') ?? ''

  function handleOpenChange(next: boolean) {
    if (submitting) return
    setOpen(next)
    if (!next) {
      reset()
    }
  }

  async function onSubmit(values: ApplicationCreateInput) {
    setSubmitting(true)

    if (DEV_MODE) {
      // In DEV_MODE there is no real Supabase, so short-circuit the
      // submit and behave as though the API returned 201. This mirrors
      // the existing DogDetailFull DEV_MODE branch.
      toast.success('Application submitted!')
      setOpen(false)
      reset()
      onAppliedSuccess?.()
      setSubmitting(false)
      return
    }

    let response: Response
    try {
      response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
    } catch (e) {
      console.error(
        '[application-form] network error:',
        e instanceof Error ? e.message : String(e),
      )
      toast.error('Network error. Please check your connection and try again.')
      setSubmitting(false)
      return
    }

    if (response.ok) {
      toast.success('Application submitted!')
      setOpen(false)
      reset()
      onAppliedSuccess?.()
      router.refresh()
      setSubmitting(false)
      return
    }

    let errorBody: {
      error?: string
      details?: Record<string, string[] | undefined>
    } = {}
    try {
      errorBody = await response.json()
    } catch {
      // Response had no JSON body — fall through to generic error.
    }

    if (response.status === 422 && errorBody.details) {
      // Surface the API's field-level validation errors inline. This
      // path is rare (the same Zod schema runs on the client first)
      // but covers schema/version drift between client and server.
      for (const [field, messages] of Object.entries(errorBody.details)) {
        if (messages && messages.length > 0) {
          setError(field as keyof ApplicationCreateInput, {
            type: 'server',
            message: messages[0],
          })
        }
      }
      setSubmitting(false)
      return
    }

    if (response.status === 409) {
      toast.error(errorBody.error ?? 'You have already applied for this dog')
      setSubmitting(false)
      return
    }

    if (response.status === 401) {
      toast.error('Please sign back in and try again.')
      setSubmitting(false)
      return
    }

    if (response.status === 429) {
      toast.error('Too many requests. Please wait a moment and try again.')
      setSubmitting(false)
      return
    }

    toast.error('Something went wrong. Please try again.')
    setSubmitting(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="lg" disabled={alreadyApplied}>
          {alreadyApplied
            ? 'Application Submitted'
            : `Apply to Foster ${dogName}`}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply to foster {dogName}</DialogTitle>
          <DialogDescription>
            Tell the shelter a bit about your availability and why
            you&apos;d be a great match.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-4 pt-2"
          noValidate
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="available_from">Available from</Label>
              <input
                id="available_from"
                type="date"
                className={DATE_INPUT_CLASSNAME}
                aria-invalid={errors.available_from ? 'true' : undefined}
                {...register('available_from')}
              />
              {errors.available_from && (
                <p className="text-xs text-destructive">
                  {errors.available_from.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="available_until">
                Available until{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <input
                id="available_until"
                type="date"
                className={DATE_INPUT_CLASSNAME}
                aria-invalid={errors.available_until ? 'true' : undefined}
                {...register('available_until')}
              />
              {errors.available_until && (
                <p className="text-xs text-destructive">
                  {errors.available_until.message}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="why_this_dog">
              Why do you want to foster {dogName}?
            </Label>
            <Textarea
              id="why_this_dog"
              rows={4}
              maxLength={WHY_MAX}
              placeholder="Share what drew you to this dog and how you'd care for them..."
              aria-invalid={errors.why_this_dog ? 'true' : undefined}
              {...register('why_this_dog')}
            />
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  'text-xs',
                  errors.why_this_dog ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {errors.why_this_dog?.message ?? 'At least a few sentences.'}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {whyValue.length}/{WHY_MAX}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="emergency_contact_name">Emergency contact name</Label>
              <Input
                id="emergency_contact_name"
                autoComplete="name"
                aria-invalid={errors.emergency_contact_name ? 'true' : undefined}
                {...register('emergency_contact_name')}
              />
              {errors.emergency_contact_name && (
                <p className="text-xs text-destructive">
                  {errors.emergency_contact_name.message}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="emergency_contact_phone">Emergency contact phone</Label>
              <Input
                id="emergency_contact_phone"
                type="tel"
                autoComplete="tel"
                aria-invalid={errors.emergency_contact_phone ? 'true' : undefined}
                {...register('emergency_contact_phone')}
              />
              {errors.emergency_contact_phone && (
                <p className="text-xs text-destructive">
                  {errors.emergency_contact_phone.message}
                </p>
              )}
            </div>
          </div>

          <Controller
            control={control}
            name="responsibilities_acknowledged"
            render={({ field }) => (
              <div className="space-y-1.5">
                <div className="flex items-start gap-3 rounded-md border p-3">
                  <Checkbox
                    id="responsibilities_acknowledged"
                    checked={field.value === true}
                    onCheckedChange={(checked) => field.onChange(checked === true)}
                    aria-invalid={
                      errors.responsibilities_acknowledged ? 'true' : undefined
                    }
                    className="mt-0.5"
                  />
                  <Label
                    htmlFor="responsibilities_acknowledged"
                    className="text-sm font-normal leading-snug cursor-pointer"
                  >
                    I understand that fostering is a commitment and I will
                    communicate openly with the shelter about any concerns.
                  </Label>
                </div>
                {errors.responsibilities_acknowledged && (
                  <p className="text-xs text-destructive">
                    {errors.responsibilities_acknowledged.message}
                  </p>
                )}
              </div>
            )}
          />

          <div className="space-y-1.5">
            <Label htmlFor="note">
              Anything else you need us to know?{' '}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="note"
              rows={3}
              maxLength={NOTE_MAX}
              placeholder="Schedule details, questions for the shelter, or anything else."
              aria-invalid={errors.note ? 'true' : undefined}
              {...register('note')}
            />
            <div className="flex items-center justify-between gap-2">
              <p
                className={cn(
                  'text-xs',
                  errors.note ? 'text-destructive' : 'text-muted-foreground',
                )}
              >
                {errors.note?.message ?? ''}
              </p>
              <p className="text-xs text-muted-foreground tabular-nums">
                {noteValue.length}/{NOTE_MAX}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Submit Application'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
