import Link from 'next/link'
import {
  ClipboardList,
  Dog,
  Home,
  MessagesSquare,
  PawPrint,
  SearchX,
  Clock3,
  type LucideIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Server Components can only pass the `href` variant (serialisable).
 * Use the `onClick` variant only from Client Components.
 */
type EmptyStateAction =
  | { label: string; href: string }
  | { label: string; onClick: () => void }

/**
 * One of seven line-art illustrations paired to the empty-state copy.
 * Keeping the vocabulary small (`dog`, `messages`, `applications`, `search`,
 * `history`, `shelter`, `paw` fallback) so call sites don't pick something
 * surprising and so future placements can reuse an existing glyph instead
 * of shipping a new SVG. Lucide was chosen over bespoke art to satisfy
 * .impeccable.md principle 1 (restraint over richness) — the glyphs read
 * as illustrations at 40–48px without adding another design dialect.
 */
export type EmptyStateIllustration =
  | 'paw'
  | 'dog'
  | 'messages'
  | 'applications'
  | 'search'
  | 'history'
  | 'shelter'

const ILLUSTRATION_MAP: Record<EmptyStateIllustration, LucideIcon> = {
  paw: PawPrint,
  dog: Dog,
  messages: MessagesSquare,
  applications: ClipboardList,
  search: SearchX,
  history: Clock3,
  shelter: Home,
}

interface EmptyStateProps {
  title: string
  description: string
  action?: EmptyStateAction
  /**
   * Line-art glyph rendered in the muted badge above the title. Defaults to
   * `paw` so pre-existing call sites keep their appearance until migrated.
   */
  illustration?: EmptyStateIllustration
}

export function EmptyState({
  title,
  description,
  action,
  illustration = 'paw',
}: EmptyStateProps) {
  const Icon = ILLUSTRATION_MAP[illustration] ?? PawPrint
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mx-auto flex w-full max-w-md flex-col items-center">
        <div
          aria-hidden
          className="mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-muted"
        >
          <Icon className="h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
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
    </div>
  )
}
