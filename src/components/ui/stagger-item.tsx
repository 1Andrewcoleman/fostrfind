import { cn } from '@/lib/utils'

interface StaggerItemProps {
  /** Zero-based position of this item in its list. Only the first
   * three items receive a staggered delay — beyond that the eye
   * stops tracking and it's just CPU. */
  index: number
  children: React.ReactNode
  className?: string
  /** HTML tag for the wrapper. Defaults to `div`; use `li` inside a
   * `<ul>`, `article` when the item already reads as self-contained. */
  as?: 'div' | 'li' | 'article' | 'section'
}

/**
 * Thin wrapper that adds a brief fade + slide-in when the item first
 * mounts. Honours motion-reduce (no animation classes emit when the
 * user prefers reduced motion thanks to Tailwind's `motion-safe:`
 * variant). Per .impeccable.md principle 5 (motion responds to
 * intent), we deliberately do NOT animate every card in a long grid —
 * only the first three, so the reveal feels anchored without turning
 * scrolling into a wave.
 */
export function StaggerItem({
  index,
  children,
  className,
  as: Tag = 'div',
}: StaggerItemProps) {
  const shouldAnimate = index < 3
  const delay = `${index * 60}ms`
  return (
    <Tag
      className={cn(
        shouldAnimate &&
          'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1',
        className,
      )}
      style={
        shouldAnimate
          ? {
              animationDuration: '320ms',
              animationDelay: delay,
              animationFillMode: 'both',
            }
          : undefined
      }
    >
      {children}
    </Tag>
  )
}
