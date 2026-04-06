import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: string
  className?: string
}

const statusConfig: Record<string, { label: string; className: string }> = {
  // Application statuses
  submitted: { label: 'Submitted', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  reviewing: { label: 'Reviewing', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
  accepted: { label: 'Accepted', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  declined: { label: 'Declined', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
  completed: { label: 'Completed', className: 'bg-purple-100 text-purple-800 hover:bg-purple-100' },
  // Dog statuses
  available: { label: 'Available', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
  placed: { label: 'Placed', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  adopted: { label: 'Adopted', className: 'bg-purple-100 text-purple-800 hover:bg-purple-100' },
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, className: '' }

  return (
    <Badge
      variant="secondary"
      className={cn(config.className, className)}
    >
      {config.label}
    </Badge>
  )
}
