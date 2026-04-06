# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Dev server (Node 25 workaround — .bin/next symlink is broken)
node node_modules/next/dist/bin/next dev

# Build
node node_modules/next/dist/bin/next build

# Type check (same Node 25 issue can break npx tsc)
node node_modules/typescript/bin/tsc --noEmit

# Lint
node node_modules/eslint/bin/eslint.js src/
```

## Architecture

Next.js 14 App Router project. Two route groups share layouts without affecting URLs:

- `(shelter)/` — sidebar layout for shelter staff; guarded by `RoleGuard allowedRole="shelter"`
- `(foster)/` — sidebar layout for foster parents; guarded by `RoleGuard allowedRole="foster"`

Public routes: `/`, `/login`, `/signup`, `/onboarding`. OAuth returns to `/auth/callback` (see below).

### Auth / Dev Mode

`AuthGuard` and `RoleGuard` are **async Server Components** that redirect unauthenticated or wrong-role users. Both check a `DEV_MODE` constant:

```ts
const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')
```

When `DEV_MODE` is true (no real Supabase URL), all auth checks are skipped and the app is fully browsable. The same check is used in `src/lib/supabase/middleware.ts` to skip session refresh, in the shelter/foster layouts (yellow dev-mode banner), and in some client pages (e.g. browse uses placeholder dogs instead of fetching).

**Post-login routing**: After password sign-in or OAuth callback, [`src/lib/auth-routing.ts`](src/lib/auth-routing.ts) `getPostAuthDestination()` queries `shelters` and `foster_parents` by `user_id` and returns `/shelter/dashboard`, `/foster/browse`, or `/onboarding`. Used from [`src/app/login/page.tsx`](src/app/login/page.tsx) and [`src/app/auth/callback/route.ts`](src/app/auth/callback/route.ts).

### Supabase

- **Client Components**: `src/lib/supabase/client.ts` — `createBrowserClient()`
- **Server Components / Route Handlers**: `src/lib/supabase/server.ts` — `async createClient()` using `@supabase/ssr` + async `cookies()`
- **Middleware**: `src/lib/supabase/middleware.ts` — `updateSession()` refreshes the session token on every request; skips entirely if no real URL

Uses `@supabase/ssr` (not the deprecated `auth-helpers-nextjs`).

### Implemented data flows (MVP)

| Area | Behavior |
|------|----------|
| Onboarding | Client inserts into `shelters` (slug + suffix) or `foster_parents` after signup |
| Shelter dogs | Create/update via `DogForm`; list on `/shelter/dogs` server-fetches by shelter |
| Foster browse | Client fetches `dogs` + nested `shelters`; filters applied client-side |
| Apply | Client inserts into `applications` from dog detail page |

Remaining gaps are tracked in [`docs/TODO.md`](docs/TODO.md) (messaging, accept/decline APIs, uploads, email, etc.).

### Key Files

| Path | Purpose |
|------|---------|
| `src/types/database.ts` | TS interfaces for all 6 DB tables + composite types |
| `src/lib/constants.ts` | Enums/labels for statuses, sizes, ages, etc. |
| `src/lib/helpers.ts` | `formatDate`, `getInitials`, `slugify`, `calculateAverageRating` |
| `src/lib/auth-routing.ts` | `getPostAuthDestination()` — role-based redirect after auth |
| `src/components/auth-guard.tsx` | Server component: redirects if no session |
| `src/components/role-guard.tsx` | Server component: wrong role → other portal; no profile → onboarding |
| `supabase/migrations/` | Full schema with RLS policies for all 6 tables |

### API Routes

Under `src/app/api/` — **still stubs** returning placeholder JSON with `// TODO` comments (not used by the happy-path UI yet):

- `applications/[id]/accept` / `decline` / `complete`
- `notifications/send`
- `upload/photo`

### ESLint

`argsIgnorePattern` and `varsIgnorePattern` are set to `^_` in `.eslintrc.json` so intentionally unused stub variables can be prefixed with `_` to suppress warnings.
