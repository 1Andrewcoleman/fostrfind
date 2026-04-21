# Phase 6 · 6.2 — Shelter-side foster roster (plan)

**Date:** 2026-04-22
**Status:** Plan — pending implementation
**Source:** Brainstorming session 2026-04-22 (user answered AskQuestion set; see agent transcript)
**Roadmap anchors:** `docs/roadmap.md` §6.2
**TODO anchor:** `docs/TODO.md` §27 (Phase 6 backlog mirror)

This plan covers a single Phase 6 slice: a **shelter-side roster of fosters** with shelter-initiated invites, foster-side transparency, and backwards-compatible auto-population from accepted applications. It deliberately lays the foundation for a future **"Herds" emergency-group feature** without shipping any group UI yet.

---

## 1. Product scope (decisions already locked)

### 1.1 Who can be on a shelter's roster

- **Auto-add path**: when an application transitions to `status = 'accepted'`, the foster is auto-added to that shelter's roster (idempotent — no-op if already present).
- **Invite-by-email path**: the shelter enters a foster's email and optionally a short note; the foster gets an email **and** an in-app invite surface; foster accepts or declines.
  - Works for **already-declined applicants** (the shelter can still keep in touch) using the same invite flow.
  - Works for **fosters who don't have an account yet**: the invite is pre-created keyed on the email; on signup + onboarding completion, pending invites are auto-linked to the new `foster_parents.id`.
- **No other paths** in v1. No silent adds. No global foster directory. The shelter never sees a foster who hasn't been on one of the two paths above.

### 1.2 What the shelter sees per roster entry

- **Public fields only from `foster_parents`**: first/last name, avatar, bio, location *area* (existing `location` column is city-level today — acceptable; no street address exposed), `pref_size`, `pref_age`, `pref_medical`.
- **Aggregate "currently fostering" count**: number of `applications` where `foster_id = X AND status = 'accepted'` **across all shelters**. Leaks a number, **not** which shelters. Revealed as `Currently fostering N animal(s)`.
- **Per-shelter interaction history**: past `applications` rows between this shelter and this foster, including dog, status, dates. Already visible via existing application RLS; the roster page just presents the join alongside the profile.
- **Private shelter-side notes**: new `shelter_foster_notes` table, scoped to (shelter, foster) with shelter-staff-only read/write.

### 1.3 What the foster sees / controls

- **`/foster/invites`**: pending invites from shelters, with accept/decline. Sidebar badge shows the count, mirroring the existing unread-messages pattern.
- **`/foster/shelters-roster`**: transparent view of every shelter currently holding this foster on their roster. Per-row "Remove me" button that hard-deletes the `shelter_fosters` row.
- No notification in v1 when a shelter auto-adds a foster via accepted application (the acceptance itself is already surfaced; adding a second signal is noise). Auto-adds still appear in `/foster/shelters-roster`.

### 1.4 Messaging (explicit non-goal in v1)

- A shelter **cannot** message a foster without an active application thread. Existing `messages` table + RLS stays untouched.
- Direct messaging / "ping foster about dog X" / Herds group chats are deferred — this plan sets the **data foundation** (`shelter_fosters`) that a future Herds layer will build on.

---

## 2. Backwards compatibility contract

Non-negotiable constraints for this plan:

1. **No changes to existing tables' columns or types** except adding indexes. New tables only.
2. **No changes to existing RLS policies on existing tables.** New tables get their own policies.
3. **No changes to existing routes' contracts.** New surfaces only:
   - `/shelter/fosters`, `/shelter/fosters/[fosterId]` (shelter portal)
   - `/foster/invites`, `/foster/shelters-roster` (foster portal)
   - `POST /api/shelter/foster-invites`, `POST /api/shelter/foster-invites/[id]/accept`, `POST /api/shelter/foster-invites/[id]/decline`, `POST /api/shelter/foster-invites/[id]/cancel`, `DELETE /api/foster/shelter-roster/[shelterId]`
