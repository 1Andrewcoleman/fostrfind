// Lightweight TEXT cleaners for user-submitted free-text fields.
//
// PURPOSE AND LIMITS:
//   These helpers are NOT HTML sanitizers. They strip tag-shaped substrings
//   and normalise whitespace so stored data is clean for plaintext contexts
//   (email bodies, exports, logs, admin views). React's JSX escaping is the
//   actual XSS defence for browser rendering.
//
//   DO NOT use these helpers before rendering content with
//   `dangerouslySetInnerHTML`. If raw HTML rendering is ever required, use a
//   real sanitizer library: `sanitize-html` on the server, DOMPurify on the
//   client. The names `sanitizeText` and `sanitizeMultiline` intentionally do
//   not say "HTML" to avoid false confidence.
//
// INVARIANT:
//   `dangerouslySetInnerHTML` MUST NOT be used in this codebase without a
//   prior review and a real sanitizer in place. This comment is the canonical
//   reminder; grep for `dangerouslySetInnerHTML` to confirm the invariant
//   holds before adding new rendering code.

/**
 * Strip HTML-like tags from a string and collapse runs of whitespace.
 * Returns an empty string for null/undefined.
 *
 *   sanitizeText('<script>alert(1)</script> hi\n\n  there')
 *     // -> 'alert(1) hi there'
 *
 *   sanitizeText('  line1\n\n\nline2  ')
 *     // -> 'line1 line2'
 */
export function sanitizeText(input: string | null | undefined): string {
  if (input == null) return ''
  return (
    input
      // Drop anything that looks like an HTML tag. We use a conservative
      // regex so `<3` in text stays put (no `/` or letter after `<`).
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
      // Collapse whitespace runs (including newlines) to single spaces.
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Same as `sanitizeText` but preserves line breaks — useful for message
 * bodies, bios, descriptions, etc. where paragraphs are meaningful.
 */
export function sanitizeMultiline(input: string | null | undefined): string {
  if (input == null) return ''
  return (
    input
      .replace(/<\/?[a-zA-Z][^>]*>/g, '')
      // Normalise CRLF -> LF.
      .replace(/\r\n/g, '\n')
      // Collapse 3+ newlines to 2 so we don't end up with walls of blank lines.
      .replace(/\n{3,}/g, '\n\n')
      // Trim trailing whitespace on each line.
      .split('\n')
      .map((line) => line.replace(/[ \t]+$/g, ''))
      .join('\n')
      .trim()
  )
}
