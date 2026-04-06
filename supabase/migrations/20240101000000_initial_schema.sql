-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

-- SHELTERS
create table if not exists public.shelters (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  slug          text not null unique,
  email         text not null,
  phone         text,
  location      text not null,
  latitude      float8,
  longitude     float8,
  logo_url      text,
  ein           text,
  bio           text,
  website       text,
  instagram     text,
  is_verified   boolean not null default false
);

-- DOGS
create table if not exists public.dogs (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  shelter_id      uuid not null references public.shelters(id) on delete cascade,
  name            text not null,
  breed           text,
  age             text,
  size            text,
  gender          text,
  temperament     text,
  medical_status  text,
  special_needs   text,
  description     text,
  photos          text[] not null default '{}',
  status          text not null default 'available'
);

-- FOSTER_PARENTS
create table if not exists public.foster_parents (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  first_name      text not null,
  last_name       text not null,
  email           text not null,
  phone           text,
  location        text not null,
  latitude        float8,
  longitude       float8,
  housing_type    text,
  has_yard        boolean not null default false,
  has_other_pets  boolean not null default false,
  other_pets_info text,
  has_children    boolean not null default false,
  children_info   text,
  experience      text,
  bio             text,
  avatar_url      text,
  pref_size       text[] not null default '{}',
  pref_age        text[] not null default '{}',
  pref_medical    boolean not null default false,
  max_distance    int not null default 25
);

-- APPLICATIONS
create table if not exists public.applications (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  dog_id          uuid not null references public.dogs(id) on delete cascade,
  foster_id       uuid not null references public.foster_parents(id) on delete cascade,
  shelter_id      uuid not null references public.shelters(id) on delete cascade,
  status          text not null default 'submitted',
  note            text,
  shelter_note    text
);

-- RATINGS
create table if not exists public.ratings (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  application_id  uuid not null references public.applications(id),
  shelter_id      uuid not null references public.shelters(id),
  foster_id       uuid not null references public.foster_parents(id),
  dog_id          uuid not null references public.dogs(id),
  score           int not null check (score >= 1 and score <= 5),
  comment         text
);

-- MESSAGES
create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  application_id  uuid not null references public.applications(id) on delete cascade,
  sender_id       uuid not null references auth.users(id),
  sender_role     text not null,
  body            text not null,
  read            boolean not null default false
);

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger dogs_updated_at
  before update on public.dogs
  for each row execute procedure public.handle_updated_at();

create trigger applications_updated_at
  before update on public.applications
  for each row execute procedure public.handle_updated_at();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.shelters enable row level security;
alter table public.dogs enable row level security;
alter table public.foster_parents enable row level security;
alter table public.applications enable row level security;
alter table public.ratings enable row level security;
alter table public.messages enable row level security;

-- SHELTERS
create policy "shelters: owner can manage own row"
  on public.shelters for all
  using (auth.uid() = user_id);

-- DOGS
create policy "dogs: shelter owner can manage"
  on public.dogs for all
  using (
    shelter_id in (
      select id from public.shelters where user_id = auth.uid()
    )
  );

create policy "dogs: fosters can read available"
  on public.dogs for select
  using (status = 'available');

-- FOSTER_PARENTS
create policy "foster_parents: owner can manage own row"
  on public.foster_parents for all
  using (auth.uid() = user_id);

create policy "foster_parents: shelters can read applicants"
  on public.foster_parents for select
  using (
    id in (
      select foster_id from public.applications
      where shelter_id in (
        select id from public.shelters where user_id = auth.uid()
      )
    )
  );

-- APPLICATIONS
create policy "applications: foster can manage own"
  on public.applications for all
  using (
    foster_id in (
      select id from public.foster_parents where user_id = auth.uid()
    )
  );

create policy "applications: shelter can manage for their dogs"
  on public.applications for all
  using (
    shelter_id in (
      select id from public.shelters where user_id = auth.uid()
    )
  );

-- RATINGS
create policy "ratings: authenticated users can read"
  on public.ratings for select
  using (auth.role() = 'authenticated');

create policy "ratings: shelter can insert for their placements"
  on public.ratings for insert
  with check (
    shelter_id in (
      select id from public.shelters where user_id = auth.uid()
    )
  );

-- MESSAGES
create policy "messages: participants can read"
  on public.messages for select
  using (
    application_id in (
      select id from public.applications
      where
        shelter_id in (select id from public.shelters where user_id = auth.uid())
        or foster_id in (select id from public.foster_parents where user_id = auth.uid())
    )
  );

create policy "messages: participants can insert"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and application_id in (
      select id from public.applications
      where
        shelter_id in (select id from public.shelters where user_id = auth.uid())
        or foster_id in (select id from public.foster_parents where user_id = auth.uid())
    )
  );

-- ============================================================
-- STORAGE BUCKETS (run via Supabase dashboard or seed script)
-- ============================================================
-- insert into storage.buckets (id, name, public) values ('dog-photos', 'dog-photos', true) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('shelter-logos', 'shelter-logos', true) on conflict do nothing;
-- insert into storage.buckets (id, name, public) values ('foster-avatars', 'foster-avatars', true) on conflict do nothing;
