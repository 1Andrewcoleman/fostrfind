# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev server (Node 25 workaround — .bin/next symlink is broken)
node node_modules/next/dist/bin/next dev

# Build
node node_modules/next/dist/bin/next build

# Type check
npx tsc --noEmit

# Lint
npx eslint src/
```

## Architecture

Next.js 14 App Router project. Two route groups share layouts without affecting URLs:
- `(shelter)/` — sidebar layout for shelter staff; guarded by `RoleGuard allowedRole="shelter"`
- `(foster)/` — sidebar layout for foster parents; guarded by `RoleGuard allowedRole="foster"`

### Auth / Dev Mode

`AuthGuard` and `RoleGuard` are **async Server Components** that redirect unauthenticated or wrong-role users. Both check a `DEV_MODE` constant:

```ts
const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')
```

When `DEV_MODE` is true (no real Supabase URL), all auth checks are skipped and the app is fully browsable. The same check is used in `src/lib/supabase/middleware.ts` to skip session refresh, and in the shelter/foster layouts to show a yellow dev-mode banner.

### Supabase

- **Client Components**: `src/lib/supabase/client.ts` — `createBrowserClient()`
- **Server Components / Actions**: `src/lib/supabase/server.ts` — `async createClient()` using `@supabase/ssr` + async `cookies()`
- **Middleware**: `src/lib/supabase/middleware.ts` — `updateSession()` refreshes the session token on every request; skips entirely if no real URL

Uses `@supabase/ssr` (not the deprecated `auth-helpers-nextjs`).

### Key Files

| Path | Purpose |
|------|---------|
| `src/types/database.ts` | TS interfaces for all 6 DB tables + composite types |
| `src/lib/constants.ts` | Enums/labels for statuses, sizes, ages, etc. |
| `src/lib/helpers.ts` | `formatDate`, `getInitials`, `slugify`, `calculateAverageRating` |
| `src/components/auth-guard.tsx` | Server component: redirects if no session |
| `src/components/role-guard.tsx` | Server component: redirects if wrong role |
| `supabase/migrations/` | Full schema with RLS policies for all 6 tables |

### API Routes

All under `src/app/api/` — currently stubs returning placeholder JSON with `// TODO` comments:
- `applications/[id]/accept` / `decline` / `complete`
- `notifications/send`
- `upload/photo`

### ESLint

`argsIgnorePattern` and `varsIgnorePattern` are set to `^_` in `.eslintrc.json` so intentionally unused stub variables can be prefixed with `_` to suppress warnings.