4. **Accept-application route gets one additional action** (upsert into `shelter_fosters`). Wrapped so a duplicate-key or RLS failure **does not fail the accept operation**. Logged and continues.
5. **Sidebar badge addition is purely additive** — `FosterPortalShell` accepts a new optional `pendingInvites` prop defaulting to `0`. Existing callers don't need changes; new invite page surface passes the count.
6. **Existing email templates stay the same**; a 6th template `ShelterFosterInviteEmail` is added. No change to the 5 existing ones' signatures.
7. **Auto-match on signup**: onboarding completion hook (the part where `foster_parents` row is first inserted) runs a single `UPDATE shelter_foster_invites SET foster_id = new.id WHERE email = new.email AND foster_id IS NULL`. No change if there are no matching invites.
8. **Rollback plan per commit** lives inline below; each commit is independently revertable.

---

## 3. Data model

All new tables. All additive. No column changes to existing tables.

### 3.1 `shelter_fosters` — many-to-many roster

```sql
create table public.shelter_fosters (
  shelter_id  uuid not null references public.shelters(id)        on delete cascade,
  foster_id   uuid not null references public.foster_parents(id)  on delete cascade,
  added_at    timestamptz not null default now(),
  source      text not null check (source in ('application_accepted', 'invite_accepted')),
  primary key (shelter_id, foster_id)
);

create index shelter_fosters_foster_idx on public.shelter_fosters (foster_id);
```

**Why composite PK instead of `id uuid`:** natural key; matches the "one row per relationship" semantic; eliminates a whole class of duplicate bugs without needing a secondary unique constraint.

### 3.2 `shelter_foster_invites` — pending / historical invites

```sql
create table public.shelter_foster_invites (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  shelter_id   uuid not null references public.shelters(id)       on delete cascade,
  email        text not null,
  foster_id    uuid references public.foster_parents(id)          on delete set null,
  status       text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  message      text
);

-- Partial unique index: one pending invite per (shelter, email) at a time.
-- History rows (accepted/declined/cancelled) are unconstrained so a shelter
-- can legitimately re-invite a foster who previously declined.
create unique index shelter_foster_invites_pending_uniq
  on public.shelter_foster_invites (shelter_id, lower(email))
  where status = 'pending';

create index shelter_foster_invites_foster_idx on public.shelter_foster_invites (foster_id)
  where foster_id is not null;
create index shelter_foster_invites_email_idx  on public.shelter_foster_invites (lower(email))
  where status = 'pending';
```

### 3.3 `shelter_foster_notes` — private per-relationship notes

```sql
create table public.shelter_foster_notes (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  shelter_id  uuid not null references public.shelters(id)       on delete cascade,
  foster_id   uuid not null references public.foster_parents(id) on delete cascade,
  author_user uuid not null references auth.users(id)            on delete set null,
  body        text not null
);

create index shelter_foster_notes_pair_idx on public.shelter_foster_notes (shelter_id, foster_id);

create trigger shelter_foster_notes_updated_at
  before update on public.shelter_foster_notes
  for each row execute procedure public.handle_updated_at();
```

### 3.4 RLS policies

