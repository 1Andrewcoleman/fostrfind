import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * `@/lib/supabase/service` exposes a service-role-bound client that
 * bypasses RLS. To keep that privilege under tight review, the set of
 * modules importing it is allowlisted here; adding a new importer
 * requires explicitly updating this list.
 *
 * See docs/superpowers/specs/2026-04-22-phase-6-62-shelter-foster-roster-plan.md
 * for the rationale. New entries should only be added for API routes whose
 * writes cannot be expressed via RLS (e.g. inserts that must happen on
 * behalf of another user).
 */
const ALLOWED_IMPORTERS = new Set<string>([
  // Membership upserts on application acceptance + invite acceptance +
  // onboarding email-match. These are added in commits 3–5 of the §6.2
  // plan; the list is pre-populated so the test stays green as the
  // callers land.
  'src/app/api/applications/[id]/accept/route.ts',
  'src/app/api/shelter/foster-invites/[id]/accept/route.ts',
  'src/app/api/shelter/foster-invites/route.ts',
  'src/app/onboarding/foster/claim-invites.ts',
  // The module itself.
  'src/lib/supabase/service.ts',
])

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry)
    const s = statSync(abs)
    if (s.isDirectory()) walk(abs, out)
    else if (/\.(ts|tsx)$/.test(entry)) out.push(abs)
  }
  return out
}

const SERVICE_IMPORT_RE =
  /from\s+['"](?:@\/lib\/supabase\/service|\.\.?\/.*supabase\/service)['"]/

describe('service-client import allowlist', () => {
  it('only allowlisted modules import @/lib/supabase/service', () => {
    const repoRoot = join(__dirname, '..', '..', '..')
    const srcRoot = join(repoRoot, 'src')
    const offenders: string[] = []

    for (const file of walk(srcRoot)) {
      const relPath = relative(repoRoot, file).split('\\').join('/')
      if (relPath.includes('__tests__')) continue
      const body = readFileSync(file, 'utf8')
      if (SERVICE_IMPORT_RE.test(body) && !ALLOWED_IMPORTERS.has(relPath)) {
        offenders.push(relPath)
      }
    }

    expect(offenders).toEqual([])
  })
})
