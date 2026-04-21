'use client'

import { Share2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

interface ShareButtonProps {
  /** Fully-qualified URL to share. Built server-side via \`getAppUrl()\`. */
  url: string
  /** Title fed to \`navigator.share\` (e.g. the dog's name). */
  title: string
  /** Descriptive text fed to \`navigator.share\`. Platforms that
   * support the native share sheet surface this alongside the URL. */
  text?: string
  /** Pass-through so callers can tweak the trigger's visual weight. */
  variant?: React.ComponentProps<typeof Button>['variant']
  size?: React.ComponentProps<typeof Button>['size']
  className?: string
}

/**
 * Share a URL using the native Web Share API, with a clipboard
 * fallback for environments that don't support \`navigator.share\`
 * (most desktop browsers).
 *
 * Intentional behaviors:
 *
 *   - Cancelling the system share sheet throws \`AbortError\`; we
 *     swallow that silently rather than showing a misleading error
 *     toast or falling through to the clipboard (which would feel
 *     like double-sharing).
 *   - Any *other* error from \`navigator.share\` (e.g. the browser
 *     exposes \`share\` but the OS rejects the payload) falls through
 *     to the clipboard path so the user still leaves with a link.
 *   - Clipboard failure produces a soft error toast — we can't do
 *     anything else useful, and leaving the user with no feedback
 *     would be worse.
 *
 * Not wired to analytics yet (deferred — see the Phase 6 follow-up list
 * in the roadmap).
 */
export function ShareButton({
  url,
  title,
  text,
  variant = 'outline',
  size = 'sm',
  className,
}: ShareButtonProps) {
  async function handleShare() {
    const data: ShareData = { url, title, ...(text ? { text } : {}) }

    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share(data)
        return
      } catch (e) {
        // User cancelled the sheet — that's not an error, just silence.
        if (e instanceof DOMException && e.name === 'AbortError') return
        // Any other failure falls through to the clipboard path below.
      }
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        toast.success('Link copied')
        return
      }
      throw new Error('No clipboard API available')
    } catch {
      toast.error("Couldn't copy link")
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleShare}
      className={className}
    >
      <Share2 className="h-4 w-4" />
      Share
    </Button>
  )
}