```sql
alter table public.shelter_fosters         enable row level security;
alter table public.shelter_foster_invites  enable row level security;
alter table public.shelter_foster_notes    enable row level security;

-- shelter_fosters: shelter reads/deletes own rows, foster reads/deletes own rows.
create policy "shelter_fosters: shelter read own"
  on public.shelter_fosters for select
  using (shelter_id in (select id from public.shelters where user_id = auth.uid()));

create policy "shelter_fosters: foster read own"
  on public.shelter_fosters for select
  using (foster_id in (select id from public.foster_parents where user_id = auth.uid()));

-- Foster-initiated self-removal. Shelter-initiated removal deferred.
create policy "shelter_fosters: foster delete own"
  on public.shelter_fosters for delete
  using (foster_id in (select id from public.foster_parents where user_id = auth.uid()));

-- INSERT is intentionally service-role only in v1 (API routes use the service
-- client via `createServiceClient()` for these writes). Keeps the membership
-- contract ("only two paths in") enforced in one place — the API layer —
-- rather than duplicated across policies + app code.

-- shelter_foster_invites: shelter manages own; foster reads/responds to theirs.
create policy "invites: shelter manage own"
  on public.shelter_foster_invites for all
  using (shelter_id in (select id from public.shelters where user_id = auth.uid()))
  with check (shelter_id in (select id from public.shelters where user_id = auth.uid()));

create policy "invites: foster read own"
  on public.shelter_foster_invites for select
  using (
    foster_id in (select id from public.foster_parents where user_id = auth.uid())
    or lower(email) = lower(coalesce((select email from public.foster_parents where user_id = auth.uid()), ''))
  );

-- Foster responds to their own invite — UPDATE limited to the status+responded_at fields
-- via a check constraint on the update column set is enforced at API layer (not a
-- per-column RLS policy in v1).
create policy "invites: foster respond to own"
  on public.shelter_foster_invites for update
  using (
    foster_id in (select id from public.foster_parents where user_id = auth.uid())
    or lower(email) = lower(coalesce((select email from public.foster_parents where user_id = auth.uid()), ''))
  );

-- shelter_foster_notes: shelter-staff-only, both read and write.
create policy "notes: shelter manage own"
  on public.shelter_foster_notes for all
  using (shelter_id in (select id from public.shelters where user_id = auth.uid()))
  with check (shelter_id in (select id from public.shelters where user_id = auth.uid()));
```

### 3.5 Forward-compat note for Herds (not built here)

A future `herds` table will reference `shelter_fosters` as its membership source:

```sql
-- NOT in this plan — documented for the record.
create table public.herds (
  id uuid primary key default gen_random_uuid(),
  shelter_id uuid not null references public.shelters(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('emergency', 'general'))
);
create table public.herd_members (
  herd_id uuid references public.herds(id) on delete cascade,
  shelter_id uuid not null,
  foster_id  uuid not null,
  primary key (herd_id, foster_id),
  foreign key (shelter_id, foster_id) references public.shelter_fosters (shelter_id, foster_id) on delete cascade
);
```

This plan **ensures** `shelter_fosters (shelter_id, foster_id)` is a natural primary key exactly so the future `herd_members` table can FK to it without any re-shape.

---

## 4. Architecture decisions

### 4.1 Auto-add on `application.accepted` — in API, not a DB trigger

The existing `POST /api/applications/[id]/accept` route (`src/app/api/applications/[id]/accept/route.ts`) is the single, guarded entry point for application acceptance. We add the upsert there, wrapped so a failure is logged and does not fail the accept.

Rationale over a DB trigger:

- The API route already does auth + shelter-ownership checks; adding one more write there is trivial and testable.
- A trigger would need a SECURITY DEFINER function to bypass the service-role-only INSERT policy. More moving parts, harder to reason about in the RLS audit.
- Keeping the logic in one place means the same flow works if we ever re-route acceptance through a different mechanism (e.g. batch accept).

### 4.2 Service client for membership writes

New helper `src/lib/supabase/service.ts` (if not already present — check in commit 1) returns a Supabase client built with `SUPABASE_SERVICE_ROLE_KEY`. Only invoked server-side, only for the three membership writes:

- Insert into `shelter_fosters` on accept or invite-accepted.
- Match-by-email onboarding hook (`UPDATE invites SET foster_id = ?`).
- (Nothing else.)

All other reads/writes still go through the standard `createClient()` with the caller's JWT — RLS stays in charge.

### 4.3 "Notifications inbox" ≠ a new notifications table

The user's phrasing "put a notification to accept in their notifications inbox" is satisfied by:

- A dedicated foster surface `/foster/invites` (first-class page, not a dropdown).
- A sidebar count badge on the foster portal sidebar (mirrors the existing `unreadMessages` badge in `FosterPortalShell`).
- A transactional email (`ShelterFosterInviteEmail`) sent on invite creation.

No generic notifications table. If Phase 6 later adds one, the invites page becomes a filtered view of it; nothing in this plan blocks that.

### 4.4 Email-first for pre-signup invites

