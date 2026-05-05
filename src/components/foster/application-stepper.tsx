import { CheckCircle2, XCircle, Undo2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Application } from '@/types/database'

interface ApplicationStepperProps {
  status: Application['status']
}

const STEPS = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'completed', label: 'Completed' },
] as const

const ORDER: Record<string, number> = {
  submitted: 0,
  reviewing: 1,
  accepted: 2,
  declined: 2,
  withdrawn: 1,
  completed: 3,
}

// Stepper colors collapse down to the three-pastel palette plus the
// destructive token. Each step uses a semantic pastel (peach for
// shelter-side in-progress, warm/sage for success, destructive for
// declined). The icon inside the dot (check or X) carries the exact
// meaning; the color signals the family of state.
const STEP_COLORS: Record<string, string> = {
  submitted: 'bg-peach',
  reviewing: 'bg-peach',
  accepted:  'bg-warm',
  declined:  'bg-destructive',
  withdrawn: 'bg-muted-foreground/40',
  completed: 'bg-warm',
}

const STEP_RING: Record<string, string> = {
  submitted: 'ring-peach/40',
  reviewing: 'ring-peach/40',
  accepted:  'ring-warm/40',
  declined:  'ring-destructive/30',
  withdrawn: 'ring-muted-foreground/30',
  completed: 'ring-warm/40',
}

type Override = { color: string; ring: string; label: string; icon: 'declined' | 'withdrawn' }

/**
 * Per-status override applied at a specific step index. Used to swap
 * the colour, label, and icon at the moment a non-linear terminal
 * status (declined, withdrawn) takes the application off the happy
 * path. Declined caps at the Accepted slot (idx 2); withdrawn caps at
 * the Reviewing slot (idx 1) since fosters can only withdraw before
 * acceptance.
 */
const OVERRIDE_BY_STATUS: Record<string, { idx: number; override: Override }> = {
  declined: {
    idx: 2,
    override: { color: STEP_COLORS.declined, ring: STEP_RING.declined, label: 'Declined', icon: 'declined' },
  },
  withdrawn: {
    idx: 1,
    override: { color: STEP_COLORS.withdrawn, ring: STEP_RING.withdrawn, label: 'Withdrawn', icon: 'withdrawn' },
  },
}

/**
 * Connector color for the segment entering a step from the left.
 * Rule: filled with the colour of the step at `idx` if that step is
 * reached; an override at this index wins.
 */
function connectorColorLeft(
  idx: number,
  currentIdx: number,
  override: { idx: number; override: Override } | undefined,
): string {
  if (idx > currentIdx) return 'bg-muted'
  if (override && override.idx === idx) return override.override.color
  return STEP_COLORS[STEPS[Math.min(idx, currentIdx)].key]
}

/**
 * Connector color for the segment leaving a step to the right.
 */
function connectorColorRight(
  idx: number,
  currentIdx: number,
  override: { idx: number; override: Override } | undefined,
): string {
  if (idx >= currentIdx) return 'bg-muted'
  if (override && override.idx === idx + 1) return override.override.color
  return STEP_COLORS[STEPS[idx + 1].key]
}

export function ApplicationStepper({ status }: ApplicationStepperProps) {
  const currentIdx = ORDER[status] ?? 0
  const override = OVERRIDE_BY_STATUS[status]

  return (
    <div className="flex items-start w-full" role="list" aria-label="Application progress">
      {STEPS.map((step, idx) => {
        const isActive = idx === currentIdx
        const isReached = idx <= currentIdx
        const showOverride = override && idx === override.idx

        const dotColor = showOverride
          ? override.override.color
          : isReached
            ? STEP_COLORS[step.key]
            : 'bg-muted'
        const ringColor = isActive
          ? showOverride
            ? override.override.ring
            : STEP_RING[step.key]
          : ''
        const label = showOverride ? override.override.label : step.label

        return (
          <div key={step.key} className="flex-1 flex flex-col items-center" role="listitem">
            <div className="flex items-center w-full">
              {idx > 0 && (
                <div className={cn('flex-1 h-0.5', connectorColorLeft(idx, currentIdx, override))} />
              )}
              <div
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center shrink-0',
                  dotColor,
                  isActive && `ring-2 ring-offset-2 ${ringColor}`,
                )}
              >
                {showOverride && override.override.icon === 'declined' ? (
                  <XCircle className="h-3.5 w-3.5 text-destructive-foreground" />
                ) : showOverride && override.override.icon === 'withdrawn' ? (
                  <Undo2 className="h-3.5 w-3.5 text-foreground" />
                ) : isReached ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-foreground" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                )}
              </div>
              {idx < STEPS.length - 1 && (
                <div className={cn('flex-1 h-0.5', connectorColorRight(idx, currentIdx, override))} />
              )}
            </div>
            <span
              className={cn(
                'text-[10px] mt-1.5 text-center leading-tight',
                isActive ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
