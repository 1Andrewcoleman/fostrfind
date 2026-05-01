# Agent Handoff · 2026-04-29 (6th Session) — Phase 6 Wrap (§6.4 / §6.5 / §6.6)

Read this before touching code. The previous handoff (`AgentHandoff_2026-04-22_session-5.md`) covered §6.2; this one covers the remainder of Phase 6 through §6.6 — mutual reporting, saved dogs with real aggregate counts, and the explicit deferral of the map view.

**Session covered:** Phase 6 §6.4 (mutual reporting), §6.5 (saved dogs), §6.6 (deferred). Two new migrations, two new API routes, one new portal page, two new shared components, ~22 new tests, plus the usual roadmap / TODO / Deferred Follow-ups Log housekeeping.

**Repo state at handoff:** working tree clean. `npm test` → **171 passing** (up from 162 at session start — +13 reports specs, +9 saves specs, plus the 149 already in place from earlier sessions). `tsc --noEmit` clean. `eslint src/` clean. `npm run build` clean — every new route compiles, including `/foster/saved`, `/api/reports`, and `/api/dogs/[id]/save`.

---

## Two product decisions worth preserving

Captured up-front via an `AskQuestion` set so the next agent can audit the brief without digging through chat:

1. **Order:** §6.4 → §6.5 → §6.6 (roadmap numeric order).
2. **Verification (§6.7) MVP:** confirmed email + manual shelter verification via an internal queue; foster ID checks deferred. **§6.7 is the next obvious slice.**
3. **Shelter verification path:** document upload + human review (EIN / 501(c)(3) docs).
4. **Map (§6.6):** defer until a real geocoding pipeline exists. List-only distance filter from Step 22 stays as the radius UX.

---

## §6.4 — Mutual reporting

### Schema (`supabase/migrations/20240114000000_reports.sql`)

`reports` table is application-scoped. Either the foster on the application OR the shelter owner can file a report against the OTHER party.

- **Subject XOR.** Exactly one of `subject_foster_id` / `subject_shelter_id` is non-null, enforced by both a table CHECK and the RLS WITH CHECK. The route picks which column based on the caller's role on the application — the client never sends a subject id.
- **Status enum** (`pending|reviewing|resolved|dismissed`) is in place from day one, but v1 inserts always land at `pending` and there is no UPDATE / DELETE policy. Status transitions belong to the deferred admin path via service role.
- **Indexes:** `(application_id)`, `(reporter_user_id, created_at desc)` for the per-reporter inbox, and `(status, created_at desc)` for the eventual triage queue.
- **RLS SELECT** is reporter-only; subjects do not see reports filed against them.

### Route (`src/app/api/reports/route.ts`)

Same shape as `src/app/api/ratings/route.ts`: Zod body schema, `getUser()` with 503/401, `rateLimit('reports:post', user.id, { limit: 5, windowMs: 60_000 })` (deliberately low — reporting is rare), `sanitizeMultiline` for the body. The application is fetched once with `!inner` joins to identify the caller as foster or shelter, the subject is derived, and the row is inserted.

**Idempotency** is on `(application_id, reporter_user_id)` *while status = 'pending'*. A re-file after triage closes the previous report is allowed by design — a NEW issue can land on the same pair.

### UI (`src/components/report-application-dialog.tsx`)

Shared between portals:
- Foster: `ApplicationStatusCard` action row, `compact` button (small ghost flag).
- Shelter: trailing footer of `/shelter/applications/[id]`, full-width ghost button.
The dialog has a `Select` (REPORT_CATEGORIES from `src/lib/constants.ts`), a `Textarea` capped at 4000 chars, inline links to `/terms` and `/privacy`, optimistic `toast.success`, and revert-and-toast on failure.

### Tests

`src/app/api/reports/__tests__/route.test.ts` — 13 specs. Covers auth-503/401, rate-limit, validation (UUID, category enum, empty body), 404 missing application, 403 stranger, 409 duplicate-pending, 500 paths, plus both happy paths (foster→shelter and shelter→foster).

---

## §6.5 — Saved dogs (with REAL aggregate counts)

### Schema (`supabase/migrations/20240115000000_dog_saves.sql`)

- `dog_saves (foster_id, dog_id, saved_at)` with composite PK, both FKs cascade.
- Foster RLS is the standard `get_my_foster_ids()` pattern — SELECT/INSERT/DELETE on own rows. **No UPDATE policy** — re-saves are no-ops via `ignoreDuplicates: true` in the API route.
- **Aggregate access for shelters is via RPC, not RLS.** `public.get_save_counts_for_my_dogs()` is `SECURITY DEFINER`, returns `(dog_id, save_count)` for every dog the caller's shelter owns (zero-included so the table always pivots cleanly). Shelters never read individual rows — only aggregates. This is the same shape we'd want when adding "popular" badges later, except the threshold is product-driven, not invented.

> The `.impeccable.md` "no fake metrics" guardrail is the reason aggregates live behind a real DB function. **Do not** introduce a UI surface that displays `saveCount` from anywhere other than the RPC or a `count: 'exact'` Supabase query — invented or hard-coded counts violate the trust-signal stance.

### Route (`src/app/api/dogs/[id]/save/route.ts`)

One file, two methods:
- **POST** = save (`upsert` with `ignoreDuplicates: true` for double-click safety), 60/min per foster.
- **DELETE** = unsave (idempotent — returns 200 even if no row existed).

Both methods share an `authedFosterId()` helper that resolves the user, looks up `foster_parents.id`, and returns either `{ kind: 'ok', ... }` or `{ kind: 'error', response }`. Saves require an actual foster profile (403 otherwise) — onboarding-incomplete shoppers can't save.

### Foster UI