When the shelter invites a non-existent email:

- Invite row is created with `foster_id = null`.
- `ShelterFosterInviteEmail` is sent, copy: "Visit fostrfix.com to sign up and accept this invitation from <Shelter Name>."
- The signup+onboarding hook (commit 3) claims any pending invites matching the new foster's email when the `foster_parents` row is first inserted.
- No magic-link token in the email body. Keeps the email copy simple and avoids one more secret to rotate.

---

## 5. Implementation plan — 9 commits

Each commit is independently revertable. `npm test` passes after every commit. Every commit includes the verification steps to run.

### Commit 1 — Migration: new tables + RLS + indexes

**Files**

- `supabase/migrations/20240113000000_shelter_foster_roster.sql` (new)
- `scripts/verify-phase-6-62-migrations.sql` (new; mirrors `scripts/verify-phase-3-migrations.sql` style)
- `docs/roadmap.md` — no edits yet; final marker comes in commit 9

**Contents:** tables and policies from §3.1 – §3.4 verbatim, plus `alter table ... enable row level security` lines.

**Verification**

1. `supabase db push` in a throwaway branch DB (or local Supabase) completes without error.
2. Run `scripts/verify-phase-6-62-migrations.sql`; assertions: three tables exist, RLS enabled, four indexes present, partial unique index exists on `lower(email)` where `status='pending'`.
3. Manual RLS probe:
   - As a foster user: `select * from shelter_fosters` returns only rows where their foster_id matches; `delete` of another foster's row rejected.
   - As a shelter user: `select * from shelter_fosters` returns only their shelter's rows.
   - As a shelter user: `insert` into `shelter_fosters` rejected (service-role only).
4. `npm test` passes (no application changes yet).

**Rollback:** `drop table public.shelter_foster_notes, public.shelter_foster_invites, public.shelter_fosters cascade;`

---

### Commit 2 — Types + domain helpers

**Files**

- `src/types/database.ts` — add three new row types (`ShelterFosterRow`, `ShelterFosterInviteRow`, `ShelterFosterNoteRow`) alongside the existing ones.
- `src/lib/shelter-roster.ts` (new) — pure TS helpers:
  - `normalizeInviteEmail(email: string): string` — lowercase + trim; shared between server read and client input.
  - `isInvitePending(row: ShelterFosterInviteRow): boolean`
  - `activeFosteringCountQuery(supabase, fosterId) => Promise<number>` — reusable `.from('applications').select('id', { count: 'exact', head: true }).eq('foster_id', fosterId).eq('status', 'accepted')`.
- `src/lib/supabase/service.ts` (new, if missing) — `createServiceClient()` that hard-throws when `SUPABASE_SERVICE_ROLE_KEY` is missing in prod and returns a mock in DEV_MODE.
- `src/lib/__tests__/shelter-roster.test.ts` (new) — unit tests for the pure helpers (no DB).

**Verification**

1. `npm test` — new tests pass; existing tests unaffected.
2. `npm run build` — no type errors.

**Rollback:** delete files; revert `src/types/database.ts` additions.

---

### Commit 3 — Hook auto-add into `POST /api/applications/[id]/accept` + onboarding email-match hook

**Files**

- `src/app/api/applications/[id]/accept/route.ts` — after the existing `status = 'accepted'` transition succeeds:
  ```ts
  try {
    const svc = createServiceClient()
    await svc
      .from('shelter_fosters')
      .upsert(
        { shelter_id: application.shelter_id, foster_id: application.foster_id, source: 'application_accepted' },
        { onConflict: 'shelter_id,foster_id', ignoreDuplicates: true },
      )
  } catch (e) {
    console.error('[applications/accept] roster upsert failed, continuing:', e instanceof Error ? e.message : String(e))
  }
  ```
- `src/app/api/applications/[id]/accept/__tests__/route.test.ts` — add two cases:
  - Accept inserts roster row on first acceptance.
  - Second acceptance for same foster is a no-op (idempotent).
  - Upsert failure does not fail the route (mock service client to throw).
