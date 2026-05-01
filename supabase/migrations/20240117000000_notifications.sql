-- Phase 7 Step 48 — Notification Center foundation.
--
-- Notifications are user-scoped platform events used by the portal chrome
-- and the Step 49 notification UI. Inserts are intentionally service-role
-- only via src/lib/notifications.ts; authenticated users may read their own
-- notifications and mark them read.

create table if not exists public.notifications (
  id          uuid        primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  type        text        not null check (type in (
    'application_submitted',
    'application_reviewing',
    'application_accepted',
    'application_declined',
    'application_completed',
    'application_withdrawn',
    'new_message',
    'invite_received',
    'invite_accepted',
    'invite_declined',
    'invite_cancelled',
    'roster_joined',
    'roster_left'
  )),
  title       text        not null,
  body        text,
  link        text,
  read        boolean     not null default false,
  read_at     timestamptz,
  metadata    jsonb
);

create index if not exists idx_notifications_user_read
  on public.notifications (user_id, read);

create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "notifications: users read own" on public.notifications;
create policy "notifications: users read own"
  on public.notifications for select
  using (user_id = auth.uid());

-- Authenticated users should only be able to mark their own notifications
-- read. Column-level privileges prevent browser clients from changing title,
-- body, link, type, metadata, or ownership through PostgREST.
revoke update on public.notifications from authenticated;
grant update (read, read_at) on public.notifications to authenticated;

drop policy if exists "notifications: users mark own read" on public.notifications;
create policy "notifications: users mark own read"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and read = true
  );
