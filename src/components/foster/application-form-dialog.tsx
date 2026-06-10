'use client'

import { useEffect, useRef, useState } from 'react'
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
import {
  applicationDraftKey,
  parseDraft,
  serializeDraft,
} from '@/lib/application-draft'

/** Debounce window for persisting the in-progress draft. */
const DRAFT_SAVE_DELAY_MS = 500

interface ApplicationFormDialogProps {
  dogId: string
  dogName: string
  shelterId: string
  /** Shown in the messaging-disclosure line under the dialog header. */
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

/**
 * The native `<input type="date">` `min` attribute caps the picker at
 * the user's local calendar today, so a foster can't accidentally pick
 * a past date that the server would then reject. Computed in the
 * browser timezone (Intl), not UTC, so users in Western timezones late
 * in the evening don't see "today" greyed out.
 */
function todayLocalIso(): string {
  const now = new Date()
  // Intl with `en-CA` produces YYYY-MM-DD which the date input expects.
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function ApplicationFormDialog({
  dogId,
  dogName,
  shelterId,
  shelterName,
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
    setValue,
    getValues,
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
  const availableFromValue = watch('available_from') ?? ''
  const todayLocal = todayLocalIso()
  // `available_until` must be strictly after `available_from`; if no
  // start date is picked yet, fall back to today so the picker is still
  // useful instead of showing every past date as valid.
  const untilMin = availableFromValue || todayLocal

  // --- Draft persistence (sessionStorage, keyed by dog) ----------------
  // A mis-click or Esc used to destroy everything typed into the form.
  // While the dialog is open, field values are debounced into
  // sessionStorage; reopening restores them. The draft is cleared only
  // on a successful submit. All storage access is wrapped in try/catch
  // (private mode / quota) and happens in handlers/effects only.
  const draftKey = applicationDraftKey(dogId)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Set by clearDraft() after a successful submit; the watch subscriber
  // checks it so the reset() that follows (which notifies watch) cannot
  // schedule a save that would re-write an empty draft mid-navigation.
  const draftCleared = useRef(false)

  function clearDraft() {
    draftCleared.current = true
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
    }
    try {
      window.sessionStorage.removeItem(draftKey)
    } catch {
      // Storage unavailable — nothing to clear.
    }
  }

  useEffect(() => {
    if (!open) return
    const subscription = watch((values) => {
      if (draftCleared.current) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        if (draftCleared.current) return
        try {
          window.sessionStorage.setItem(draftKey, serializeDraft(values))
        } catch {
          // Storage unavailable (private mode / quota) — drafts degrade
          // gracefully to the previous lose-on-close behavior.
        }
      }, DRAFT_SAVE_DELAY_MS)
    })
    return () => subscription.unsubscribe()
  }, [open, watch, draftKey])

  // Clear any pending debounce on unmount so it can't fire after nav.
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [])

  function handleOpenChange(next: boolean) {
    if (submitting) return
    setOpen(next)
    if (next) {
      draftCleared.current = false
      // Restore any saved draft. reset() replaces values atomically, so
      // there is no race with the form's defaultValues; ids and the
      // consent checkbox always come from props/defaults, never storage.
      let draft = null
      try {
        draft = parseDraft(window.sessionStorage.getItem(draftKey))
      } catch {
        // Storage unavailable — open with a clean form.
      }
      if (draft) {
        reset({
          dog_id: dogId,
          shelter_id: shelterId,
          available_from: '',
          available_until: '',
          why_this_dog: '',
          emergency_contact_name: '',
          emergency_contact_phone: '',
          responsibilities_acknowledged: false,
          note: '',
          ...draft,
        })
      } else {
        // No restorable draft (none saved, or storage unavailable). Form
        // state survives close in memory, which is the degraded-mode
        // draft — but consent must be re-given on every open regardless.
        setValue('responsibilities_acknowledged', false)
      }
    } else {
      // Closing: flush any pending debounced save immediately so a quick
      // Esc-then-reopen within the debounce window can't restore a draft
      // staler than what the user just typed.
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
        try {
          window.sessionStorage.setItem(draftKey, serializeDraft(getValues()))
        } catch {
          // Storage unavailable — in-memory form state still has it.
        }
      }
    }
    // Intentionally no reset() on close — the draft (form state +
    // sessionStorage) survives accidental dismissal.
  }

  async function onSubmit(values: ApplicationCreateInput) {
    setSubmitting(true)

    if (DEV_MODE) {
      // In DEV_MODE there is no real Supabase, so short-circuit the
      // submit and behave as though the API returned 201. The
      // confirmation page renders placeholder names without an id.
      clearDraft()
      reset()
      onAppliedSuccess?.()
      router.push('/foster/applications/submitted')
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
      let newId: string | null = null
      try {
        newId = ((await response.json()) as { id?: string }).id ?? null
      } catch {
        // Body unreadable — fall back to the applications list below.
      }
      clearDraft()
      reset()
      onAppliedSuccess?.()
      // Navigate to the confirmation page instead of toasting in place.
      // Intentionally no setOpen(false)/setSubmitting(false): the dialog
      // stays open with the button disabled until the new route renders,
      // which blocks double-submits and idle flashes.
      router.push(
        newId
          ? `/foster/applications/submitted?id=${newId}`
          : '/foster/applications',
      )
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

    // Catch-all for any other non-2xx (400 from shelter/dog mismatch,
    // 404 dog gone, 500 insert failure, etc). Surface the API's
    // user-safe message when present so the foster sees what actually
    // failed instead of a generic banner.
    console.error('[application-form] submit failed:', {
      status: response.status,
      error: errorBody.error,
    })
    toast.error(errorBody.error ?? 'Something went wrong. Please try again.')
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

        <p className="text-xs text-muted-foreground">
          Messaging with {shelterName} opens once your application is
          accepted.
        </p>

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
                min={todayLocal}
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
                min={untilMin}
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
