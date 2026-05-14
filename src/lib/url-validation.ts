const ALLOWED_STORAGE_HOSTNAMES = ['.supabase.co', '.supabase.in']

/**
 * Returns true only for HTTPS URLs hosted on Supabase Storage.
 * Rejects cloud metadata endpoints, internal network addresses, and
 * any non-Supabase origin that could be proxied by the Next.js image optimizer.
 */
export function isAllowedStorageUrl(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'https:') return false
    return ALLOWED_STORAGE_HOSTNAMES.some((suffix) => hostname.endsWith(suffix))
  } catch {
    return false
  }
}
