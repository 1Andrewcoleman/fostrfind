-- Phase 6.4 — Mutual reporting (foster ↔ shelter).
--
-- Either party on an application can flag the other for safety, harassment,
-- misrepresentation, no-show, or another concern. The row stores the
-- reporter, the application context, the inferred subject (the OTHER party
-- on that application), a category, the body, and a triage status.
--
-- Triage in v1 is "pending" only — a real admin queue is deferred (see the
-- Deferred Follow-ups Log in docs/roadmap.md). The status column is in place
-- now so the table is forward-compatible with that follow-up; v1 inserts
-- always land at 'pending' and v1 readers never UPDATE it. Status changes
-- (when triage ships) will go through a service-role / admin-only path.
--
-- Why application-scoped only:
--
--   The reporter MUST already share an application with the subject — the
--   API route enforces this and the RLS WITH CHECK enforces it again. This
--   prevents drive-by reports on accounts a user never interacted with and
--   keeps the triage workload bounded to real interactions.
--
-- Why we don't store an unconstrained subject_id from the client:
--
--   The route loads the application server-side, identifies the caller as
--   the foster or the shelter on it, and derives the OTHER party as the
--   subject. The client never sends an arbitrary subject_id, so there is
--   no path for "report this stranger by knowing their UUID".

-- ============================================================
-- reports — one row per flag raised
-- ============================================================

create table if not exists public.reports (
  id                uuid        primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  application_id    uuid        not null references public.applications(id) on delete cascade,
  reporter_user_id  uuid        not null references auth.users(id)          on delete cascade,
  -- Exactly one of (subject_foster_id, subject_shelter_id) is non-null,
  -- enforced by the CHECK below. The route picks which one based on the
  -- reporter's role on the application.
  subject_foster_id   uuid references public.foster_parents(id) on delete cascade,
  subject_shelter_id  uuid references public.shelters(id)       on delete cascade,
  category          text        not null check (
                      category in ('safety', 'harassment', 'misrepresentation', 'no_show', 'other')
                    ),
  body              text        not null check (length(body) between 1 and 4000),
  status            text        not null default 'pending' check (
                      status in ('pending', 'reviewing', 'resolved', 'dismissed')
                    ),
  -- Subject XOR — exactly one party is the subject of any single report.
  constraint reports_subject_xor check (
    (subject_foster_id is not null and subject_shelter_id is null)
    or (subject_foster_id is null and subject_shelter_id is not null)
  )
);

-- Triage queue & per-reporter inbox both want recent-first.
create index if not exists reports_application_idx
  on public.reports (application_id);
create index if not exists reports_reporter_idx
  on public.reports (reporter_user_id, created_at desc);
create index if not exists reports_status_created_idx
  on public.reports (status, created_at desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.reports enable row level security;

-- SELECT: a reporter can read their own report rows. Subjects do NOT see
-- reports filed against them. Triage staff will read via service role until
-- a real admin role is introduced.
drop policy if exists "reports: reporter read own" on public.reports;
create policy "reports: reporter read own"
  on public.reports for select
  using (reporter_user_id = auth.uid());

-- INSERT: the caller must be reporting as themselves AND must be a
-- participant (foster or shelter) on the referenced application. The
-- subject column constraint is enforced at the table CHECK above; here we
-- additionally verify the subject is the OTHER party on the application.
drop policy if exists "reports: participant can file" on public.reports;
create policy "reports: participant can file"
  on public.reports for insert
  with check (
    reporter_user_id = auth.uid()
    and exists (
      select 1
        from public.applications a
        left join public.foster_parents fp on fp.id = a.foster_id
        left join public.shelters       s  on s.id = a.shelter_id
       where a.id = application_id
         and (
           -- Foster filing against the shelter on this application.
           (fp.user_id = auth.uid() and subject_shelter_id = a.shelter_id and subject_foster_id is null)
           or
           -- Shelter filing against the foster on this application.
           (s.user_id  = auth.uid() and subject_foster_id  = a.foster_id  and subject_shelter_id is null)
         )
    )
  );

-- No UPDATE / DELETE policies in v1. Status transitions belong to the
-- (deferred) admin triage path via service role.
