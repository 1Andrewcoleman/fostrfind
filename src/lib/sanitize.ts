// Lightweight text sanitization for user-submitted free-text fields.
//
// We render user text via React, so Next's default escaping already
// neutralises `<script>`-style injection in the browser. These helpers
// are a belt-and-braces defence for cases where the text might be
// forwarded elsewhere (email bodies, exports, server logs, future
// plaintext rendering) and to keep the stored data clean.
//
// The sanitization intentionally does NOT try to parse HTML — we just
// strip tag-shaped substrings and normalise whitespace. For anything
// that renders raw HTML in the future, switch to a real sanitizer
// (DOMPurify on client, `sanitize-html` on server).

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
