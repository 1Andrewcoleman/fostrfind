'use client'

import { useEffect, useState } from 'react'
import { Heart, Home, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { waitlistSignupSchema } from '@/lib/schemas'

// Waitlist hero + 3-step interest form (WAITLIST_MODE only).
// Replaces <Hero> under the flag — photo-free, centered column with the
// form card as the hero object. On mount the whole section fades + slides
// up (700ms), matching the existing Hero pattern; pure CSS transition so
// prefers-reduced-motion is respected by the browser.
//
// Step state (role / step) lives in <WaitlistLanding> so the CTA band and
// footer links can preselect a role and jump to step 2. Field values live
// here — the parent of the steps — so Back preserves entered text.

export type WaitlistRole = 'foster' | 'shelter'

interface WaitlistFormProps {
  role: WaitlistRole
  step: 1 | 2 | 3
  /** Step-1 card click: sets the role and advances to step 2. */
  onPickRole: (role: WaitlistRole) => void
  onStepChange: (step: 1 | 2 | 3) => void
  /** Fires after the API accepts the signup — parent swaps to the thank-you view. */
  onSuccess: () => void
}

// Border, text, and placeholder colors are classes (not inline style) so
// the `focus:` variant can actually win — inline styles would override it.
const inputClass = (hasError: boolean) =>
  'w-full rounded-[10px] border bg-[rgba(240,235,225,0.05)] px-3.5 py-[11px] text-sm text-[#f0ebe1] outline-none transition-colors placeholder:text-[#8a8478] focus:border-[#c97a7a] ' +
  (hasError ? 'border-[#c97a7a]' : 'border-[rgba(240,235,225,0.14)]')

type FieldErrors = Partial<Record<'name' | 'email' | 'city_state' | 'shelter_name', string>>

export function WaitlistForm({ role, step, onPickRole, onStepChange, onSuccess }: WaitlistFormProps) {
  const [loaded, setLoaded] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [cityState, setCityState] = useState('')
  const [shelterName, setShelterName] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<FieldErrors>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setLoaded(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Validates the whole payload; returns field errors for the basics step.
  const validate = (): FieldErrors => {
    const parsed = waitlistSignupSchema.safeParse({
      role,
      name,
      email,
      city_state: cityState,
      shelter_name: shelterName,
      note,
    })
    if (parsed.success) return {}
    const flat = parsed.error.flatten().fieldErrors
    return {
      name: flat.name?.[0],
      email: flat.email?.[0],
      city_state: flat.city_state?.[0],
      shelter_name: role === 'shelter' ? flat.shelter_name?.[0] : undefined,
    }
  }

  const handleContinue = () => {
    const fieldErrors = validate()
    setErrors(fieldErrors)
    if (Object.values(fieldErrors).some(Boolean)) return
    onStepChange(3)
  }

  const handleSubmit = async () => {
    // Step-2 fields were validated on Continue, but re-check in case the
    // note pushed the payload over a cap (its error surfaces via toast).
    const parsed = waitlistSignupSchema.safeParse({
      role,
      name,
      email,
      city_state: cityState,
      shelter_name: shelterName,
      note,
    })
    if (!parsed.success) {
      const first = Object.values(parsed.error.flatten().fieldErrors).flat()[0]
      toast.error(first ?? 'Please check your answers and try again.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        toast.error(body?.error ?? 'Could not save your spot. Try again shortly.')
        return
      }
      onSuccess()
    } catch {
      toast.error('Could not save your spot. Try again shortly.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      id="waitlist-form"
      className="px-6 md:px-20 pt-[88px] pb-24 flex flex-col items-center"
      style={{
        opacity: loaded ? 1 : 0,
        transform: loaded ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
      }}
      aria-labelledby="waitlist-heading"
    >
      {/* Hero copy */}
      <div className="text-center mb-10" style={{ width: '680px', maxWidth: '100%' }}>
        <div
          className="inline-flex items-center gap-2 mb-7 px-4 py-1.5 rounded-full text-xs font-medium tracking-wide"
          style={{
            backgroundColor: '#6f8a5e',
            color: '#e8f0e5',
            border: '1px solid rgba(138,163,118,0.6)',
          }}
        >
          We&apos;re new here — waitlist open
        </div>
        <h1
          id="waitlist-heading"
          className="font-normal mb-5"
          style={{
            fontFamily: 'var(--font-instrument)',
            fontSize: 'clamp(3rem, 6vw, 4rem)',
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            color: '#f0ebe1',
          }}
        >
          Save your <em style={{ color: '#c97a7a', fontStyle: 'italic' }}>spot</em>.
        </h1>
        <p
          className="text-base leading-relaxed mx-auto"
          style={{ color: 'rgba(240,235,225,0.65)', maxWidth: '28rem' }}
        >
          Doors open Late Fall 2026. Three quick questions and you&apos;re in line — we&apos;ll
          email when it&apos;s your turn.
        </p>
      </div>

      {/* Form card — one step visible at a time; instant swap, no carousel */}
      <div
        className="rounded-[18px] p-9"
        style={{
          width: '680px',
          maxWidth: '100%',
          backgroundColor: '#25221c',
          border: '1px solid rgba(240,235,225,0.08)',
        }}
      >
        {step === 1 && (
          <div>
            <StepHeader step={1} />
            <StepTitle className="mb-5">Who&apos;s joining the waitlist?</StepTitle>
            <div className="grid sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onPickRole('foster')}
                className="text-left rounded-[14px] p-5 border border-[rgba(240,235,225,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(201,122,122,0.5)]"
                style={{ backgroundColor: '#2a2620' }}
              >
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full mb-3.5"
                  style={{ backgroundColor: 'rgba(201,122,122,0.15)' }}
                >
                  <Heart className="h-3.5 w-3.5" style={{ color: '#c97a7a' }} aria-hidden="true" />
                </span>
                <span className="block text-base font-medium mb-1" style={{ color: '#f0ebe1' }}>
                  I&apos;m a foster parent
                </span>
                <span className="block text-[13px] leading-normal" style={{ color: '#8a8478' }}>
                  I want to open my home to a dog who&apos;s waiting.
                </span>
              </button>
              <button
                type="button"
                onClick={() => onPickRole('shelter')}
                className="text-left rounded-[14px] p-5 border border-[rgba(240,235,225,0.08)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[rgba(111,138,94,0.6)]"
                style={{ backgroundColor: '#2a2620' }}
              >
                <span
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full mb-3.5"
                  style={{ backgroundColor: 'rgba(111,138,94,0.18)' }}
                >
                  <Home className="h-3.5 w-3.5" style={{ color: '#6f8a5e' }} aria-hidden="true" />
                </span>
                <span className="block text-base font-medium mb-1" style={{ color: '#f0ebe1' }}>
                  I run a shelter or rescue
                </span>
                <span className="block text-[13px] leading-normal" style={{ color: '#8a8478' }}>
                  I have dogs who need a warm place to wait.
                </span>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <StepHeader step={2} />
            <StepTitle className="mb-5">The basics.</StepTitle>
            <div className="flex flex-col gap-3.5">
              {role === 'shelter' && (
                <Field label="Shelter or rescue name" error={errors.shelter_name}>
                  <input
                    type="text"
                    value={shelterName}
                    onChange={(e) => setShelterName(e.target.value)}
                    placeholder="Willow Creek Animal Rescue"
                    className={inputClass(Boolean(errors.shelter_name))}
                  />
                </Field>
              )}
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Name" error={errors.name}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jamie Alvarez"
                    className={inputClass(Boolean(errors.name))}
                  />
                </Field>
                <Field label="City & state" error={errors.city_state}>
                  <input
                    type="text"
                    value={cityState}
                    onChange={(e) => setCityState(e.target.value)}
                    placeholder="Sacramento, CA"
                    className={inputClass(Boolean(errors.city_state))}
                  />
                </Field>
              </div>
              <Field label="Email" error={errors.email}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass(Boolean(errors.email))}
                />
              </Field>
            </div>
            <div className="flex items-center justify-between mt-6">
              <BackButton onClick={() => onStepChange(1)} />
              <PillButton onClick={handleContinue}>
                Continue <span aria-hidden="true">→</span>
              </PillButton>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <StepHeader step={3} />
            <StepTitle className="mb-2">Anything we should know?</StepTitle>
            <p className="text-[13px] leading-relaxed mb-4" style={{ color: '#8a8478' }}>
              Totally optional — but it helps us plan the first rooms.
            </p>
            <textarea
              rows={4}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Two kids, a fenced yard, and room for one more…"
              aria-label="Anything we should know?"
              className={`${inputClass(false)} resize-y`}
            />
            <div className="flex items-center justify-between mt-6">
              <BackButton onClick={() => onStepChange(2)} />
              <PillButton onClick={handleSubmit} disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                Join the waitlist <span aria-hidden="true">→</span>
              </PillButton>
            </div>
          </div>
        )}
      </div>

      <p className="mt-5 text-xs" style={{ color: '#8a8478' }}>
        One email when doors open. No spam, ever.
      </p>
    </section>
  )
}

// "Step N of 3" label + three progress dots.
function StepHeader({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <span className="text-xs font-medium" style={{ color: '#8a8478' }}>
        Step {step} of 3
      </span>
      <span className="flex gap-1.5" aria-hidden="true">
        {([1, 2, 3] as const).map((dot) => (
          <span
            key={dot}
            className="h-1.5 w-1.5 rounded-full"
            style={{
              backgroundColor: dot === step ? '#c97a7a' : 'rgba(240,235,225,0.15)',
            }}
          />
        ))}
      </span>
    </div>
  )
}

function StepTitle({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <h3
      className={`font-normal ${className}`}
      style={{ fontFamily: 'var(--font-instrument)', fontSize: '28px', color: '#f0ebe1' }}
    >
      {children}
    </h3>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1.5" style={{ color: '#c8c2b4' }}>
        {label}
      </span>
      {children}
      {error && (
        <span className="block text-xs mt-1.5" style={{ color: '#c97a7a' }}>
          {error}
        </span>
      )}
    </label>
  )
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[13px] font-medium py-2 text-[#8a8478] transition-colors hover:text-[#f0ebe1]"
    >
      ← Back
    </button>
  )
}

function PillButton({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 px-6 py-[11px] rounded-full text-sm font-medium transition-all duration-200 hover:opacity-90 hover:-translate-y-0.5 disabled:opacity-60 disabled:hover:translate-y-0"
      style={{ backgroundColor: '#c97a7a', color: '#f5ede8' }}
    >
      {children}
    </button>
  )
}