- `src/components/foster/foster-onboarding-form.tsx` **or** wherever the `foster_parents` insert finally lands in onboarding (check — likely `src/app/onboarding/foster/...`): after the `foster_parents` insert succeeds, fire:
  ```ts
  await supabase
    .from('shelter_foster_invites')
    .update({ foster_id: newFosterId })
    .is('foster_id', null)
    .ilike('email', newFoster.email)
    .eq('status', 'pending')
  ```
- Add a regression test for the onboarding claim path.

**Verification**

1. `npm test` — including the new cases.
2. Manual: in DEV_MODE, no-op (no Supabase). In a real env: create an invite for `foo@example.com`, sign a new user up with that email, verify the invite's `foster_id` is populated.

**Rollback:** revert the accept route block and the onboarding claim call.

---

### Commit 4 — Email template + API: invite CRUD endpoints

**Files**

- `src/emails/shelter-foster-invite.tsx` (new) — styled like the existing five, props `{ shelterName, fosterEmail, message?, signinUrl }`.
- `src/app/api/notifications/send/route.ts` — add `'shelter-foster-invite'` to `TYPES`, extend the switch. Preserve all existing behavior.
- `src/app/api/shelter/foster-invites/route.ts` (new) — `POST` creates a pending invite. Body `{ email, message? }`. Returns the invite row. Side effects: if `email` resolves to an existing `foster_parents` row, set `foster_id` at creation time. Send email via the existing notifications pipeline (fire-and-forget with `void`).
- `src/app/api/shelter/foster-invites/[id]/accept/route.ts` (new) — `POST`. Caller must be a foster whose foster_parents email matches (or whose `foster_id` is already linked). Transitions `status` to `accepted`, sets `responded_at`, inserts into `shelter_fosters` via service client with `source='invite_accepted'`.
- `src/app/api/shelter/foster-invites/[id]/decline/route.ts` (new) — `POST`. Same auth. Sets `status='declined'`, `responded_at`.
- `src/app/api/shelter/foster-invites/[id]/cancel/route.ts` (new) — `POST`. Caller must be shelter staff of the owning shelter. Sets `status='cancelled'`.
- Tests for all four routes in `__tests__/`. Cover the RLS path (caller who's neither shelter nor invited foster is rejected), the pre-signup case (foster_id null at invite creation), and the double-accept case (second accept is rejected because status isn't pending).

**Verification**

1. `npm test` — all four routes' tests green.
2. Manual via Thunder / curl: shelter creates invite → foster sees it via GET; foster accepts → `shelter_fosters` has the row; re-accept rejected.
3. Verify `[email]` console log fires in DEV_MODE (no real send required).

**Rollback:** delete new route files, revert notifications/send TYPES, delete email template.

---

### Commit 5 — API: foster self-remove from roster

**Files**

- `src/app/api/foster/shelter-roster/[shelterId]/route.ts` (new) — `DELETE`. Auth: caller must be a foster. Resolves caller's `foster_id` then deletes the `shelter_fosters` row with the caller's JWT (RLS does the ownership check, not the route).
- `__tests__` — own-delete succeeds, other-foster delete rejected, missing row returns 404.

**Verification**

1. `npm test` passes.
2. Manual: Foster A in Shelter X's roster → DELETE → row gone → A no longer appears in X's `/shelter/fosters`.

**Rollback:** delete the route.

---

### Commit 6 — Foster portal: `/foster/invites` + sidebar badge

**Files**

- `src/components/foster-portal-shell.tsx` — add optional prop `pendingInvites?: number` (default `0`); render a small count badge next to an "Invites" nav link. Existing callers unchanged (pass nothing = badge hidden).
- `src/components/portal-nav.tsx` (or wherever nav links are assembled) — add an `Invites` item conditional on the new prop being > 0 (always render the link, just no badge when 0).
- `src/lib/portal-layout-data.ts` — extend `getPortalLayoutData('foster')` to also fetch the pending-invite count for the current foster. Shape returned by this helper grows by one field; existing consumers ignore new keys.
- `src/app/(foster)/layout.tsx` — pass `pendingInvites` into `FosterPortalShell`.
- `src/app/(foster)/foster/invites/page.tsx` (new) — server component, lists pending invites for the current foster (via email fallback + foster_id); each row has Accept / Decline buttons that POST to the new API routes.
- `src/app/(foster)/foster/invites/invite-actions.tsx` (new, client) — the accept/decline button pair with `useRouter().refresh()` on success and toast feedback.
- `src/app/(foster)/foster/invites/loading.tsx` (new).
- Route tests for the page's data contract.

