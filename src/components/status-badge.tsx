import {
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  Award,
  CircleDot,
  Home,
  Heart,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

// Status badges collapse down to the three-pastel palette plus the
// destructive token, per `.impeccable.md` principle #4 ("three pastels,
// each with a job"). The product semantic groups are:
//   - in-progress / shelter action        -> peach  (submitted, reviewing, pending)
//   - success / positive terminal state   -> warm   (accepted, completed, available, placed, adopted)
//   - destructive                         -> destructive (declined)
//   - neutral / closed-by-foster          -> muted (withdrawn — distinct from declined,
//                                                   which carries a value judgement)
// Two states in the same group render the same because, product-wise,
// they *are* the same "you're in a good spot" moment. The Icon is the
// thing that tells the user which specific state.
const inProgress  = 'bg-peach/25 text-foreground hover:bg-peach/25'
const success     = 'bg-warm/25 text-foreground hover:bg-warm/25'
const destructive = 'bg-destructive/15 text-destructive hover:bg-destructive/15'
const neutral     = 'bg-muted text-muted-foreground hover:bg-muted'

const statusConfig: Record<string, { label: string; className: string; icon: LucideIcon }> = {
  submitted:  { label: 'Submitted',  className: inProgress,  icon: Clock },
  reviewing:  { label: 'Reviewing',  className: inProgress,  icon: Eye },
  accepted:   { label: 'Accepted',   className: success,     icon: CheckCircle2 },
  declined:   { label: 'Declined',   className: destructive, icon: XCircle },
  completed:  { label: 'Completed',  className: success,     icon: Award },
  withdrawn:  { label: 'Withdrawn',  className: neutral,     icon: Undo2 },
  available:  { label: 'Available',  className: success,     icon: CircleDot },
  pending:    { label: 'Pending',    className: inProgress,  icon: Clock },
  placed:     { label: 'Placed',     className: success,     icon: Home },
  adopted:    { label: 'Adopted',    className: success,     icon: Heart },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: '', icon: CircleDot }
  const Icon = config.icon

  return (
    <Badge
      variant="secondary"
      className={cn('gap-1', config.className, className)}
    >
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  )
}
