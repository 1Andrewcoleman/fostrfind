# Agent Handoff · 2026-04-20

Written for the next agent picking up this project. **Read this before doing anything else** — the roadmap and `CLAUDE.md` tell you *what* to build next; this tells you *what I learned by building Phase 3* that those files don't mention.

**Session covered:** Phase 3 Steps 23–30 complete (8/8 ✅). Work lives on the current working branch; merge/push is a user decision (see "Recommended first actions" below).
**Repo state at handoff:** working tree has Phase 3 code; three new SQL migrations + one diagnostic script were added but **must be applied by the user** (see "Migrations to apply" below). `git status` will also show `.serena/` metadata as untracked — ignore.

---

## What shipped

| § | Commit ref | Ship |
|---|------------|------|
| 23 | phase-3 step 23 | `20240109000000_add_indexes.sql` — indexes on `dogs.status`, `dogs.shelter_id`, `applications.{foster_id,shelter_id,dog_id,status}`, `messages(application_id,read)`, `shelters.user_id`, `foster_parents.user_id`. Slug already had a UNIQUE (hence unique index) from `20240101000000`, so no duplicate index. |
| 24 | phase-3 step 24 | `20240110000000_atomic_transitions.sql` — `SECURITY DEFINER` `accept_application`, `complete_application`, **and** `relist_dog` (scope expanded after finding `/api/dogs/[id]/status` did the same dual-UPDATE footgun). RPC swap in `/api/applications/[id]/accept|complete` + `/api/dogs/[id]/status`. |
| 25 | phase-3 step 25 | `scripts/phase-3-step-25-preflight.sql` (duplicate-detector) + `20240111000000_unique_constraints.sql` — `UNIQUE(dog_id, foster_id)` on applications, `UNIQUE(application_id)` on ratings, `UNIQUE(user_id)` on `foster_parents` + `shelters`. Also split the foster `FOR ALL` policy on applications into command-specific policies so the INSERT policy can require `dog.status = 'available'` without blocking UPDATE. |
| 26 | phase-3 step 26 | Audited every `supabase.auth.getUser()` call site. Server components `throw` on auth err (ErrorPanel catches); API routes return 503 for service err and 401 for no user; client components `toast.error` + redirect. Pattern is reproduced in every new route handler. |
| 27 | phase-3 step 27 | `ServerErrorPanel` + `isNextControlFlowError` (re-throws `NEXT_REDIRECT` / `NEXT_NOT_FOUND` / `DYNAMIC_SERVER_USAGE`); every portal server-rendered page wrapped in `try/catch` with inline warm error UI. Identity lookups (`shelters.user_id`, `foster_parents.user_id`) switched from `.single()` to `.maybeSingle()` so onboarding-state users redirect to `/onboarding` instead of hitting the panel. |
| 28 | phase-3 step 28 | Explicit `foster_id` / `shelter_id` filters on message thread queries (no more reliance on a single join). Shared Zod schemas in `src/lib/schemas.ts`. Auth pages (`/login`, `/signup`, `/auth/forgot-password`, `/auth/reset-password`) fully migrated to `react-hook-form` + `zodResolver`. Foster profile + shelter settings forms use `zodSchema.safeParse()` + manual `errors` state (hybrid — see Known trade-offs). |
| 29 | phase-3 step 29 | `describeAuthError` mapper (Supabase auth → user-friendly copy), `src/app/error.tsx` now shows static copy + logs `{ message, digest }` to console, every raw `error.message` surface replaced with static strings + `console.error`. `next.config.mjs` image `remotePatterns` verified narrow: `images.unsplash.com` + `*.supabase.{co,in}`. |
| 30 | phase-3 step 30 | `src/lib/rate-limit.ts` (in-memory `Map` bucket, `rateLimit()` + `rateLimitResponse()`) applied to all 12 API routes with per-route caps; `src/lib/sanitize.ts` (`sanitizeText` / `sanitizeMultiline`) strips HTML-ish tags on messages, application notes, shelter notes, ratings comments, dog fields, profile & settings free text; message body hard-capped at 4000 chars. |

Plus: Phase 3 Progress Tracker flipped to Complete, per-step `**Status:** ✅ ...` markers added to `docs/roadmap.md`, Deferred Follow-ups Log rows for Phase 3 deferrals.

---

## Migrations to apply (if you haven't)

