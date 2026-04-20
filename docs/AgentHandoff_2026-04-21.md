# Agent Handoff · 2026-04-21

Written for the next agent picking up this project. **Read this before doing anything else** — the roadmap and `CLAUDE.md` tell you *what* to build next; this tells you *what I learned while building Phase 4* that those files don't spell out.

**Session covered:** Phase 4 Steps 31–36 complete (6/6 ✅). Work lives on `claude/phase-4` (six self-contained commits). Merge to `main` is a user decision — see "Recommended first actions" below.
**Repo state at handoff:** working tree clean on `claude/phase-4`; `.serena/` metadata remains untracked (intentional, matches prior handoffs).

---

## What shipped

| Step | Commit | Ship |
|------|--------|------|
| 31 | `7586f9c` | `src/lib/env.ts` — runtime validation of env vars, split `BACKEND_VARS` (Supabase URL + anon key, required outside DEV_MODE) vs `PROD_VARS` (service role, Resend key/from, app URL, required in production). Throws in prod, warns in dev. Called once from `src/app/layout.tsx`. |
| 32 | `d541c8f` | `scripts/seed.ts` — multi-shelter dev seed (3 shelters, 5 fosters, 10 dogs, 15 applications spanning all 5 statuses, 30 messages, 5 ratings) via Supabase admin client, gated behind `SEED_I_UNDERSTAND=1`, `seed-` prefix on every email/slug so `--reset` can only touch seeded rows. Replaces old `scripts/seed-demo-data.mjs`. `tsx` dep + `npm run seed` script. |
| 33 | `99440f3` | `vitest.config.ts` (node env, `@/*` alias, `oxc.jsx.runtime: 'automatic'`), `src/lib/__tests__/helpers.test.ts` (9 helpers, 83 assertions total), `src/lib/__tests__/auth-routing.test.ts` (every `getPostAuthDestination` branch). `npm test` + `npm run test:watch`. |
| 34 | `05acc4c` | API route tests for `/api/applications/[id]/{accept,decline,complete}`, `/api/ratings`, `DELETE /api/dogs/[id]` — every branch (auth 503, unauthorized 401, rate-limit 429, not-found 404, forbidden 403, idempotency 409, DB failure 500, happy-path 200, email-send omission when recipient null). Shared `src/lib/__tests__/supabase-mock.ts`. |
| 36 | `5a39b78` | `src/app/error.tsx` redesigned (warm card + reference-ID digest + "Try again" / "Go home" / Contact support). New `(foster)/error.tsx` ("Back to browse") + `(shelter)/error.tsx` ("Back to dashboard"). All three log through `[error-boundary:root|foster|shelter]`. New `SUPPORT_EMAIL` constant. |
| 35 | `0ec1c80` | Portal layouts own a `title.template` (`%s — Fostr Fix`). Static `metadata.title` on every server-rendered foster + shelter page. `generateMetadata` for `<Name>'s Application` and `Edit <Dog Name>`. Client-only foster pages (`/foster/browse`, `/foster/dog/[id]`) got sibling `layout.tsx` files so titles work without dropping `'use client'`. |

Plus: Phase 4 Progress Tracker flipped to Complete, per-step `**Status:** ✅` markers added to `docs/roadmap.md`, Deferred Follow-ups Log rows for every Phase 4 deferral.

Commit order on the branch was **31 → 36 → 33 → 34 → 32 → 35** (lowest building blocks first, then polish outward). Reading the diffs in commit order is a reasonable onboarding path.

---

## Environment

- Node 25 still breaks `npx`. Use `node node_modules/next/dist/bin/next dev`, `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js src/` directly. `npm test` and `npm run seed` work because npm resolves the bin — it's specifically `npx` that's flaky.
- No new required env vars. `SUPABASE_SERVICE_ROLE_KEY` is still only needed by `/api/account/delete` and by `scripts/seed.ts` (the seed script errors out hard if it's missing — that's by design).
- `SEED_I_UNDERSTAND=1` is required by `scripts/seed.ts`. Without it the script refuses to run. First reset + re-seed looks like: `SEED_I_UNDERSTAND=1 npm run seed -- --reset`.