**Verification**

1. `npm test`.
2. Manual: create an invite via Supabase SQL, load `/foster/invites`, accept it, confirm it vanishes and `/foster/shelters-roster` shows the shelter (commit 7 dependency — for this commit's verification, confirm via SQL).
3. Sidebar badge shows `1` before accept and disappears after.
4. Pre-existing foster routes render identically (no regression in sidebar chrome).

**Rollback:** revert `FosterPortalShell`, `portal-nav`, `portal-layout-data`, delete the invites route files.

---

### Commit 7 — Foster portal: `/foster/shelters-roster`

**Files**

- `src/app/(foster)/foster/shelters-roster/page.tsx` (new) — server component, lists every `shelter_fosters` row for the current foster, joined with `shelters` for name/logo. Per-row **Remove me** button.
- `src/app/(foster)/foster/shelters-roster/remove-button.tsx` (new, client) — confirm dialog + DELETE call + refresh.
- `src/app/(foster)/foster/shelters-roster/loading.tsx` (new).
- Empty state: `EmptyState` component with copy "No shelters have added you yet."
- Add a link to this page from the foster dashboard (small discovery card). No layout shifts.

**Verification**

1. `npm test`.
2. Manual: foster with two roster entries sees both; Remove removes one, confirms via `/shelter/fosters` (next commit) that the foster is gone from that shelter's list.
3. Foster with no entries sees the empty state.

**Rollback:** delete new route files; revert the dashboard link.

---

### Commit 8 — Shelter portal: `/shelter/fosters` index

**Files**

- `src/app/(shelter)/shelter/fosters/page.tsx` (new) — server component, lists roster members for the caller's shelter. Columns: avatar, name, location area, `Currently fostering N animal(s)` badge, "View" link. Optional `?q=` name filter (case-insensitive, roster-scoped only — no global directory).
- `src/app/(shelter)/shelter/fosters/invite-form.tsx` (new, client) — a visible card at the top with email + optional message input, POSTs to `/api/shelter/foster-invites`.
- `src/app/(shelter)/shelter/fosters/loading.tsx` (new).
- Nav link added in the shelter sidebar (`src/components/shelter-portal-shell.tsx` — or equivalent).
- Empty state when no fosters exist yet.
- Tests for the server data contract.

**Verification**

1. `npm test`.
2. Manual: shelter with no roster entries sees empty state + visible invite form; inviting an existing foster's email → invite appears in that foster's `/foster/invites`; accepting it back adds them to this shelter's index.
3. Search filters by name (substring, case-insensitive).
4. Active-count badge: manually set an application to `accepted` and confirm the count updates for that foster.
5. Pre-existing shelter routes render identically.

**Rollback:** delete new route files; revert sidebar addition.

---

### Commit 9 — Shelter portal: `/shelter/fosters/[fosterId]` detail + notes

**Files**

- `src/app/(shelter)/shelter/fosters/[fosterId]/page.tsx` (new) — server component. Authorized if the pair `(shelter_id, foster_id)` exists in `shelter_fosters`. Shows:
  - Public profile block (name, avatar, bio, `pref_size`, `pref_age`, `pref_medical`, location).
  - Aggregate "Currently fostering N" (reuses the helper from commit 2).
  - History table: every `applications` row between this shelter and this foster, with dog + status + created_at. Reuses existing `applications` RLS.
  - Private notes panel backed by `shelter_foster_notes` — list view + textarea form to add a note.
- `src/app/(shelter)/shelter/fosters/[fosterId]/note-form.tsx` (new, client).
- `src/app/(shelter)/shelter/fosters/[fosterId]/loading.tsx` (new).
- `src/app/api/shelter/foster-notes/route.ts` (new) — `POST` to create a note. (Update/delete deferred unless we discover a need; keeps scope tight.)
- Tests for the page's authorization (non-roster pair returns 404), note insert (RLS blocks other shelters' notes from being read or written).
- `docs/roadmap.md` — mark §6.2 `✅ Shipped` with commit SHAs; log deferred follow-ups:
  - Shelter-initiated removal / archive
  - Groups / Herds (explicit forward-link to `shelter_fosters` as source)
  - Direct messaging beyond applications
  - Generic in-app notifications table
  - Invite via SMS/phone
  - Audit log for note edits / removals
