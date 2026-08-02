-- Pre-launch waitlist ("Opening Late Fall 2026").
--
-- One row per interest submission from the temporary waitlist landing
-- (NEXT_PUBLIC_WAITLIST_MODE — see src/lib/constants.ts). Collected:
-- role (foster parent vs shelter), name, email, shelter/rescue name
-- (shelters only), city & state, and an optional free-text note.
--
-- Access model — insert-only for the public:
--
--   The API route (`POST /api/waitlist`) inserts with the anon key on
--   behalf of unauthenticated visitors. Nobody browsing the site should
--   ever be able to READ the list — it is PII (names + emails). Reads
--   happen via service role / the Supabase dashboard only, so there is
--   deliberately NO SELECT policy and SELECT is revoked outright.
--
-- Duplicate emails:
--
--   Email is stored lowercased (enforced by CHECK; the route lowercases
--   before insert) with a UNIQUE constraint. The route treats a 23505
--   unique violation as success so re-submitting reads as "you're on the
--   list" instead of leaking whether an address already signed up.

-- ============================================================
-- waitlist_signups — one row per interest submission
-- ============================================================

create table if not exists public.waitlist_signups (
  id           uuid        primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  role         text        not null check (role in ('foster', 'shelter')),
  name         text        not null check (length(name) between 1 and 80),
  email        text        not null check (
                 email = lower(email) and length(email) between 3 and 254
               ),
  -- Shelter/rescue org name; null for foster-parent signups.
  shelter_name text        check (length(shelter_name) between 1 and 80),
  city_state   text        not null check (length(city_state) between 1 and 120),
  note         text        check (length(note) between 1 and 1000),
  constraint waitlist_signups_email_unique unique (email)
);

-- Beta invites go out "in waves, in signup order" — recent-last scans.
create index if not exists waitlist_signups_created_idx
  on public.waitlist_signups (created_at);

-- ============================================================
-- ROW LEVEL SECURITY — public insert, no public read
-- ============================================================

alter table public.waitlist_signups enable row level security;

-- INSERT: anyone (anon or signed-in) may add themselves to the list.
-- Column-level constraints above bound every field; the API route
-- additionally validates + sanitizes and rate-limits by IP.
drop policy if exists "waitlist: anyone can sign up" on public.waitlist_signups;
create policy "waitlist: anyone can sign up"
  on public.waitlist_signups for insert
  to anon, authenticated
  with check (true);

-- No SELECT / UPDATE / DELETE policies — and belt-and-suspenders on the
-- grants so a future permissive policy alone can't re-expose the list.
revoke all on public.waitlist_signups from anon, authenticated;
grant insert on public.waitlist_signups to anon, authenticated;
