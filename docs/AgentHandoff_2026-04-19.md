# Agent Handoff · 2026-04-19

Written for the next agent picking up this project. **Read this before doing anything else** — the roadmap and `CLAUDE.md` tell you *what* to build next; this tells you *what I learned by building Phase 2* that those files don't mention.

**Session covered:** Phase 2 Steps 13–22 complete (10/10 ✅). Merged to `main`.
**Repo state at handoff:** branch `main` contains all Phase 2 work. `claude/phase-2` branch is retained for reference; its worktree at `.claude/worktrees/phase-2` is still set up and symlinked.

---

## What shipped

| § | Commit | Ship |
|---|--------|------|
| 13 | `0cccf83` | Text search (name + breed, 300ms debounce, `?q=` URL param, removable chip) |
| 14 | `f6ccd98` | Pre-populate browse filters from `foster_parents.pref_*` on first visit only |
| 15 | `757a6ee` | Cursor-based pagination (24/page) with Load More |
| 16 | `3954c35` | Public `/shelters/[slug]` profile page + SEO metadata + 404 on bad slug |
| 17 | `b13e0bf` | Realtime messaging (`postgres_changes` INSERT channel, own-send dedupe, fire-and-forget mark-as-read) |
| 18 | `06aebd4` | `AccountSettingsForm` (password + email change, OAuth users skip password) |
| 19 | `4263873` | `POST /api/account/delete` — service-role admin, anonymize profile, cancel active apps, typed-`DELETE` confirm — note: commit body tags `§21` (a slip); it implements §19 |
| 20 | `7df342d` | Foster→shelter ratings: migration, API, dialog, surfaces on `/shelters/[slug]`, dog detail, browse cards + email CTA swap |
| 21 | `5c415ea` | `/terms` + `/privacy` static pages, required signup checkbox, footer links |
| 22 | `7ff7bb8` | Haversine distance filter: client + SQL mirror, slider, per-card mileage, `maxDist` URL param |
| docs | `3426423` | Deferred follow-ups log entries for §§20–22 + Phase 2 tracker flipped to complete |
| docs | (this) | Per-step `**Status:** ✅ Shipped ...` markers in roadmap + this handoff |

---

## Migrations to apply (if you haven't)

Three SQL migrations were committed to `supabase/migrations/` but **the committer does not run them against your live Supabase project** — you must apply each one via the SQL editor (per `CLAUDE.md`).

1. `20240106000000_realtime_messages.sql` — `ALTER PUBLICATION supabase_realtime ADD TABLE messages;`, wrapped in a `DO` block so re-running is idempotent. After applying, confirm in **Supabase Dashboard → Database → Publications** that `messages` appears in `supabase_realtime`. If Realtime is disabled at the project level, no events fire regardless of the publication — Step 17's channel subscription will silently no-op.
2. `20240107000000_shelter_ratings.sql` — new `shelter_ratings` table + RLS (public `select`, foster-only `insert` via `get_my_foster_ids()`, `UNIQUE(application_id)`).
3. `20240108000000_distance_miles.sql` — PL/pgSQL `distance_miles(lat_a, lon_a, lat_b, lon_b)` immutable function. Not yet called from the app; client-side haversine is the MVP filter. The function exists so a future `.rpc()` push-down doesn't have to renegotiate the distance contract.

**Until you apply migrations 1 and 2, Steps 17 and 20 will appear to work on the surface but actually fail silently** (no Realtime events, no ratings persist).

---

## Environment

- **The `.claude/worktrees/phase-2` worktree is still there.** `node_modules` and `.env.local` are symlinks to the parent repo (`ln -s ../../../node_modules` / `ln -s ../../../.env.local`). Do **not** `rm` either symlink. This setup sidesteps the ESLint plugin-duplication issue from Phase 1 (the 2026-04-18 handoff has the background).
- You can delete the worktree safely with `git worktree remove .claude/worktrees/phase-2` after confirming the merge is in. The branch `claude/phase-2` will still exist.
- Node 25 still breaks `npx`. Run `node node_modules/next/dist/bin/next dev`, `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js src/` directly.
- **`SUPABASE_SERVICE_ROLE_KEY` is required for Step 19 (account deletion).** The route returns 500 with a clear error if it's missing. The app still boots without it; only the Danger Zone button breaks.

---

## Codebase patterns introduced in Phase 2