- `docs/AgentHandoff_2026-04-??_session-?.md` (new) — mirrors the prior handoff style.

**Verification**

1. `npm test`.
2. Manual: every path from commit 1's RLS probe re-verified end-to-end through the UI; confirm a second shelter can't read this shelter's notes.
3. `npm run build` passes with real Supabase env (production simulation).
4. `next start` smoke-test: log in as a shelter with a roster entry; load `/shelter/fosters`; invite an email; accept as that foster; verify auto-add on an application acceptance; remove self as foster; confirm removal is reflected on the shelter side.

**Rollback:** delete new route files; revert roadmap + handoff edits.

---

## 6. Risk register

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Service-role client used incorrectly (e.g. called from a route where caller isn't authorized) | High — could bypass RLS | Service client is *only* touched in the four specific write paths listed in §4.2. Code review checklist. Unit tests assert the service client is only constructed in those modules (ripgrep-based test). |
| Auto-add upsert race on double-accept | Low | `onConflict: 'shelter_id,foster_id', ignoreDuplicates: true` — PK prevents duplicate, upsert no-ops. |
| Invite email leak via RLS (`foster_parents.email` lookup) | Medium | Invite `email` column on `shelter_foster_invites` is shelter-entered, never joined to `foster_parents.email` for unrelated parties. Foster RLS only matches their own email. |
| Foster removes themselves mid-placement | Low | "Removing from roster" does not affect any active `applications`. The dog's placement is governed by the application status, not the roster. Commit 7's remove button copy explicitly says this. |
| Ghost invites for emails that never sign up | Low | Invite rows persist as `pending` forever unless cancelled. Acceptable; a future cleanup job can prune rows older than N days. Logged as a deferred follow-up. |
| Herds scope creep | Medium | Explicitly deferred in §1.4. Data model is FK-compatible (§3.5) but no tables/UI in this plan. |
| Invite count badge drift from actual state | Low | `getPortalLayoutData` recomputes on every server render; no caching. Same model as `unreadMessages`. |
| Vercel build failure from the migration running before service-role key is set | Medium | Migration doesn't require the key (just SQL DDL). Service-role key is only needed at runtime. Already required by `src/lib/env.ts`; Resend key follow-up in a parallel effort. |

---

## 7. What's explicitly NOT in this plan

- In-app notifications table (use dedicated `/foster/invites` + sidebar badge instead).
- Shelter-initiated removal from their own roster.
- Herds / groups / emergency chat.
- Messaging that isn't tied to an application.
- Global foster directory search.
- SMS invites.
- Shelter-side archive / hide for roster entries.
- Notes edit / delete / version history.
- Foster-side "show which shelters added me via accepted application vs invite" distinction (auto-added and invite-added look identical in the roster view).
- `og:image` or social preview for any new public URL (none of this plan's URLs are public).

---

## 8. Estimated size

- **9 commits**, ~20 new files, 1 migration, 1 new email template, 4 new API routes + 1 service route, 2 new foster portal pages, 2 new shelter portal pages.
- Roughly comparable in size to the 6.1+6.3 plan (8 commits, ~18 new files).
- No edits to existing UI components except two additive props (`pendingInvites` on `FosterPortalShell`, one new nav link on each portal shell) and one additive write in the accept API.