---

## Codebase patterns introduced in Phase 4

- **`generateMetadata` must never throw.** Every dynamic-metadata call site wraps the Supabase fetch in `try { … } catch { return { title: 'Fallback' } }` and short-circuits on `DEV_MODE` before any network call. If you add a new dynamic page (e.g. foster detail on the public site), follow the same shape — a thrown error in `generateMetadata` surfaces as a Next route error, not a missing title.
- **Client pages get metadata via a sibling server `layout.tsx`.** `src/app/(foster)/foster/browse/layout.tsx` and `.../foster/dog/[id]/layout.tsx` are pass-through server layouts (`export default function ({ children }) { return <>{children}</> }`) that exist solely to own `metadata` / `generateMetadata` for their `'use client'` sibling page. When another client page needs a title, mirror this pattern rather than converting the page off `'use client'`.
- **Route handler tests use the shared `supabase-mock.ts` helper.** The mock returns a thenable chain so `await supabase.from(...).select(...).eq(...)` works, and also exposes `.rpc`, `.insert`, `.update`, `.delete`. Add sequential responses via the `from()` / `rpc()` queues in the helper — a single test can thread through 3–4 table accesses without any polymorphism gymnastics.
- **Zod v4 `.uuid()` is strict on the v4 version nibble.** A fixture like `'11111111-1111-1111-1111-111111111111'` fails `.uuid()` because `1` isn't a valid version digit. Use a real v4 UUID (`'c88e2d80-4b23-4f5e-9b1f-5a1e7b4d5b2a'` works) in test fixtures for any body that runs through a Zod schema with `.uuid()`.
- **Vitest 4 uses `oxc` for transforms, not esbuild.** JSX in `.tsx` email templates needs `oxc: { jsx: { runtime: 'automatic' } }` in `vitest.config.ts`. Setting `esbuild.jsx` is silently ignored. If you see `Error: Failed to parse source for import analysis because the content contains invalid JS syntax` during a test run, that's the knob to turn.
- **Seed-script safety is prefix-based, not table-based.** Every seeded row's email / slug starts with `seed-`. `scripts/seed.ts --reset` ONLY deletes rows where the field starts with `seed-`, so legacy master accounts (the old `demo-*` / real emails from `seed-demo-data.mjs`) are left alone. When adding new seeded entities, keep the prefix discipline or `--reset` will leave them behind.

---

## Known trade-offs / deferrals

**All logged in `docs/roadmap.md` "Deferred Follow-ups Log" (2026-04-20 rows, Phase 4 block).** High-value ones to re-read before Phase 5:

1. **`src/lib/env.ts` is presence-only.** No Zod schema for URL format / key shape. A truncated Supabase URL, a malformed Resend key, or an app URL without a scheme will still pass. Upgrade path is a `zod.object({...}).parse(process.env)` call — scope in Phase 5 Polish / observability.
2. **Seed script does not populate Supabase Storage.** Dog photos are public unsplash URLs; avatars and logos are null. Image-upload flows can't be demoed end-to-end against seeded data. Extend the seed with admin-client uploads to the `dog-photos` / `avatars` / `shelter-logos` buckets if that demo path ever matters.
3. **No component tests yet.** `vitest.config.ts` is `environment: 'node'` because every test so far is a helper or Route Handler. When a component test lands, add `@testing-library/react` + `@testing-library/jest-dom` + `jsdom` and use a per-file `// @vitest-environment jsdom` directive rather than flipping the default.
4. **API route test coverage is 5 routes.** Still untested: `/api/applications/[id]/review`, `/withdraw`, `/api/dogs/[id]/status` (PATCH), `/api/account/delete`, `/api/upload/photo`, `/api/notifications/send`. The mock pattern drops in; schedule alongside CI so the suite actually gates merges.
5. **Metadata is titles only.** No `description`, no `openGraph`, no `twitter`, no `og:image`, no `sitemap.xml`, no `robots.txt`. Coordinate with Phase 5 Step 37 (landing page hero redesign) so the social-preview asset pipeline is done once.
6. **Error boundaries log to `console.error`, not Sentry.** Already listed in Remaining Items. The `[error-boundary:root|foster|shelter]` prefix is forward-compatible — whatever ingestion adapter lands later just swaps the `useEffect` log for a `captureException(error, { tags: { scope: '…' } })`.
7. **`SUPPORT_EMAIL = 'support@fostrfix.local'` is placeholder.** `.local` domain is deliberate so an accidental click in dev can't reach a real inbox. Swap to the real support address before public launch — single-point-of-truth in `src/lib/constants.ts`.

