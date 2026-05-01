-- Phase 6.5 — Saved dogs ("favorites") + shelter-visible aggregate save
-- counts.
--
-- A foster bookmarks a dog they want to revisit; the shelter sees how many
-- saves a dog has but never which fosters saved it. Aggregates only — no
-- per-foster reveal. The product guardrail in docs/roadmap.md (Phase 6
-- header) requires save counts to be REAL DB aggregates and never invented.
--
-- Membership row is keyed (foster_id, dog_id) and FKs cascade-delete when
-- either side disappears, so no janitor job is needed.
--
-- RLS shape:
--
--   - Foster reads / inserts / deletes their OWN rows. Standard pattern.
--   - Shelter does NOT read individual rows. Shelters get a single
--     SECURITY DEFINER RPC `get_save_counts_for_my_dogs()` that returns
--     `(dog_id, save_count)` for dogs they own. The RPC bypasses RLS for
--     the COUNT only, scoped by the caller's `get_my_shelter_ids()`, so
--     no row-level data ever leaves the table to the shelter side.
--   - Anonymous and other authenticated users see nothing.

-- ============================================================
-- dog_saves — one row per foster ⨯ dog
-- ============================================================

create table if not exists public.dog_saves (
  foster_id  uuid        not null references public.foster_parents(id) on delete cascade,
  dog_id     uuid        not null references public.dogs(id)            on delete cascade,
  saved_at   timestamptz not null default now(),
  primary key (foster_id, dog_id)
);

-- The PK already indexes (foster_id, dog_id); the dog-scoped index is for
-- the shelter-side aggregate query and the (eventual) "popular dogs" sort.
create index if not exists dog_saves_dog_idx
  on public.dog_saves (dog_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.dog_saves enable row level security;

-- Foster reads their own saves (powers `/foster/saved`).
drop policy if exists "dog_saves: foster read own" on public.dog_saves;
create policy "dog_saves: foster read own"
  on public.dog_saves for select
  using (
    foster_id in (select public.get_my_foster_ids())
  );

-- Foster inserts saves only for themselves.
drop policy if exists "dog_saves: foster insert own" on public.dog_saves;
create policy "dog_saves: foster insert own"
  on public.dog_saves for insert
  with check (
    foster_id in (select public.get_my_foster_ids())
  );

-- Foster deletes their own saves (unsave).
drop policy if exists "dog_saves: foster delete own" on public.dog_saves;
create policy "dog_saves: foster delete own"
  on public.dog_saves for delete
  using (
    foster_id in (select public.get_my_foster_ids())
  );

-- No UPDATE — `saved_at` is the only mutable column and we never want to
-- silently re-time a save (re-saving creates a fresh row via INSERT
-- ON CONFLICT DO NOTHING semantics in the API route).

-- ============================================================
-- Aggregate access for shelters — RPC, no row access
-- ============================================================

-- Returns (dog_id, save_count) for every dog the caller's shelter owns.
-- Dogs with zero saves are returned as 0 so the caller can render a stable
-- table without an extra "is the dog mine?" pass.
--
-- SECURITY DEFINER bypasses dog_saves RLS for the COUNT only; the WHERE
-- clause re-scopes to the caller's own shelters, so a non-shelter user
-- gets an empty result set.
create or replace function public.get_save_counts_for_my_dogs()
returns table (dog_id uuid, save_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select d.id as dog_id, coalesce(count(s.dog_id), 0)::bigint as save_count
    from public.dogs d
    left join public.dog_saves s on s.dog_id = d.id
   where d.shelter_id in (select public.get_my_shelter_ids())
   group by d.id;
$$;

grant execute on function public.get_save_counts_for_my_dogs() to authenticated;
