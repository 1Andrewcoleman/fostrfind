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

**Hard navigations after auth state changes**: Signup, login, and onboarding use `window.location.href` (not `router.push()`) to ensure the full page load sends fresh session cookies to the server. This prevents stale-session redirect loops between `RoleGuard` and `/onboarding`.

### Supabase

- **Client Components**: `src/lib/supabase/client.ts` — `createBrowserClient()`
- **Server Components / Route Handlers**: `src/lib/supabase/server.ts` — `async createClient()` using `@supabase/ssr` + async `cookies()`
- **Middleware**: `src/lib/supabase/middleware.ts` — `updateSession()` refreshes the session token on every request; skips entirely if no real URL

Uses `@supabase/ssr` (not the deprecated `auth-helpers-nextjs`).

### RLS Policies & SECURITY DEFINER Helpers

The initial schema (`20240101000000`) had circular RLS policies: `foster_parents` policies queried `applications`, whose policies queried `foster_parents` back, causing PostgreSQL infinite recursion. Migration `20240102000000_fix_rls_recursion.sql` fixes this by introducing two `SECURITY DEFINER` helper functions:

- `get_my_foster_ids()` — returns the current user's `foster_parents.id` values, bypassing RLS
- `get_my_shelter_ids()` — returns the current user's `shelters.id` values, bypassing RLS

All cross-table RLS policies (`applications`, `foster_parents` "shelters can read applicants", `messages`) now use these helpers instead of raw subqueries, breaking the recursion cycle. **Any new RLS policy that references `foster_parents` or `shelters` for ownership checks should use these helpers.**

**Messages `UPDATE`**: Migration `20240103000000_messages_update_rls.sql` adds a policy so participants can mark messages read. Migration `20240104000000_messages_update_rls_fix.sql` tightens this: `GRANT UPDATE (read)` only (not whole-row updates), policy requires `sender_id != auth.uid()` and `read = true` so users cannot edit bodies or impersonate senders. **Apply migrations to your Supabase project** (CLI `db push` / linked project, or run SQL in the SQL editor) — committing SQL to the repo does not change a remote database.

### Implemented data flows (MVP)

| Area | Behavior |
|------|----------|
| Onboarding | Client inserts into `shelters` (slug + suffix) or `foster_parents` after signup |
| Shelter dogs | Create/update via `DogForm`; list on `/shelter/dogs` server-fetches by shelter |
| Foster browse | Client fetches `dogs` + nested `shelters`; filters applied client-side |
| Apply | Client inserts into `applications` from dog detail page |
| Profiles | Foster profile and shelter settings server-fetch existing data; client forms upsert/update via Supabase |
| Applications | Both portals server-fetch joined applications; tab filtering client-side; shelter detail page shows real foster profile + ratings |
| Accept/Decline/Complete | API routes with auth + ownership + idempotency guards; dog status transitions (pending/placed) |
| Dashboard | Server-fetches real counts (active dogs, pending apps, unread messages) + recent applications |
| Foster History | Server-fetches completed applications + ratings; wires `FosterHistoryCard` + stats |
| Messaging | Thread list + thread view (foster/shelter): server-fetched threads, `MessageThread` client sends inserts; mark-as-read on thread open (server `UPDATE`); nav + list unread badges. **No Supabase Realtime** yet — refresh to see new messages from the other party. |
| Shelter ratings | After placement complete, `RatingDialog` + `POST /api/ratings` (auth, shelter ownership, idempotency); "Rate Foster" available on completed applications until a rating exists. |
| Dog delete | `DELETE /api/dogs/[id]` + `DogDeleteButton` on edit dog page; blocks delete when active applications exist (409). |
| Portal nav | `portal-nav.tsx`: active route highlighting, desktop `NavLinks`, mobile `Sheet` menu, unread badge on Messages. |

Remaining gaps are tracked in [`docs/TODO.md`](docs/TODO.md) (Realtime messaging, uploads, email, etc.).

### Key Files

| Path | Purpose |
|------|---------|
| `src/types/database.ts` | TS interfaces for all 6 DB tables + composite types |
| `src/lib/constants.ts` | Enums/labels for statuses, sizes, ages, etc. |
| `src/lib/helpers.ts` | `formatDate`, `getInitials`, `slugify`, `calculateAverageRating` |
| `src/lib/auth-routing.ts` | `getPostAuthDestination()` — role-based redirect after auth |
| `src/components/auth-guard.tsx` | Server component: redirects if no session |
| `src/components/role-guard.tsx` | Server component: wrong role → other portal; no profile → onboarding |
| `src/components/foster/foster-profile-form.tsx` | Client form: upserts `foster_parents` row |
| `src/components/shelter/shelter-settings-form.tsx` | Client form: updates `shelters` row |
| `src/components/shelter/applications-list.tsx` | Client component: tab-filtered shelter applications |
| `src/components/foster/applications-list.tsx` | Client component: tab-filtered foster applications |
| `src/components/shelter/shelter-note-editor.tsx` | Client component: saves internal `shelter_note` |
| `src/components/shelter/accept-decline-buttons.tsx` | Client component: accept/decline/complete + optional `RatingDialog` / "Rate Foster" when completed |
| `src/components/shelter/rating-dialog.tsx` | Client: post-complete foster rating → `POST /api/ratings` |
| `src/components/shelter/dog-delete-button.tsx` | Client: confirmed delete → `DELETE /api/dogs/[id]` |
| `src/components/messages/message-thread.tsx` | Client: message list + send (optimistic append); initial payload from server |
| `src/components/portal-nav.tsx` | Client: shared foster/shelter nav (active state, mobile sheet, unread badge) |
| `supabase/migrations/` | Schema + RLS; includes recursion fix and messages read-column UPDATE hardening |

### API Routes

Under `src/app/api/`:

- `applications/[id]/accept` — **implemented**: auth → ownership → idempotency → status + dog update
- `applications/[id]/decline` — **implemented**: auth → ownership → idempotency → status update
- `applications/[id]/complete` — **implemented**: auth → ownership → idempotency → status + dog update
- `ratings` (`POST`) — **implemented**: shelter-only; completed application; idempotent (one rating per application)
- `dogs/[id]` (`DELETE`) — **implemented**: shelter ownership; 409 if dog has blocking applications
- `notifications/send` — **stub** returning placeholder JSON
- `upload/photo` — **stub** returning placeholder JSON

### ESLint

`argsIgnorePattern` and `varsIgnorePattern` are set to `^_` in `.eslintrc.json` so intentionally unused stub variables can be prefixed with `_` to suppress warnings.