Three SQL migrations were committed to `supabase/migrations/` but **`git add` does not apply them to your live Supabase project** — run each one via the SQL editor or `supabase db push`:

1. `20240109000000_add_indexes.sql` — pure index adds, safe to re-run (all `IF NOT EXISTS`).
2. `20240110000000_atomic_transitions.sql` — drops + recreates `accept_application`, `complete_application`, `relist_dog` (all `SECURITY DEFINER`, `SET search_path = public`). API routes now call these; applying late means accept/complete/relist will return 500 because the RPCs don't exist yet.
3. `20240111000000_unique_constraints.sql` — **run `scripts/phase-3-step-25-preflight.sql` first.** That script lists duplicate `(dog_id, foster_id)` applications, duplicate ratings, and duplicate `user_id`s. Resolve any rows it reports before applying the migration or `ALTER TABLE ADD CONSTRAINT` will fail at the first duplicate and roll back.

**Until you apply migration #2, Steps 24 + `/api/dogs/[id]/status` will 500 in production.** Until you apply migration #3, the unique constraints aren't enforced (the app still validates client-side, so the window of exposure is narrow, but it's not zero).

---

## Environment

- Node 25 still breaks `npx`. Use `node node_modules/next/dist/bin/next dev`, `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js src/` directly. Same as prior handoffs.
- `SUPABASE_SERVICE_ROLE_KEY` is still required for `/api/account/delete` only. The rest of Phase 3 is user-session-scoped and doesn't need it.
- DEV_MODE detection (`!process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')`) still works; everything new respects it. Rate limits still fire in DEV_MODE since they're cheap and don't touch the DB.

---

## Codebase patterns introduced in Phase 3

- **Error handling layering.** API routes: 503 for auth service err / 401 for no user / 5xx for data err, all return static copy. Server components: `try/catch` with `ServerErrorPanel` fallback, but always re-throw via `isNextControlFlowError(e)` first. Client components: `toast.error()` + `console.error(...)` with static user copy. **Anything new must follow this — don't invent a fourth pattern.**
- **Identity lookups are `.maybeSingle()`.** Any query by `user_id` on `shelters` / `foster_parents` is allowed to return `null` (user is mid-onboarding). The page then decides: redirect to `/onboarding`, fall back to an unauthenticated identity, or surface ServerErrorPanel. See `src/lib/portal-layout-data.ts` for the layout-level fallback and `src/app/(foster)/foster/profile/page.tsx` for the redirect pattern.
- **`isNextControlFlowError` must wrap every server-component `catch`.** Next's `redirect()`, `notFound()`, and `DynamicServerError` all throw as control flow. Swallowing any of these into `ServerErrorPanel` breaks navigation or forces a statically-rendered route where dynamic was intended. The helper covers all three; add new prefixes there if Next introduces them.
- **Zod schemas live in `src/lib/schemas.ts`** (auth + profile/settings). Use `.trim()` (not `preprocess`) so input/output types stay `string` and `@hookform/resolvers`'s zod v4 types don't complain. Optional trimmed strings `.transform(v => v === '' ? undefined : v)` so the caller can distinguish "cleared" from "untouched."
- **Rate limit + sanitize is per-route / per-field, not middleware.** Middleware-level rate limiting would hit Next's internal RSC prefetches. Call `rateLimit(route, user.id, { limit, windowMs })` right after auth check; return `rateLimitResponse(rl)` on miss. Strip free-text via `sanitizeText` / `sanitizeMultiline` at the write site (not at render).
- **`describeAuthError` is the single mapper for Supabase auth messages.** Do not `toast.error(error.message)` anywhere; do `toast.error(describeAuthError(error, 'fallback copy'))` + `console.error(...)` with the raw message. The mapper's `KNOWN_MAPPINGS` array is the allowlist — add entries there when new Supabase errors become common.

---

## Known trade-offs / deferrals

**All logged in `docs/roadmap.md` "Deferred Follow-ups Log" (2026-04-20 rows).** High-value ones to re-read before Phase 4:

1. **In-memory rate limiter is single-process.** Fine on a single Next.js server process, but does NOT survive serverless cold starts or multi-instance deploys. Swap for Upstash Redis or a Supabase `rate_limits` table before Phase 4 infrastructure work.
2. **Sanitizers are regex-based tag strippers, not real HTML sanitizers.** Safe for plaintext rendering (which is all we do today). If bios/descriptions ever become Markdown/rich-text, switch to DOMPurify (client) / `sanitize-html` (server) with an explicit allowlist.
3. **Foster profile + shelter settings forms are a hybrid** (Zod `safeParse` + manual `setErrors`), not full `react-hook-form`. Custom avatar/logo upload, tri-state checkboxes, and preference multi-selects didn't map cleanly onto RHF without a bigger refactor. Ships equivalent UX; logged as Phase 5 Polish.
4. **Supabase built-in auth rate limits are at defaults.** Adequate for MVP, but before public launch audit `auth.rate_limit.*` in the Supabase dashboard (`email_sent`, `sign_up`, `sign_in`, `token_refresh`) and lock them in.
5. **`shelter_ratings` RLS still only checks ownership, not application status.** Carried over from Phase 2 (logged 2026-04-19). Not tightened in Phase 3 because the API route still enforces `completed` and no caller bypasses the API. Phase 4 RLS pass should fold it in.
6. **TOS consent persistence** is still unaddressed. Schema migration for `terms_accepted_at` belongs alongside the next `shelters` / `foster_parents` schema touch.

---

## Things that should look broken but aren't

- **Build output briefly logs `[portal-layout-data] layout fetch failed: ...` during `next build` static generation.** This was ACTUALLY noise up until mid-session — `DynamicServerError` (thrown when `cookies()` is read during static analysis) was getting swallowed by the layout's `try/catch` then logged. `isNextControlFlowError` now catches it and re-throws so Next flips the route to dynamic. If you see those lines reappear after edits, double-check your new `catch` re-throws via `isNextControlFlowError`.
- **`error.tsx` hides the real error message from the user.** That's intentional — raw `error.message` can leak SQL snippets, auth details, stack paths. The full error is `console.error('[error-boundary]', { message, digest })` so devtools / server logs still have it. The user only sees "An unexpected error occurred" + the short `digest` hash.
- **Rate limit responses include `Retry-After` header.** Clients currently ignore it and show the 429 body as a toast, which is fine for MVP. A polished client retry is Phase 5 material.
- **`scripts/phase-3-step-25-preflight.sql` has no corresponding "apply" companion.** That's on purpose — dedupe is an ops decision. The script lists duplicates; the user decides whether to keep the oldest, newest, highest-rated, or manually-merged row, then issues `DELETE` statements.
- **Lots of `console.error(...)` everywhere.** Also intentional. When the UI shows static copy, the server / browser logs are the only way to debug. Don't collapse these to `// TODO log here` — they are the log.

---

## Recommended first actions for the next agent

1. **Ask the user whether to merge + push.** Nothing's on a feature branch this time — Phase 3 lives on whatever branch you're sitting on. Confirm the target (usually `main`) and whether they want squash vs merge. Do NOT force-push or rewrite history.
2. **Apply the three migrations** (§§23, 24, 25) in the Supabase SQL editor, **in numeric order**, running `scripts/phase-3-step-25-preflight.sql` between #2 and #3 if the Supabase project has any real user data. Without these:
   - #1 missing → queries work but slow
   - #2 missing → accept / complete / relist API routes **500 in production**
   - #3 missing → duplicate-prevention is client-side only
3. **Smoke-test the hardened surfaces** against a real Supabase project once migrations are in: apply for a dog twice (should hit the unique constraint with a friendly error), accept → dog flips to pending atomically, complete → dog flips to placed atomically, spam the accept button 25×/min (should start returning 429), submit a `<script>alert(1)</script>` message (should render inert text).
4. **Decide Phase 4's entry point.** The obvious candidates are the deferred geocoding pipeline (Phase 2 carry-over), the shared rate-limit store (Phase 3 carry-over), or the storage-orphans cleanup job (Phase 2 carry-over). Re-read the Deferred Follow-ups Log before picking.
5. **Before writing new code, re-read the Deferred Follow-ups Log** — 2026-04-19 + 2026-04-20 rows together are the complete "why didn't we..." index.

---

## Quick-command reference

```bash
node node_modules/typescript/bin/tsc --noEmit              # type-check
node node_modules/eslint/bin/eslint.js src/                # lint
node node_modules/next/dist/bin/next build                 # prod build smoke
node node_modules/next/dist/bin/next dev                   # dev server

# Apply migrations via Supabase CLI (alternative to SQL editor)
supabase db push
```
