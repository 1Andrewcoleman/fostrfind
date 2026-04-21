import { cn } from '@/lib/utils'

interface FormEyebrowProps {
  /** Small-caps label rendered in muted ink. */
  children: React.ReactNode
  /** Optional second line sitting directly below the eyebrow. */
  description?: React.ReactNode
  className?: string
}

/**
 * Section separator used inside long forms. Replaces heavy CardTitle
 * chrome with a single small-caps line + a hairline, so each group of
 * fields reads as one breath (.impeccable.md principle 3 — typography
 * leads). Pure presentational; safe in both RSC and client trees.
 */
export function FormEyebrow({ children, description, className }: FormEyebrowProps) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center gap-3">
        <h3 className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {children}
        </h3>
        <span aria-hidden className="h-px flex-1 bg-border" />
      </div>
      {description ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