- **Client-side rating aggregates are per-page, not per-shelter.** `BrowseDogCard` shows `shelter_avg_rating` but the browse page runs a second `select shelter_id, score from shelter_ratings where shelter_id in (...)` scoped to that page's shelters, then reduces to averages client-side. Cheap at PAGE_SIZE=24; moves server-side when browse gains SQL-level filtering (logged as a deferral).
- **Supabase Realtime clients must be memoized** or each render creates a new client and leaks channels. `MessageThread` uses `useMemo(() => createClient(), [])` before subscribing.
- **Dedupe optimistic messages on Realtime echo.** `MessageThread` checks `prev.some(m => m.id === incoming.id)` first; then if the incoming message is mine, it tries to find an `optimistic-*` placeholder and swap it. Incoming messages that aren't mine trigger a fire-and-forget `update({ read: true })` — the server enforces `sender_id != auth.uid()` via the `20240104000000_messages_update_rls_fix.sql` policy, so the client can't fraudulently mark someone else's messages.
- **Account deletion anonymizes, it doesn't hard-delete profile rows.** Applications and ratings on the other party's side stay coherent. The only hard delete is `auth.users` via the admin client. Storage objects (avatars, logos, dog photos) are **not** removed — logged as a deferral.
- **OAuth detection uses `user.app_metadata.provider`** for showing/hiding the password-change form. Multi-identity users (email + Google on the same account) get the OAuth treatment, which is fine for MVP. Multi-provider handling is logged as a deferral.
- **Distance filter is permissive.** A dog whose shelter lacks `latitude`/`longitude`, or a foster who hasn't been geocoded, produces `distance_miles = undefined` and passes the slider unconditionally. This is intentional — a partial geocode should not silently hide matches. When onboarding gets a geocoding pipeline (deferred), the filter can tighten.
- **Public routes live outside route groups.** `/shelters/[slug]`, `/terms`, `/privacy` all sit at `src/app/<path>/page.tsx` with no `AuthGuard` or `RoleGuard`. They render their own header/footer because they can't inherit from the `(shelter)` or `(foster)` sidebar layouts.

---

## Known trade-offs / deferrals

**All logged in `docs/roadmap.md` "Deferred Follow-ups Log" (2026-04-19 rows).** High-value ones to re-read before Phase 3:

1. **Client-side filtering still operates over loaded dogs only** (Steps 13 + 22). A foster with only the first 24 dogs loaded who types a rare breed or sets a tight distance can see 0 results even when matches exist deeper in the feed. Server-side filtering is the fix and belongs in Phase 3 §27.
2. **Rating policies only check ownership, not application status in RLS.** `shelter_ratings` RLS lets a foster insert for their own application regardless of status; the API route re-checks `completed`. Tighten in Phase 3 §27.
3. **TOS consent is gated at signup but never persisted.** Add `terms_accepted_at` to `foster_parents` + `shelters` when §28's validation work touches the schema.
4. **No geocoding pipeline.** Master accounts still have null `latitude`/`longitude`. The distance filter works end-to-end against seeded coords but is a no-op for real users until onboarding geocodes addresses.
5. **Storage orphans.** Deleting an account leaves their uploaded files in the bucket. Logged for a storage-hygiene cleanup job.
6. **No message-level moderation.** Ratings comments and message bodies are plain text, capped by Zod length only. Moderation is Phase 3 §26.
7. **Placement-completed email CTA is coarse.** It links to `/foster/history` now (was the thread URL). Deep-linking to a specific placement would shave a step.

---

## Things that should look broken but aren't

- **`docs/AgentHandoff_2026-04-18.md` is still in the repo.** That's the previous session's handoff; I kept it for continuity. This file (2026-04-19) is its successor. Feel free to delete the older one once you've read both.
- **`DEV_MODE` shelter-profile page shows zero dogs.** The placeholder `PLACEHOLDER_SHELTERS` in `src/app/shelters/[slug]/page.tsx` intentionally returns `dogs: []`. Browse in DEV_MODE has its own placeholders; the profile page would duplicate that logic for no real benefit. With a real Supabase project + seeded data the list populates normally.
- **`Instagram` is `AtSign` in the shelter profile page.** `lucide-react` doesn't export `Instagram`; `AtSign` was the closest visually-similar icon. Functionality is unchanged — the link still goes to `https://instagram.com/<handle>`.
- **Phase 2 Step 19's commit subject tags `§21`.** Typo in the commit message body. The code implements §19 (account deletion). The commit title is the single wrong thing about it; the route + form are correct.
- **Google OAuth signup bypasses the TOS checkbox client-side guard via URL jiggery.** The `Continue with Google` button is `disabled` when the box is unchecked and the `handleGoogleSignUp` function re-checks, but a determined user can always strip the disabled prop in devtools. Persisting consent server-side (deferral #3 above) is the real fix.

---

## Recommended first actions for the next agent

1. **Apply the three migrations** (§§17, 20, 22) in the Supabase SQL editor. Without this, §§17 and 20 will ship silently broken.
2. **Smoke-test the five new surfaces** against a real Supabase project: browse search + distance slider, public shelter profile, message thread (two-window), account deletion, foster→shelter rating after a completed placement.
3. **Decide Phase 3's entry point.** Hardening §§27–30 are the obvious next chunk, but the TOS consent persistence (§28-adjacent) and server-side browse filtering (§27) are the two items most likely to become user-visible in the interim.
4. **Before writing new code, re-read the Deferred Follow-ups Log** — it's the one source of truth for "why didn't we do X?" questions.

---

## Quick-command reference

```bash
# From repo root after merge
node node_modules/typescript/bin/tsc --noEmit              # type-check
node node_modules/eslint/bin/eslint.js src/                # lint
node node_modules/next/dist/bin/next dev                   # dev server

# Remove the phase-2 worktree once you're satisfied with the merge
git worktree remove .claude/worktrees/phase-2
git branch -D claude/phase-2                               # only after remove
```
