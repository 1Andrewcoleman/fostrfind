import {
  Clock,
  Eye,
  CheckCircle2,
  XCircle,
  Award,
  CircleDot,
  Home,
  Heart,
  type LucideIcon,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

const statusConfig: Record<string, { label: string; className: string; icon: LucideIcon }> = {
  submitted:  { label: 'Submitted',  className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',     icon: Clock },
  reviewing:  { label: 'Reviewing',  className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',  icon: Eye },
  accepted:   { label: 'Accepted',   className: 'bg-green-100 text-green-800 hover:bg-green-100',   icon: CheckCircle2 },
  declined:   { label: 'Declined',   className: 'bg-red-100 text-red-800 hover:bg-red-100',         icon: XCircle },
  completed:  { label: 'Completed',  className: 'bg-purple-100 text-purple-800 hover:bg-purple-100', icon: Award },
  available:  { label: 'Available',  className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100', icon: CircleDot },
  pending:    { label: 'Pending',    className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100', icon: Clock },
  placed:     { label: 'Placed',     className: 'bg-sky-100 text-sky-800 hover:bg-sky-100',         icon: Home },
  adopted:    { label: 'Adopted',    className: 'bg-violet-100 text-violet-800 hover:bg-violet-100', icon: Heart },
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
