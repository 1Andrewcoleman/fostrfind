'use client'

import Link from 'next/link'
import { PawPrint } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Server Components can only pass the `href` variant (serialisable).
 * Use the `onClick` variant only from Client Components.
 */
type EmptyStateAction =
  | { label: string; href: string }
  | { label: string; onClick: () => void }

interface EmptyStateProps {
  title: string
  description: string
  action?: EmptyStateAction
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 rounded-full bg-muted p-4">
        <PawPrint className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action &&
        ('href' in action ? (
          <Button asChild>
            <Link href={action.href}>{action.label}</Link>
          </Button>
        ) : (
          <Button type="button" onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
    </div>
  )
}
