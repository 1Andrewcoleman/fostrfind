-- Phase 6.2 — Shelter-side foster roster
--
-- Introduces three new tables, fully additive. No changes to existing tables,
-- columns, or policies.
--
--   shelter_fosters         — membership table: which fosters a shelter works with
--   shelter_foster_invites  — pending/historical invites; works pre-signup
--   shelter_foster_notes    — private, shelter-staff-only notes per (shelter, foster)
--
-- Membership entry paths (enforced at the API layer, not via policies):
--
--   1. application.status -> 'accepted' triggers an idempotent upsert via the
--      service-role client in POST /api/applications/[id]/accept.
--   2. Shelter creates an invite; foster accepts via POST
--      /api/shelter/foster-invites/[id]/accept which inserts into
--      shelter_fosters via the service-role client.
--
-- INSERT on shelter_fosters is service-role only (no "INSERT" policy is
-- defined). This keeps the "only two entry paths" contract enforced in a
-- single place — the API routes above — instead of duplicating it across
-- RLS + app code.
--
-- The composite primary key (shelter_id, foster_id) was chosen deliberately:
-- it's the natural key for a membership row, eliminates duplicate-row bugs,
-- and lets a future herd_members table FK straight to it without reshape.

-- ============================================================
-- shelter_fosters — the roster itself
-- ============================================================

create table if not exists public.shelter_fosters (
  shelter_id  uuid        not null references public.shelters(id)       on delete cascade,
  foster_id   uuid        not null references public.foster_parents(id) on delete cascade,
  added_at    timestamptz not null default now(),
  source      text        not null check (source in ('application_accepted', 'invite_accepted')),
  primary key (shelter_id, foster_id)
);

-- The PK already indexes (shelter_id, foster_id); the foster-scoped index
-- is for the foster-portal transparency view (list every shelter a foster
-- is on). Shelter-scoped reads hit the PK directly.
create index if not exists shelter_fosters_foster_idx
  on public.shelter_fosters (foster_id);

-- ============================================================
-- shelter_foster_invites — pending + historical invites
-- ============================================================

create table if not exists public.shelter_foster_invites (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  shelter_id    uuid        not null references public.shelters(id)       on delete cascade,
  email         text        not null,
  foster_id     uuid        references public.foster_parents(id)          on delete set null,
  status        text        not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  message       text
);

-- Partial unique index: at most one PENDING invite per (shelter, email) at a
-- time. Completed history rows (accepted/declined/cancelled) are intentionally
-- unconstrained so a shelter can legitimately re-invite a foster who
-- previously declined, or invite again after a cancellation.
create unique index if not exists shelter_foster_invites_pending_uniq
  on public.shelter_foster_invites (shelter_id, lower(email))
  where status = 'pending';

-- foster_id-based lookup for the foster inbox when the invite has been
-- claimed (post-signup). Partial because foster_id is nullable.
create index if not exists shelter_foster_invites_foster_idx
  on public.shelter_foster_invites (foster_id)
  where foster_id is not null;

-- lower(email)-based lookup for the pre-signup inbox path and for the
-- onboarding email-match claim query. Partial because we only ever query
-- pending invites by email.
create index if not exists shelter_foster_invites_email_idx
  on public.shelter_foster_invites (lower(email))
  where status = 'pending';

-- ============================================================
-- shelter_foster_notes — private per-relationship notes
-- ============================================================

create table if not exists public.shelter_foster_notes (
  id           uuid        primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  shelter_id   uuid        not null references public.shelters(id)       on delete cascade,
  foster_id    uuid        not null references public.foster_parents(id) on delete cascade,
  author_user  uuid        not null references auth.users(id)            on delete set null,
  body         text        not null
);

create index if not exists shelter_foster_notes_pair_idx
  on public.shelter_foster_notes (shelter_id, foster_id);

