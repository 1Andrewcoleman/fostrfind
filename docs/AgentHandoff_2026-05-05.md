# Agent Handoff · 2026-05-05 — Pilot bugfix bundle, brand rename, Sentry hardening

Two-session run that closed the gap between "Phase 7 dev steps shipped" and "ready for the pilot shelter." All work landed on `main` and is deployed. Read this in conjunction with the **Pilot Status — 2026-05-05** snapshot near the top of [`docs/FinalRoadmap.md`](FinalRoadmap.md).

**Repo state at handoff:** working tree clean on `main`; pushed to `origin/main`. Latest commits: `bb23d61` (`chore(sentry): expose plugin output in CI builds`), `a7ebc3b` (`chore: rebrand to Fostr Find, plus pilot bugfix bundle and ops hardening`).

---

## 1. Things that need to stay true going forward

These are decisions or environment realities the next agent must NOT undo accidentally. They are not in the roadmap or other docs.

### 1.1 The dogs ↔ applications RLS recursion is fixed by a SECURITY DEFINER helper

[`supabase/migrations/20240119000000_fix_dogs_applications_rls_recursion.sql`](../supabase/migrations/20240119000000_fix_dogs_applications_rls_recursion.sql) introduces `public.get_my_applied_dog_ids()` and rewrites the `dogs: fosters can read dogs they applied to` policy to call it. The cycle was:

- `applications` INSERT policy (from §20240111) `WITH CHECK` queries `dogs`.
- `dogs` SELECT policy (from §20240105) queries `applications`.
- Postgres detects the loop at plan time and aborts every foster INSERT.

The helper uses `SECURITY DEFINER` to read `applications` without triggering RLS, breaking the cycle. **Do not "simplify" this back to an inline subquery on `applications`** — every foster application submit will fail again with `infinite recursion detected in policy for relation "applications"`.

This bug was latent from the moment §20240111 landed; it only surfaced when the first foster submitted via the new `POST /api/applications` route from §46.

### 1.2 Public dog SELECT is now `('available','pending','placed','adopted')`

[`supabase/migrations/20240118000000_dogs_public_read_all_statuses.sql`](../supabase/migrations/20240118000000_dogs_public_read_all_statuses.sql) replaces `dogs: fosters can read available` with `dogs: anyone can read listed statuses`. Public share links work for all four statuses.

If `DOG_STATUSES` ever grows (e.g. `'draft'`), update the policy in lockstep — otherwise a new status would silently NOT be publicly readable. Documented in the deferred-follow-ups log.

### 1.3 `withdrawn` is a real application status, not a soft-delete

[`POST /api/applications/[id]/withdraw`](../src/app/api/applications/[id]/withdraw/route.ts) now does `UPDATE … SET status = 'withdrawn'` instead of `DELETE`. The shelter retains visibility (a Withdrawn tab in [`shelter/applications-list.tsx`](../src/components/shelter/applications-list.tsx)). [`POST /api/applications`](../src/app/api/applications/route.ts) detects an existing withdrawn row for the same `(dog, foster)` pair and re-applies via `UPDATE` rather than colliding with `applications_dog_foster_unique`.

The previous `applications: foster can delete own` RLS policy from `20240111` is now unused but intentionally not dropped (deferred). `accept` / `decline` / `review` / `complete` routes already reject `withdrawn` via the existing status-set guards.

### 1.4 `next.config.mjs` defaults to `fostr-find` for both Sentry org and project

The Sentry dashboard project was renamed `javascript-nextjs` → `fostr-find` so the build's source-map upload finds the project. `silent: !process.env.CI` is intentional — keeps `next build` quiet locally, exposes upload progress and errors on Vercel (where `CI=1`). If the Sentry slug ever drifts from `fostr-find`, set `SENTRY_PROJECT` env var rather than editing the code default.

### 1.5 The new launch-ops audit is the source of truth for OPS-2 / 3 / 4 / 6

[`scripts/launch-ops-check.mjs`](../scripts/launch-ops-check.mjs) verifies storage buckets, env-var presence, schema (tables + Step-46 columns), pilot shelter `is_verified` state, and the `SUPPORT_EMAIL` constant. Run with `node scripts/launch-ops-check.mjs`. Returns exit 1 on failures so it can gate CI later. Currently reports **24 pass, 3 warn, 0 fail** (warns are: optional Sentry env vars not set locally, no shelter is_verified yet — both expected).

---

## 2. Codebase patterns that surfaced during this work

### 2.1 `MessageThread` calls `router.refresh()` on mount to clear stale layout-level unread badges

The portal layout's `getPortalLayoutData()` runs **before** the thread page's server-side `messages` `UPDATE { read: true }`, so the sidebar Messages badge was always one navigation behind. [`src/components/messages/message-thread.tsx`](../src/components/messages/message-thread.tsx) now `router.refresh()`-es once on mount via a `useEffect([router])`. Same pattern is used in [`src/components/notifications/notifications-list.tsx`](../src/components/notifications/notifications-list.tsx) after successful mark-read mutations.

Don't restructure either component to fetch counts client-side — the server-rendered layout query is the single source of truth. The refresh-on-mount pattern is the App Router-native way to invalidate it.

### 2.2 Date inputs absorb timezone wobble via local-calendar `min` + ±1-day server slack

[`src/lib/schemas.ts`](../src/lib/schemas.ts) `applicationCreateSchema` validates `available_from >= earliestAcceptableStartDate()` (today UTC minus one day). [`src/components/foster/application-form-dialog.tsx`](../src/components/foster/application-form-dialog.tsx) puts `min={todayLocalIso()}` on the native date input (computed via `Intl.DateTimeFormat('en-CA')`).