- **`SaveDogButton`** (`src/components/foster/save-dog-button.tsx`) — heart toggle with optimistic flip, revert on error, two visual variants (`compact` icon-only with `aria-pressed`, default pill). Wired into `DogDetailFull` next to `ShareButton`.
- **`/foster/saved`** (`src/app/(foster)/foster/saved/page.tsx`) — server-fetched list ordered by `saved_at desc`, reuses `BrowseDogCard` so the visual language matches `/foster/browse`. Drops nulled `dog` rows defensively (RLS edge cases).
- Nav: new `Heart` item between Browse and My Applications in `FOSTER_NAV` (`src/components/portal-nav.tsx`).

### Shelter UI

`/shelter/dogs` calls `supabase.rpc('get_save_counts_for_my_dogs')` once, builds a `Record<dogId, count>`, and threads it into `ShelterDogsTabs` → `DogCard`. The active-tab card footer now reads:

> 0 applications  ·  3 saves

Failure of the RPC logs and falls back to zero counts so the dogs list never breaks because of saves.

### Seed

`scripts/seed.ts` writes one save per (foster × first-dog-of-shelter) so every QA refresh has non-zero counts. Reset path is unchanged — `dog_saves` cascades on the `dogs` delete.

### Tests

`src/app/api/dogs/[id]/save/__tests__/route.test.ts` — 9 specs covering both methods (auth, no-foster-profile 403, rate-limit, upsert/delete failure, idempotent DELETE, happy paths). The mock helper had to be left alone — a small `data: null, error: null` table result is enough to satisfy the upsert/delete chain.

---

## §6.6 — Deferred (geocoding precondition)

Decision documented in roadmap §6.6 + Deferred Follow-ups Log (2026-04-29). No code shipped. The blocker is unchanged from Step 22's note: shelter / foster `latitude` & `longitude` are sometimes NULL because there is no automated geocoder. Map UI on top of inconsistent coords would either silently drop shelters or fall back to the list — neither is better than the existing list-only distance filter.

Pre-conditions before the next slice on §6.6:
1. Pick a geocoder (Mapbox forward-geocoding, Google Geocoding, or Postgres + extension).
2. Wire onboarding/settings to capture & geocode `location` server-side.
3. One-shot backfill of existing rows.

After those land, the map itself is a small browse tab — markers for non-null coords, fit-bounds when foster coords exist, list fallback otherwise. Provider preference if/when it lands: **Mapbox GL JS** behind `NEXT_PUBLIC_MAPBOX_TOKEN` (soft-tier env in `src/lib/env.ts`), because it ships smaller and styles cleanly against the `.impeccable.md` palette. Google Maps would need a billing-enabled project and is overkill for a marker layer.

---

## Patterns / conventions reinforced this session

These are not new — but they were the load-bearing rules behind every file in the diff. Future agents should follow them on §6.7 and beyond.

- **Service role is allowlisted.** Reports + saves both use the caller's own Supabase client and rely on RLS; neither route imports `createServiceClient`. Don't reach for service role unless the existing allowlist test demands it (`src/lib/__tests__/service-client-allowlist.test.ts`).
- **Aggregates go through the DB.** When a shelter sees a count, it must be a real aggregate — either a `count: 'exact'` query or a `SECURITY DEFINER` RPC scoped to the caller's shelters. Hard-coding or estimating violates the design brief.
- **`ApplicationOwnershipRow` shape.** When a route needs to identify the caller as foster vs shelter on an application, do the `!inner` join in one round-trip with `foster:foster_parents!inner(user_id)` + `shelter:shelters!inner(user_id)`. The reports route is the canonical example now; copy that shape if you need it again.
- **`AskQuestion` first, then plan.** Before §6.4–§6.6 we surfaced the four product forks with `AskQuestion` to lock decisions in writing. The plan and this handoff both reference those answers verbatim. Keep doing that for §6.7.

---

## What to verify before pushing

The full Agent Code Quality Protocol checklist passed at session end:

- [x] `node node_modules/typescript/bin/tsc --noEmit` — clean.
- [x] `node node_modules/eslint/bin/eslint.js src/` — clean.
- [x] `node node_modules/next/dist/bin/next build` — clean. New routes compile (`/foster/saved`, `/api/reports`, `/api/dogs/[id]/save`).
- [x] `node node_modules/vitest/vitest.mjs run` — **171 passing** across 18 files.
- [ ] **Migrations applied to live Supabase** — NOT run from this session. Apply `20240114000000_reports.sql` and `20240115000000_dog_saves.sql` via `supabase db push` or the SQL editor before exercising the new surfaces against a real DB.
- [ ] **End-to-end smoke** — log in as foster + shelter on the same accepted application, file a report from each side, verify only the reporter sees their own row in `select * from public.reports`. Heart a dog from the foster side; confirm `/foster/saved` shows it and `/shelter/dogs` shows `1 save` for that dog.

---

## Suggested next slice (§6.7 verification)

The user already committed in writing to: confirmed email + manual shelter verification via an internal queue + document upload + human review, with no foster ID layer in MVP. That gives §6.7 a clear v1 cut:

1. New `shelter_verification_requests` table (or extend `shelters` with `is_verified`-adjacent columns) + RLS.
2. Storage bucket for uploaded EIN / 501(c)(3) docs (re-use the storage policies pattern from `20240112000000_storage_buckets.sql`).
3. Shelter-side request form on `/shelter/settings`.
4. Service-role-only flip of `is_verified` (admin queue is the deferred follow-up).
5. Verified badge surfaces wherever the shelter name shows: `BrowseDogCard`, `/shelters/[slug]`, `/foster/dog/[id]`.

The product question that still blocks scoping cleanly: what file types + size cap does the upload accept, and do we want a "pending review" badge in the meantime? Worth pinning before writing the migration.