-- Re-use the shared updated_at trigger declared in 20240101000000_initial_schema.sql.
drop trigger if exists shelter_foster_notes_updated_at on public.shelter_foster_notes;
create trigger shelter_foster_notes_updated_at
  before update on public.shelter_foster_notes
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.shelter_fosters        enable row level security;
alter table public.shelter_foster_invites enable row level security;
alter table public.shelter_foster_notes   enable row level security;

-- ---------------- shelter_fosters ----------------

-- Shelter reads their own roster rows.
drop policy if exists "shelter_fosters: shelter read own" on public.shelter_fosters;
create policy "shelter_fosters: shelter read own"
  on public.shelter_fosters for select
  using (
    shelter_id in (select id from public.shelters where user_id = auth.uid())
  );

-- Foster reads their own roster rows (transparency: "who has me on their roster").
drop policy if exists "shelter_fosters: foster read own" on public.shelter_fosters;
create policy "shelter_fosters: foster read own"
  on public.shelter_fosters for select
  using (
    foster_id in (select id from public.foster_parents where user_id = auth.uid())
  );

-- Foster-initiated self-removal. Shelter-initiated removal is deferred.
drop policy if exists "shelter_fosters: foster delete own" on public.shelter_fosters;
create policy "shelter_fosters: foster delete own"
  on public.shelter_fosters for delete
  using (
    foster_id in (select id from public.foster_parents where user_id = auth.uid())
  );

-- NOTE: no INSERT policy. Writes go through the service-role client in the
-- two specific API entry paths (application accept, invite accept). RLS
-- denies INSERT to both anon and authenticated roles by default.

-- ---------------- shelter_foster_invites ----------------

-- Shelter owns full CRUD over invites for their own shelter (create, list,
-- cancel). The complete-invite UPDATE path (set status='accepted'|'declined')
-- is also allowed for the foster; their policy is below.
drop policy if exists "shelter_foster_invites: shelter manage own" on public.shelter_foster_invites;
create policy "shelter_foster_invites: shelter manage own"
  on public.shelter_foster_invites for all
  using (
    shelter_id in (select id from public.shelters where user_id = auth.uid())
  )
  with check (
    shelter_id in (select id from public.shelters where user_id = auth.uid())
  );

-- Foster can read invites that target them either by foster_id (already
-- claimed) or by email match against their foster_parents.email (lowercased).
-- The email-match path covers pre-signup invites that haven't yet been
-- claimed by the onboarding hook.
drop policy if exists "shelter_foster_invites: foster read own" on public.shelter_foster_invites;
create policy "shelter_foster_invites: foster read own"
  on public.shelter_foster_invites for select
  using (
    foster_id in (select id from public.foster_parents where user_id = auth.uid())
    or lower(email) = lower(coalesce(
      (select email from public.foster_parents where user_id = auth.uid() limit 1),
      ''
    ))
  );

-- Foster can update their own invite (accept / decline). The column-level
-- contract (only status + responded_at + foster_id) is enforced at the API
-- layer; this policy just gates row visibility.
drop policy if exists "shelter_foster_invites: foster respond to own" on public.shelter_foster_invites;
create policy "shelter_foster_invites: foster respond to own"
  on public.shelter_foster_invites for update
  using (
    foster_id in (select id from public.foster_parents where user_id = auth.uid())
    or lower(email) = lower(coalesce(
      (select email from public.foster_parents where user_id = auth.uid() limit 1),
      ''
    ))
  )
  with check (
    foster_id in (select id from public.foster_parents where user_id = auth.uid())
    or lower(email) = lower(coalesce(
      (select email from public.foster_parents where user_id = auth.uid() limit 1),
      ''
    ))
  );

-- ---------------- shelter_foster_notes ----------------

-- Shelter-staff-only. Fosters must not read shelter-internal notes about
-- them. No foster-side policy means RLS denies by default.
drop policy if exists "shelter_foster_notes: shelter manage own" on public.shelter_foster_notes;
create policy "shelter_foster_notes: shelter manage own"
  on public.shelter_foster_notes for all
  using (
    shelter_id in (select id from public.shelters where user_id = auth.uid())
  )
  with check (
    shelter_id in (select id from public.shelters where user_id = auth.uid())
  );
