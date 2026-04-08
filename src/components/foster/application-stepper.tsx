import { CheckCircle2, XCircle } from 'lucide-react'
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
  completed: 3,
}

const STEP_COLORS: Record<string, string> = {
  submitted: 'bg-blue-500',
  reviewing: 'bg-amber-500',
  accepted: 'bg-green-500',
  declined: 'bg-red-500',
  completed: 'bg-purple-500',
}

const STEP_RING: Record<string, string> = {
  submitted: 'ring-blue-200',
  reviewing: 'ring-amber-200',
  accepted: 'ring-green-200',
  declined: 'ring-red-200',
  completed: 'ring-purple-200',
}

/**
 * Connector color for the segment entering a step from the left.
 * Rule: filled with the colour of the step at `idx` if that step is reached;
 * declined overrides the colour at index 2.
 */
function connectorColorLeft(idx: number, currentIdx: number, isDeclined: boolean): string {
  if (idx <= currentIdx) {
    if (isDeclined && idx === 2) return STEP_COLORS.declined
    return STEP_COLORS[STEPS[Math.min(idx, currentIdx)].key]
  }
  return 'bg-muted'
}

/**
 * Connector color for the segment leaving a step to the right.
 * Rule: filled with the colour of the *next* step if the current step is
 * behind `currentIdx`; declined overrides the segment leaving index 1.
 */
function connectorColorRight(idx: number, currentIdx: number, isDeclined: boolean): string {
  if (idx < currentIdx) {
    if (isDeclined && idx === 1) return STEP_COLORS.declined
    return STEP_COLORS[STEPS[idx + 1].key]
  }
  return 'bg-muted'
}

export function ApplicationStepper({ status }: ApplicationStepperProps) {
  const currentIdx = ORDER[status] ?? 0
  const isDeclined = status === 'declined'

  return (
    <div className="flex items-start w-full" role="list" aria-label="Application progress">
      {STEPS.map((step, idx) => {
        const isActive = idx === currentIdx
        const isReached = idx <= currentIdx
        const showDeclined = isDeclined && idx === 2

        const dotColor = showDeclined
          ? STEP_COLORS.declined
          : isReached
            ? STEP_COLORS[step.key]
            : 'bg-muted'
        const ringColor = isActive
          ? showDeclined
            ? STEP_RING.declined
            : STEP_RING[step.key]
          : ''

        return (
          <div key={step.key} className="flex-1 flex flex-col items-center" role="listitem">
            <div className="flex items-center w-full">
              {idx > 0 && (
                <div className={cn('flex-1 h-0.5', connectorColorLeft(idx, currentIdx, isDeclined))} />
              )}
              <div
                className={cn(
                  'h-6 w-6 rounded-full flex items-center justify-center shrink-0',
                  dotColor,
                  isActive && `ring-2 ring-offset-2 ${ringColor}`,
                )}
              >
                {showDeclined ? (
                  <XCircle className="h-3.5 w-3.5 text-white" />
                ) : isReached ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/30" />
                )}
              </div>
              {idx < STEPS.length - 1 && (
                <div className={cn('flex-1 h-0.5', connectorColorRight(idx, currentIdx, isDeclined))} />
              )}
            </div>
            <span
              className={cn(
                'text-[10px] mt-1.5 text-center leading-tight',
                isActive ? 'font-semibold text-foreground' : 'text-muted-foreground',
              )}
            >
              {showDeclined ? 'Declined' : step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}
