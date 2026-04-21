# Agent Handoff · 2026-04-22 (5th Session) — Phase 6.2 Shelter Roster

Written for the next agent picking up this project. Read this before doing anything else. Prior handoffs (`AgentHandoff_2026-04-20_session-4.md` last) cover the Phase 5-b visual migration and the first wave of Phase 6 (§6.1 + §6.3). This file covers the **Phase 6 §6.2 shelter-side foster roster** work — 9 commits landed this session.

**Session covered:** Phase 6 §6.2 Commits 1–9 (9/9). Work lives on `main` as nine standalone commits, each independently revertable.
**Repo state at handoff:** working tree clean on `main`; branch ahead of `origin/main` by 9 commits for this session (plus any session-4 commits that hadn't been pushed).

---

## What shipped (9 commits)

| # | SHA prefix | Title |
|---|-----------|-------|
| 1 | `1b316fe` | `feat(roster): migration for shelter_fosters + invites + notes (§6.2)` |
| 2 | `a50bbf5` | `feat(roster): types + domain helpers + service client (§6.2)` |
| 3 | `d4d46f4` | `feat(roster): auto-add on accept + onboarding invite email-claim (§6.2)` |
| 4 | `7d191ee` | `feat(roster): invite CRUD + email template (§6.2)` |
| 5 | `d0a329b` | `feat(roster): foster self-remove endpoint (§6.2)` |
| 6 | `27b9bed` | `feat(roster): /foster/invites page + sidebar badge (§6.2)` |
| 7 | `9a453b7` | `feat(roster): /foster/shelters-roster transparency page (§6.2)` |
| 8 | `ee9d077` | `feat(roster): /shelter/fosters index with invite form (§6.2)` |
| 9 | *this commit* | `feat(roster): /shelter/fosters/[fosterId] detail + notes + roadmap (§6.2)` |

`npm test` → **149 passing** (up from 100 at the start of the session). `tsc --noEmit` clean. `npm run build` has NOT been run in this session — see *What to verify before pushing* below.

---

## The product-decision quadrant that drove everything

Before writing the plan, the user was asked to pin four forks via an AskQuestion set. The answers are the soul of the feature — keep them in mind if you're extending this surface:

1. **Who gets onto a roster?** Exactly two paths: `application.status = 'accepted'` auto-adds, and shelter-initiated email invite (pre-signup supported via email-match claim at onboarding). **No global foster directory.**
2. **Messaging without an application?** **No** in v1. The existing `messages` table stays scoped by `application_id`. This is the foundation layer for a future **Herds** (emergency groups) feature — see the deferred follow-ups in `docs/roadmap.md`.
3. **Foster visibility?** **Full transparency** — `/foster/invites` + `/foster/shelters-roster` + self-removal.
4. **What shelter sees about rostered fosters?** Public profile + aggregate "currently fostering N" count (platform-wide, never per-shelter) + per-shelter interaction history + private notes.

The decision block was explicitly: "remove the original §6.2 privacy benchmark ('only fosters who have interacted with that shelter appear; no global foster search') and replace with the two-path model." That pivot is now encoded in the roadmap's §6.2 intent block.

---

## New primitives worth knowing about

### Database: three new tables (migration `20240113000000_shelter_foster_roster.sql`)

- `shelter_fosters (shelter_id, foster_id, added_at, source)` — **composite PK** chosen on purpose. The future `herd_members` table will `FOREIGN KEY (shelter_id, foster_id) REFERENCES shelter_fosters ON DELETE CASCADE` without reshape. `source` is a `CHECK` of `'application_accepted' | 'invite_accepted'`.
- `shelter_foster_invites (id, shelter_id, email, foster_id?, status, message, responded_at)`. Status is a `CHECK` of `'pending' | 'accepted' | 'declined' | 'cancelled'`. Partial unique index on `(shelter_id, lower(email)) WHERE status = 'pending'` — one pending per pair, but history unconstrained so re-invites after decline/cancel work.
- `shelter_foster_notes (id, shelter_id, foster_id, author_user, body, timestamps)` — shelter-staff-only; no foster-side policy.

**Service-role escalation is central to the design.** `shelter_fosters` has **no INSERT policy** — writes go through `createServiceClient()` from `src/lib/supabase/service.ts` in exactly two routes (accept upsert, invite-accept insert). `src/lib/__tests__/service-client-allowlist.test.ts` walks `src/` and fails if any other module imports the service client. Adding a new consumer requires updating the allowlist, which forces the privilege to be reviewed.

### `src/lib/shelter-roster.ts`

Three helpers used everywhere:
- `normalizeInviteEmail(x)` — trim + lowercase; matches the Postgres `lower(email)` used in both the partial unique index and the RLS policies. Always go through this when comparing emails.
- `isInvitePending(row)` — single-field check, centralised for future status states.
- `activeFosteringCount(supabase, fosterId)` — counts `applications where foster_id = X AND status = 'accepted'` platform-wide. Returns 0 on error, never throws.

### `portal-nav.tsx` badge refactor

The old `NavItem.showUnreadBadge: boolean` field was replaced by a discriminated `badgeKey: 'unreadMessages' | 'pendingInvites'` so multiple counters can drive sidebar badges without adding one prop per counter. `NavLinks` / `MobileNav` accept `unreadMessages` + `pendingInvites` and pass them as a `NavCounts` map into `NavLinkItem`. Adding a new badge later: add the new key to both the union and `NavCounts`, and pass the count through the shell.

### `getPortalLayoutData` return shape

`PortalLayoutData` now also contains `pendingInvites: number`. It's always 0 on the shelter side; on the foster side it counts pending invites matching either `foster_id` or `lower(email)` via a single `count: 'exact', head: true` query. Existing consumers that destructure only `{ unreadMessages, identity }` are unaffected because they ignore the new key.

### `PLACEHOLDER_SHELTERS` moved

Was exported from `src/app/shelters/[slug]/page.tsx` which is a Next.js route file. Route files can only export a fixed set of symbols (`default`, `metadata`, `generateMetadata`, etc.) — exporting anything else fails `tsc --noEmit` with TS2344. Moved to `src/lib/placeholder-shelters.ts`. If you're adding fixtures for a page, don't put them in the page file.

---

## Invariants that matter

- **Backwards compatibility contract:** no changes to existing table columns or policies. The migration is pure additive DDL. The accept-route upsert is wrapped and logs-then-continues on any failure, so the user-facing accept still succeeds if the roster write errors.
- **Roster status ≠ application status.** Leaving a roster does NOT cancel in-flight applications. The Remove dialog copy says so explicitly. Don't accidentally link them.
- **"Currently fostering N" is platform-wide.** It reveals a number, never which shelters. Don't narrow the query.
- **Fosters never read `shelter_foster_notes`.** There is no foster-side policy on that table. Don't add one.

---

## What to verify before pushing

`npm test` and `tsc --noEmit` are clean. The following were NOT run this session — do them before pushing or during the next session if you're continuing:

1. **`npm run build`** — Next.js route typing is pickier than `tsc --noEmit` alone. I already hit one TS2344 from the pre-existing `PLACEHOLDER_SHELTERS` export and fixed it; there may be more now that new routes have landed.
2. **Migration run in a real Supabase branch** — the migration has not been applied against a live DB this session. Do it via Supabase CLI against a throwaway branch, then run `scripts/verify-phase-6-62-migrations.sql` to assert the table/RLS/index/policy shape.
3. **End-to-end smoke** — log in as a shelter, invite a foster email that doesn't exist, sign up with that email, verify the onboarding hook claims the invite; log in as the foster and accept; log in as the shelter and confirm the foster shows on `/shelter/fosters`.

---

## Next obvious things to ship

From the deferred follow-ups logged against §6.2 (see the end of the `Deferred Follow-ups Log` table in `docs/roadmap.md`):

- **Herds** — shelter groups with broadcast/chat. The v1 schema is explicitly shaped for this; the blocker is UI + messaging model.
- **Generic notifications table** — v1 models invites as a first-class page, but when more notification types land, filter them on top of a real table.
- **Shelter-initiated removal/archive** — trivially additive once you decide whether it goes through the service client or gets its own policy. Recommended: service client, to keep the "two entry paths" symmetry.
- **Note edit/delete/audit log** — the table already has `updated_at` from the shared trigger; just needs a PUT/DELETE route and UI.
- **Invite token links** — if we later want branded magic-link URLs, add `/i/<token>`.

Every one of those can ship independently of any other Phase 6 slice.