This was the actual fix for the Luna application failure: a Western-timezone late-evening submission would pass `available_from = "today-local"` which was already `< todayUtc`. The slack window absorbs that. Don't tighten it back to strict UTC equality without first adding a per-request user-timezone shipped from the client.

### 2.3 NotificationBell is removed; nav badge handles unread count

[`src/components/notifications/notification-bell.tsx`](../src/components/notifications/notification-bell.tsx) no longer exists (deleted in this session). [`src/components/portal-nav.tsx`](../src/components/portal-nav.tsx)'s `NavItem.badgeKey` union gained `'unreadNotifications'`, and the Notifications nav entries now carry the badge via the same mechanism as Messages and Invites. [`src/components/notifications/notification-ui.tsx`](../src/components/notifications/notification-ui.tsx) is still in use by [`notifications-list.tsx`](../src/components/notifications/notifications-list.tsx) — do not delete it.

### 2.4 `app/global-error.tsx` is required by Sentry and uses no project chrome

[`src/app/global-error.tsx`](../src/app/global-error.tsx) catches errors in the root layout itself (where per-segment `error.tsx` can't render because the layout that would have rendered it just crashed). Inline styles only — it cannot import the design tokens, fonts, or theme provider because they live in the dead layout. Adding this file silences a `[@sentry/nextjs] It seems like you don't have a global error handler set up...` warning emitted on every dev-server start and every Vercel build.

### 2.5 `instrumentation.ts` exports `onRequestError`

[`instrumentation.ts`](../instrumentation.ts) exports `onRequestError = Sentry.captureRequestError` (Next.js 15+ convention, supported by `@sentry/nextjs >= 8.28`). This auto-captures every unhandled server-side request error (RSC, route handlers, server actions) without the per-segment `error.tsx` having to capture explicitly. Per-segment captures still run as defense-in-depth.

---

## 3. Environment + tooling

### 3.1 `.env.local` keys added this session

| Key | Value |
|-----|-------|
| `NEXT_PUBLIC_SENTRY_DSN` | DSN for project `fostr-find` |
| `SENTRY_AUTH_TOKEN` | Org token (`fostr-find source maps`) |
| `RESEND_FROM` | `Fostr Find <noreply@fostrfind.com>` |
| `DEV_MASTER_SHELTER_EMAIL` | `dev-shelter@fostrfind.local` (renamed from `@fostrfix.local`) |
| `DEV_MASTER_FOSTER_EMAIL` | `dev-foster@fostrfind.local` (renamed) |

Same values must be mirrored in **Vercel → Settings → Environment Variables → Production**. They are.

### 3.2 Dev master accounts

`scripts/setup-master-accounts.mjs` was re-run to create the `@fostrfind.local` users. Existing passwords were re-used (the script reads them from `.env.local` first), so the credentials in [`docs/AgentHandoff_2026-04-21.md`](AgentHandoff_2026-04-21.md) and earlier are still valid — only the email half changed.

The old `@fostrfix.local` users are still in Supabase Auth. They can be deleted in **Authentication → Users** without affecting the app (which only references the new constants).

### 3.3 Live URL behavior the next agent should not be surprised by

- **Sentry never fires from `localhost`** — `enabled: process.env.NODE_ENV === 'production'` in all three config files. Manual test via `setTimeout(() => { throw new Error(...) }, 0)` on the deployed site only. A bare `throw` from devtools console is silently swallowed by Chrome's eval context (does not bubble to `window.onerror`).
- **Browser session events are not error events.** The `envelope/?sentry_version=7&sentry_key=…` POSTs you'll see in the Network tab on every page load are session pings (autoSessionTracking). Errors go via the same endpoint but with `{"type":"event"}` payload.
- **Sentry's onboarding shows a demo `TypeError: Object [object Object] has no method 'updateFrom'`** with `raven.js` stack frames. That is fake; resolve it in the dashboard.

---

## 4. What's left before the pilot shelter is invited

1. **OPS-5** — pick which of the 4 shelters in production DB is the pilot, then in Supabase SQL editor:
   ```sql
   UPDATE public.shelters
      SET is_verified = true
    WHERE name = '<pilot shelter name>';
   ```
   Verify by re-running `node scripts/launch-ops-check.mjs` — OPS-5 should flip from WARN to PASS.

2. **OPS-7** — work the 16-step end-to-end checklist in `docs/FinalRoadmap.md` lines ~439–461. Two browsers, both dev master accounts, run on the live URL (not `localhost`).

Everything else is green.

---

## 5. Known small things deliberately left alone

- The `[@sentry/nextjs] DEPRECATION WARNING: It is recommended renaming your sentry.client.config.ts file...` will appear on every Vercel build until we move that file's contents to `instrumentation-client.ts`. Cosmetic; only blocks Turbopack adoption. Logged in the Deferred Follow-ups Log.
- `webpack.cache.PackFileCacheStrategy` size warnings on every build are pure Next.js noise. Not actionable.
- Local workspace directory is still `Downloads/fostr_fix/`. Renaming to `fostr_find/` would break absolute paths in this file and earlier handoffs.

---

*Last updated 2026-05-05. Next agent: read **§ Pilot Status — 2026-05-05** in [`FinalRoadmap.md`](FinalRoadmap.md) for the at-a-glance state. The remaining gates are OPS-5 and OPS-7 — both are user actions, not code.*
