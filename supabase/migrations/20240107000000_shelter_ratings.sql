-- Two-way trust: shelter_ratings mirrors the existing `ratings` table but
-- lets fosters rate the shelter they fostered with. Scoped per completed
-- application so both directions are idempotent.
--
-- Uses the existing `get_my_foster_ids()` / `get_my_shelter_ids()`
-- SECURITY DEFINER helpers (migration 20240102) to avoid the RLS
-- recursion that bit the initial schema.

create table if not exists public.shelter_ratings (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  application_id  uuid not null references public.applications(id) on delete cascade,
  shelter_id      uuid not null references public.shelters(id) on delete cascade,
  foster_id       uuid not null references public.foster_parents(id) on delete cascade,
  dog_id          uuid not null references public.dogs(id) on delete cascade,
  score           integer not null check (score between 1 and 5),
  comment         text,
  -- One rating per completed placement, same idempotency guarantee the
  -- foster→shelter direction already has via the API's idempotency check.
  unique (application_id)
);

alter table public.shelter_ratings enable row level security;

-- SELECT: public read. Aggregated shelter scores surface on the public
-- `/shelters/[slug]` profile (accessible logged-out), so the underlying
-- rows must be readable by the anon role.
create policy "shelter_ratings: public read"
  on public.shelter_ratings for select
  using (true);

-- INSERT: only the foster on the application can submit a rating.
-- API route (`/api/shelter-ratings`) re-checks ownership + completed
-- status server-side for defense-in-depth.
create policy "shelter_ratings: foster can insert for their placements"
  on public.shelter_ratings for insert
  with check (
    foster_id in (select public.get_my_foster_ids())
  );