---

## Things that should look broken but aren't

- **Dynamic `generateMetadata` runs its own Supabase fetch, duplicating the page's query.** Both are `.maybeSingle()` so it's one extra in-flight DB call per SSR, not a per-request N+1. Acceptable at MVP scale; if it ever hurts, wrap the fetch in `React.cache` and share between `generateMetadata` + the page default export.
- **`src/app/(foster)/foster/browse/layout.tsx` looks empty.** It is — the whole point of that file is `export const metadata`. Deleting it removes the tab title for `/foster/browse` because the page itself is `'use client'`. Same reasoning for `.../foster/dog/[id]/layout.tsx`.
- **Seed script's "I'll wipe your data" confirmation is an env var, not a prompt.** `SEED_I_UNDERSTAND=1` is by design: we want to fail closed in CI, not hang on stdin. `--reset` also double-checks the prefix on every DELETE so even with the env var set, only `seed-*` rows are at risk.
- **`error.tsx` only logs to `console.error`.** Same deliberate decision as Phase 3's `error.tsx`: the user sees static copy + a short digest, the server / browser logs have the real error. Do NOT collapse those `useEffect` logs to `// TODO log here` — they are the log until Sentry lands.
- **Vitest test count: 83.** Splits as: `helpers.test.ts` (~60), `auth-routing.test.ts` (~5), five API route test files (~18). `npm test` should complete in <1s on a warm cache. If it ever blows past 5s, something's loading real Supabase.

---

## Recommended first actions for the next agent

1. **Ask the user whether to merge `claude/phase-4` to `main`.** The six commits are self-contained; a fast-forward merge is clean. I did not push and did not merge — that's a user call. Squash vs merge is also user preference (prior handoffs suggest non-squash so each step's commit hash stays resolvable from the roadmap's Status markers).
2. **Install the new dev deps.** `vitest` and `tsx` are in `package.json` but `npm install` needs to run on any checkout that predates this branch.
3. **Run the verification trio once after checkout.**
   ```bash
   node node_modules/typescript/bin/tsc --noEmit
   node node_modules/eslint/bin/eslint.js src/
   npm test
   ```
   All three should be clean. Tests should report "Test Files 7 passed (7) / Tests 83 passed (83)".
4. **Decide whether to seed.** `SEED_I_UNDERSTAND=1 npm run seed -- --reset` against a dev Supabase project populates 3 shelters + 5 fosters + 10 dogs + realistic application/messaging/rating history. Useful for Phase 5 UI work where empty states stop being interesting. Will fail hard if `SUPABASE_SERVICE_ROLE_KEY` isn't in `.env.local`.
5. **Before starting Phase 5, re-read the Deferred Follow-ups Log.** The 2026-04-19 + 2026-04-20 rows together are the complete "why didn't we..." index. Phase 5 Step 37 (landing page hero redesign) is the obvious entry point, but the metadata-only deferral from Step 35 means it'd be efficient to bundle OpenGraph / Twitter / og-image setup with Step 37 so the social-preview asset pipeline is built once.

---

## Quick-command reference

```bash
node node_modules/typescript/bin/tsc --noEmit              # type-check
node node_modules/eslint/bin/eslint.js src/                # lint
node node_modules/next/dist/bin/next build                 # prod build smoke
node node_modules/next/dist/bin/next dev                   # dev server
npm test                                                   # vitest run (83 tests)
npm run test:watch                                         # vitest watch

# Dev seed (requires SUPABASE_SERVICE_ROLE_KEY + real Supabase URL)
SEED_I_UNDERSTAND=1 npm run seed -- --reset
```
