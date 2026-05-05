# Fostr Find — Final Pilot Roadmap

> **For AI agents:** This document picks up directly from `docs/roadmap.md` (Phases 1–6 complete). Read this file, the most recent `AgentHandoff_*.md`, `docs/TODO.md`, and `CLAUDE.md` before starting any step. The Agent Code Quality Protocol below is mandatory and identical to the one in `roadmap.md` — it is reproduced here so this file is fully self-contained.

**Context:** Phases 1–6 of `roadmap.md` are complete. Fostr Find has a live Vercel deployment, a real Supabase production project, and email infrastructure via Resend. The platform is entering a **controlled pilot with one shelter partner**. The goal of this roadmap is to ship the remaining items required for that pilot to succeed, then document the post-pilot backlog for future development.

**Scope of this document:**
- **Phase 7 (Pilot Launch):** Four development steps + a Launch Ops Checklist. Must all be complete before showing the app to the pilot shelter.
- **Post-Pilot Backlog:** Everything else, in a prioritised table. Do not implement these during the pilot phase without explicit instruction.

**Ordering:** Application form → Sentry → Notification Center (Foundation) → Notification Center (UI). The ops checklist runs in parallel and must be verified by a QA engineer before the pilot begins.

---

## Agent Code Quality Protocol

> **MANDATORY.** Every AI agent working on this codebase MUST follow this protocol for every step. These are not suggestions — they are hard requirements. Violating them produces code that looks complete but breaks under real use.

### 1. Read Before You Write

Before writing a single line of code:
- **Read every file listed** in the step's "Files to modify" section — in full, not just the section you think you need. You need surrounding context to avoid breaking existing behavior.
- **Read the imports and types** used by those files. If a file imports `ApplicationWithDetails`, go find that type definition and understand its shape.
- **Read at least one existing implementation** of the same pattern. Every step says "follow the pattern in X file." Actually open that file and study it. Don't guess what the pattern is from memory or from the step description alone.
- **Read `CLAUDE.md`** for architecture context, especially the Design System & UI section. Use the project's semantic tokens (`--primary`, `--warm`, `--muted`), existing components (`StatusBadge`, `EmptyState`, `Loader2`), and established patterns. Do not invent new approaches when existing ones are documented.

### 2. Write Production Code, Not Prototypes

Every line you write ships to real users. This means:

- **No placeholder values.** If a function needs error text, write the real error text. If a component needs an icon, pick the real icon. If an API route needs a status code, use the correct one — don't put `500` everywhere.
- **No TODO comments in new code.** If something can't be done in this step, it belongs in the roadmap or `TODO.md` — not in a code comment that will be forgotten. The only acceptable TODO is a reference to a specific future step.
- **No empty catch blocks.** Every `catch` must either handle the error meaningfully (user-facing message, fallback behavior) or re-throw. `catch (e) {}` and `catch { return }` are bugs.
- **No `any` types.** If you don't know the type, find it. If it doesn't exist, define it in `src/types/`. The codebase uses strict TypeScript — `any` defeats the purpose.
- **No dead code.** Don't leave commented-out alternatives, unused imports, or functions "for later." If it's not used in this step, delete it.
- **Complete error handling.** Every Supabase query can fail. Every `fetch()` can fail. Every `JSON.parse()` can fail. Handle all of them. The step's "Pitfalls" section calls out the critical ones, but you are responsible for catching what it doesn't mention.
- **Complete loading states.** If a user action triggers an async operation, there must be: (a) a loading indicator while it runs, (b) a success confirmation when it completes, (c) an error message if it fails. No silent failures. No buttons that go dead with no feedback.
- **Accessible markup.** Form inputs need labels. Images need alt text. Interactive elements need keyboard support. Buttons that look like links need `role` attributes. This is not polish — it's correctness.

### 3. The Write-Review-Fix Cycle

After writing code for each file or logical unit, STOP and review your own work before moving to the next file. Do not batch this to the end.

**After writing each file, ask yourself these 7 questions:**

1. **Does this break anything that already works?** Re-read the code you modified. Did you change a function signature that other files depend on? Did you remove a prop that a parent component passes? Did you change a URL path that other pages link to? If you're not sure, grep for the function/component name across the codebase.

2. **Are there implicit assumptions?** Did you assume a variable is never `null` without checking? Did you assume an array is never empty? Did you assume a Supabase query returns exactly one row? Every assumption must be validated in code or provably guaranteed by the data model.

3. **Does the error path work?** Mentally trace what happens when the network is down, the database returns an error, or the user submits garbage input. Does the UI show something helpful? Does the server return an appropriate status code? Or does it crash / show a blank screen / hang forever?

4. **Is this consistent with the rest of the codebase?** Are you using `toast.success()` where the rest of the app uses `toast.success()`? Are you using `router.push()` where the app convention is `window.location.href` (for auth changes)? Are you using `className="text-red-500"` where the design system uses `text-destructive`? Match existing patterns exactly.

5. **Would this survive a code review?** If a senior engineer looked at this diff, would they approve it? Or would they flag: unused variables, inconsistent naming, missing types, redundant code, or logic that's clever instead of clear?

6. **Are there race conditions or timing issues?** Can two users hit the same endpoint simultaneously and corrupt data? Can a user click a button twice before the first request completes? Is there a `useEffect` that fires on every render when it should only fire once?

7. **Did I handle the DEV_MODE path?** This app runs without a real Supabase in development. Does your code gracefully handle the case where `DEV_MODE` is true? Does it show placeholder data? Or does it crash because `supabase.from(...)` returns null?

### 4. End-of-Step Validation

After ALL files for a step are written, run this checklist before committing:

```
[ ] TypeScript compiles cleanly:
    node node_modules/typescript/bin/tsc --noEmit

[ ] ESLint passes:
    node node_modules/eslint/bin/eslint.js src/

[ ] Dev server starts without errors:
    node node_modules/next/dist/bin/next dev

[ ] Manually verified the happy path:
    - Navigated to the relevant page(s)
    - Performed the core action the step adds
    - Confirmed the expected result appeared

[ ] Manually verified the error path:
    - Triggered at least one error condition
    - Confirmed the error is handled gracefully (toast, inline message, or redirect)

[ ] No regressions on adjacent features:
    - Tested at least one page/feature that was NOT modified in this step
    - Confirmed it still works as before

[ ] All new components/functions have proper TypeScript types:
    - No `any` types introduced
    - No `as unknown as` escape hatches (unless truly unavoidable and documented why)

[ ] Reviewed the full diff one final time:
    git diff --staged
    - No debug console.logs left behind
    - No commented-out code
    - No placeholder text ("Lorem ipsum", "TODO", "fix this later")
    - Import paths are correct (using @/ alias, not relative ../../..)
```

**If any check fails, fix it before committing.** Do not commit broken code with the intention of fixing it in the next step. Every commit must leave the codebase in a working state.

### 5. When You're Stuck

If you encounter something the step description doesn't cover:

1. **Read the codebase first.** The answer is almost always in an existing file that solves a similar problem. Grep for keywords. Read adjacent components. Check the `src/lib/` utilities.
2. **Don't guess at Supabase behavior.** If you're unsure how a Supabase query, RLS policy, or auth method works, say so and ask — don't write speculative code that might be wrong.
3. **Don't add scope.** If you notice something that "should also be fixed" but isn't part of this step, note it in the commit message or flag it — don't silently add it. Scope creep causes bugs because the extra work wasn't planned or reviewed.
4. **Prefer boring code.** If there's a clever one-liner and a clear five-liner that do the same thing, write the five-liner. The next agent (or human) reading this code shouldn't need to puzzle over what it does.

### 6. Session Start + End — Handoff Discipline

Every agent session leaves behind a handoff document at `docs/AgentHandoff_{YYYY-MM-DD}.md`. These capture *new* info that isn't already in the roadmap, TODO, or CLAUDE.md: environment quirks, codebase patterns the docs don't spell out, tooling assets introduced, preview-verification gotchas, decisions locked in by the user, and explicit do-not-touch notes. They are short, surgical, and high-signal — they are NOT a session log or diff digest.

**At session START:**
1. `ls docs/AgentHandoff_*.md` — look for existing handoffs.
2. Read the **most recent** handoff in full before you write any code or propose a plan. The roadmap tells you what to build; the handoff tells you how the codebase *actually behaves* when you start touching it.
3. Skim older handoffs only if you're picking up work that spans sessions (e.g., continuing a half-finished step).

**At session END** (any session that edits code, docs, or tooling):
1. Create a new handoff at `docs/AgentHandoff_{today}.md` — today being the calendar date. Use `docs/AgentHandoff_2026-04-18.md` as a format reference.
2. Populate with **new** information only. Do not re-state what's in the roadmap, TODO.md, CLAUDE.md, or a previous handoff. If nothing substantive was learned, a short handoff (20–30 lines) is fine.
3. Commit the handoff with the final commit of the session (or as its own `docs:` commit if you're handing off mid-work).

**Categories that belong in a handoff:**
- **Environment quirks** — oddities about the worktree, `.env.local`, Supabase project settings, Node version, tooling, symlinks, etc. that surfaced during the session.
- **Codebase patterns not in docs** — runtime behaviors that contradict or extend the docs (Supabase nested-join type mismatches, RLS gotchas, client-vs-server component constraints). Include prior-art file references.
- **Dev tooling assets introduced** — new scripts, migrations, env vars, with idempotency notes and safety guards.
- **Preview verification patterns** — what works, what doesn't, workarounds for automation flakiness.
- **Workflow conventions adopted** — especially if the user has explicitly asked for them (e.g., Deferred Follow-ups Log discipline).
- **Decisions locked in** — Resend key strategy, image resize location, email template dependencies, etc. The next agent should not re-litigate these.
- **What NOT to touch** — ignored dirs, flaky-but-known features the user doesn't want fixed, applied migrations that would error on reapply.

**Categories that do NOT belong:**
- Recaps of step-by-step work already in git history.
- Information present in roadmap.md, TODO.md, CLAUDE.md, or a previous AgentHandoff file.
- Future-work suggestions — those belong in the Deferred Follow-ups Log or as Remaining Items rows.
- Opinions about code quality that aren't actionable.

---

## Launch Ops Checklist

> **For QA engineers:** This checklist must be completed and signed off before the pilot shelter is invited. Each item includes precise, step-by-step instructions. No codebase knowledge is required. Complete items in order — later items depend on earlier ones.

---

### OPS-1: Resend Domain Verification

**Why this matters:** Resend's free tier only delivers emails to the inbox of the Resend account owner. Without a verified sending domain, the pilot shelter will never receive "new application" or "application accepted" emails — the core notification loop will be silent.

**Steps:**

1. Open a browser and go to `https://resend.com`. Log in with the project's Resend credentials.
2. In the left sidebar, click **Domains**.
3. Click **Add Domain** (top-right button).
4. Enter the production domain (e.g. `fostrfind.com`). Click **Add**.
5. Resend will display three DNS records to add. They will look like:
   - A **TXT record** for SPF (e.g. `v=spf1 include:amazonses.com ~all`)
   - A **CNAME record** for DKIM (e.g. `resend._domainkey.fostrfind.com → ...`)
   - Optionally an **MX record** for inbound (only needed if receiving email — likely skip this one)
6. Open a new browser tab. Log in to the DNS provider for the domain (Cloudflare, Namecheap, GoDaddy, etc.).
7. Navigate to the DNS records management page for the domain.
8. Add each record from step 5 exactly as shown. For each record, set TTL to **Auto** or **3600** if required.
9. Return to the Resend Domains tab. Click **Verify DNS Records** (or wait — verification can take 5–60 minutes for DNS to propagate).
10. When all records show a green checkmark, the domain is verified.
11. In Resend, go to **Settings → API Keys**. Confirm the API key shown matches what is set as `RESEND_API_KEY` in Vercel (see OPS-3 for how to check Vercel env vars).
12. Update the `RESEND_FROM` environment variable in Vercel (see OPS-3) to `noreply@yourdomain.com` (replace with the real verified domain). This variable controls the "from" address on all outbound emails.

**Verification test:** After completing these steps, open the live app, sign up with a real email address as a foster, create a test application on a dog, and confirm an email arrives at the shelter's email address within 5 minutes.

**If DNS changes are not appearing:** DNS propagation can take up to 48 hours in rare cases. Use `https://dnschecker.org` to check if the TXT/CNAME records are visible globally.

---

### OPS-2: Supabase Storage Buckets

**Why this matters:** Dog photo upload (Steps 9–10 of the original roadmap) requires three Supabase Storage buckets to exist with correct public access policies. If they were not applied to the production project, photo uploads will silently fail.

**Steps:**

1. Open a browser and go to `https://supabase.com`. Log in and open the production project.
2. In the left sidebar, click **Storage**.
3. Confirm that **three buckets** exist with exactly these names:
   - `dog-photos`
   - `shelter-logos`
   - `foster-avatars`
4. Click each bucket. In the bucket settings, confirm **Public bucket** is enabled (a toggle or label saying "Public").
5. In the left sidebar under Storage, click **Policies**.
6. Confirm policies exist for `SELECT` (public read) on all three buckets. The policy names may vary but there should be at least one `SELECT` policy per bucket allowing unauthenticated reads.

**If any bucket is missing:**
1. In the Supabase dashboard, click **SQL Editor** in the left sidebar.
2. Paste and run the following SQL exactly as written:

```sql
INSERT INTO storage.buckets (id, name, public)
VALUES ('dog-photos', 'dog-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('shelter-logos', 'shelter-logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('foster-avatars', 'foster-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policy for all three buckets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
    AND policyname = 'Public read dog-photos'
  ) THEN
    CREATE POLICY "Public read dog-photos"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'dog-photos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
    AND policyname = 'Public read shelter-logos'
  ) THEN
    CREATE POLICY "Public read shelter-logos"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'shelter-logos');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
    AND policyname = 'Public read foster-avatars'
  ) THEN
    CREATE POLICY "Public read foster-avatars"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'foster-avatars');
  END IF;
END $$;

-- Authenticated upload policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
    AND policyname = 'Auth upload dog-photos'
  ) THEN
    CREATE POLICY "Auth upload dog-photos"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'dog-photos' AND auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
    AND policyname = 'Auth upload shelter-logos'
  ) THEN
    CREATE POLICY "Auth upload shelter-logos"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'shelter-logos' AND auth.uid() IS NOT NULL);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
    AND policyname = 'Auth upload foster-avatars'
  ) THEN
    CREATE POLICY "Auth upload foster-avatars"
      ON storage.objects FOR INSERT
      WITH CHECK (bucket_id = 'foster-avatars' AND auth.uid() IS NOT NULL);
  END IF;
END $$;

-- Owner delete policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'objects'
    AND policyname = 'Owner delete own uploads'
  ) THEN
    CREATE POLICY "Owner delete own uploads"
      ON storage.objects FOR DELETE
      USING (auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
END $$;
```

3. After running, refresh the Storage → Buckets page and confirm the three buckets now appear.

**Verification test:** Log in to the live app as a shelter user. Navigate to Add a Dog. Upload a photo. Confirm the photo thumbnail appears in the form and saves correctly.

---

### OPS-3: Vercel Environment Variables Audit

**Why this matters:** The app will silently degrade or crash in production if environment variables are missing or set to placeholder values. This checklist verifies every required variable is real and correctly set.

**Steps:**

1. Open a browser and go to `https://vercel.com`. Log in and open the Fostr Find project.
2. Click **Settings** (top navigation), then **Environment Variables** in the left sidebar.
3. Verify the following variables exist and their values match the descriptions below. You do not need to see the full secret value — just confirm the variable name exists and the preview shows the right format.

| Variable | Required | Expected format | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://<project-ref>.supabase.co` | Must start with `https://` and end in `.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Long JWT string starting with `eyJ` | Found in Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Long JWT string starting with `eyJ` | Different from the anon key. Found in Supabase → Settings → API |
| `RESEND_API_KEY` | Yes | Starts with `re_` | Found in Resend → API Keys |
| `RESEND_FROM` | Yes | `noreply@yourdomain.com` | Must use the verified domain from OPS-1 |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://yourdomain.com` | The production URL with no trailing slash |
| `SENTRY_DSN` | Yes (after Step 47) | `https://...@sentry.io/...` | Set after Step 47 is deployed |
| `SENTRY_AUTH_TOKEN` | Yes (after Step 47) | Starts with `sntrys_` | Set after Step 47 is deployed |

4. For any variable that is missing or shows a placeholder value (e.g., `your_resend_api_key_here`, `https://example.supabase.co`):
   - Obtain the real value from the relevant service (Supabase dashboard, Resend dashboard, Sentry dashboard).
   - Click **Add New** in Vercel, enter the variable name and real value, select **All Environments**, and click **Save**.
5. After adding or editing any variable, a new deployment is required. Click **Deployments** in the top nav, find the most recent deployment, and click **Redeploy**.

**Verification test:** After redeployment, navigate to the live URL and confirm the app loads without a white screen or error banner. Check the Vercel deployment logs for any `[env] Missing required variable` warnings.

---

### OPS-4: Database Migrations Verification

**Why this matters:** All SQL migration files in `supabase/migrations/` must be applied to the production Supabase project. Committing a migration file to the repo does NOT apply it automatically — it must be applied manually. This checklist verifies every migration has been applied.

**Steps:**

1. Open the Supabase dashboard and navigate to **SQL Editor**.
2. Run the following query to see which migration timestamps exist in the schema:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

3. Confirm the following tables exist in the output. If any are missing, the corresponding migration has not been applied.

| Table name | Introduced by migration |
|---|---|
| `shelters` | `20240101000000` (initial schema) |
| `foster_parents` | `20240101000000` |
| `dogs` | `20240101000000` |
| `applications` | `20240101000000` |
| `messages` | `20240101000000` |
| `ratings` | `20240101000000` |
| `shelter_ratings` | `20240107000000` |
| `shelter_fosters` | `20240113000000` |
| `shelter_foster_invites` | `20240113000000` |
| `shelter_foster_notes` | `20240113000000` |
| `notifications` | `20240115000000` (Step 48 of this roadmap) |

4. Verify the `applications` table has the new columns added in Step 46 of this roadmap:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'applications'
ORDER BY ordinal_position;
```

Confirm these columns exist in the output: `available_from`, `available_until`, `why_this_dog`, `emergency_contact_name`, `emergency_contact_phone`, `responsibilities_acknowledged`.

5. If any migration has not been applied, navigate to `supabase/migrations/` in the codebase, open the relevant `.sql` file, and run its full contents in the Supabase SQL Editor. Run them in chronological order (by filename prefix).

**Verification test:** Run the column check query from step 4. All six new `applications` columns must be present before the pilot begins.

---

### OPS-5: Pilot Shelter Verification Badge

**Why this matters:** The `shelters.is_verified` column defaults to `false` for all new shelters. The pilot shelter should display the verified badge to convey legitimacy to fosters browsing their dogs. This is set manually via SQL — there is no admin UI yet.

**Steps:**

1. You need the exact name or slug of the pilot shelter as it appears in the database. If you do not know it:
   - In the Supabase dashboard, go to **Table Editor → shelters**.
   - Find the pilot shelter's row. Note the value in the `name` column.
2. Open the **SQL Editor** in Supabase.
3. Run the following query, replacing `'Pilot Shelter Name'` with the exact name from step 1:

```sql
-- Preview before updating: confirm this returns exactly one row
SELECT id, name, slug, is_verified
FROM public.shelters
WHERE name = 'Pilot Shelter Name';
```

4. If the query returns exactly one row with `is_verified = false`, run:

```sql
UPDATE public.shelters
SET is_verified = true
WHERE name = 'Pilot Shelter Name';
```

5. Confirm the update succeeded:

```sql
SELECT id, name, slug, is_verified
FROM public.shelters
WHERE name = 'Pilot Shelter Name';
```

The `is_verified` column should now show `true`.

**Verification test:** On the live app, navigate to `/shelters/<pilot-shelter-slug>`. A verified badge (checkmark icon) should appear next to the shelter name. If the shelter has not yet signed up, complete this step after they create their account.

---

### OPS-6: Support Email Constant

**Why this matters:** The error boundary pages (`src/app/error.tsx`, `(foster)/error.tsx`, `(shelter)/error.tsx`) show a "Contact support" mailto link. This currently points to a placeholder address (`support@fostrfind.local`). Before the pilot, this must be updated to a real inbox so users experiencing errors can actually reach someone.

**Steps:**

This is a **code change**, not a dashboard setting. A developer must:

1. Open `src/lib/constants.ts`.
2. Find the line: `export const SUPPORT_EMAIL = 'support@fostrfind.local'`
3. Replace `'support@fostrfind.local'` with the real support email address (e.g., `'support@fostrfind.com'` or a personal Gmail address for the pilot).
4. Commit and deploy.

**Verification test:** On the live app, navigate to a non-existent route to trigger the 404/error page. Confirm the "Contact support" link opens a mail client addressed to the correct real email address.

---

### OPS-7: End-to-End Smoke Test

**Why this matters:** This final check verifies the entire core user flow works on the live production environment with real data. Run this after all other ops items are complete and after Steps 46–49 are deployed.

**Steps — Foster flow:**

1. Open an incognito/private browser window. Navigate to the live app URL.
2. Click **Sign up as a Foster**. Create a new account with a real email address you control.
3. Verify a confirmation email arrives within 5 minutes. Click the link to confirm the account.
4. Complete the foster onboarding form. Fill in all fields including location.
5. Navigate to **Browse Dogs**. Confirm dogs are visible (the pilot shelter must have added at least one dog).
6. Click a dog card. On the dog detail page, click **Apply to Foster [Dog Name]**.
7. Fill in the application form: availability dates, why this dog, emergency contact, check the acknowledgment box, and optionally add a note. Click **Submit Application**.
8. Confirm a success toast appears and the button changes to show the application was submitted.

**Steps — Shelter flow:**

9. Open a second incognito window (or a different browser). Log in as the pilot shelter user.
10. Navigate to **Applications**. Confirm the application from step 7 appears with status "Submitted".
11. Confirm an email notification arrived at the shelter's email address saying a new application was received.
12. Click the application. Review the full application details including all the new fields (availability, why this dog, emergency contact).
13. Click **Accept**. Confirm the application status changes to "Accepted".
14. Return to the foster browser window. Confirm an email notification arrived at the foster's address saying the application was accepted.
15. Navigate to the **Messages** section on both sides. Send a message from the shelter to the foster. Confirm it appears in real-time in the foster's thread without a page refresh.
16. Check the **Notifications** bell icon on both portals. Confirm notifications appear for the events triggered above.

**Pass criteria:** All 16 steps complete without errors. If any step fails, file a bug report before inviting the pilot shelter.

---

## Phase 7: Pilot Launch

---

### Step 46: Application Form Improvements
**Estimated time:** 3–4 hours
**TODO ref:** Core product gap — application currently only captures a free-text note.

**What this adds:**

The `applications` table gains six new columns. The foster-side "Apply" button is replaced with a `Dialog` containing a structured application form. The shelter-side application detail view gains a new section displaying all new fields. A new `POST /api/applications` route handles creation server-side so that notifications (Step 48) can be fired.

**Why a new API route instead of client-side insert:**

The existing application insert is performed by a client component (`foster/dog/[id]/page.tsx`) via direct Supabase call. Firing a notification to the shelter requires the service-role client, which must only run server-side. Moving the insert to an API route is the correct architectural boundary — it also allows adding rate limiting (already present on all other mutation routes) and centralises validation.

---

#### Database Migration

**File to create:** `supabase/migrations/20240114000000_application_form_fields.sql`

Run this SQL in the Supabase SQL Editor for all environments (local and production) after creating the file:

```sql
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS available_from         DATE,
  ADD COLUMN IF NOT EXISTS available_until        DATE,
  ADD COLUMN IF NOT EXISTS why_this_dog           TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT,
  ADD COLUMN IF NOT EXISTS responsibilities_acknowledged BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.applications.available_from
  IS 'Date the foster is available to start caring for the dog (required on submission)';
COMMENT ON COLUMN public.applications.available_until
  IS 'Date the foster expects the placement to end; NULL means open-ended';
COMMENT ON COLUMN public.applications.why_this_dog
  IS 'Foster explanation of why they want to foster this specific dog';
COMMENT ON COLUMN public.applications.emergency_contact_name
  IS 'Full name of the foster''s emergency contact';
COMMENT ON COLUMN public.applications.emergency_contact_phone
  IS 'Phone number of the foster''s emergency contact';
COMMENT ON COLUMN public.applications.responsibilities_acknowledged
  IS 'True when the foster has checked the responsibility acknowledgment checkbox';
```

> **Note on the `note` column:** The existing `note` column is NOT dropped or renamed. In the new UI it is relabelled "Anything else you need us to know?" and remains optional. No data migration is needed.

---

#### Files to Create

**`src/app/api/applications/route.ts`** — POST handler

Auth pattern: follow `src/app/api/applications/[id]/accept/route.ts` exactly for the auth + rate-limit preamble. Then:

```ts
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeText, sanitizeMultiline } from '@/lib/helpers'
// createNotification is imported in Step 48 — leave a comment here:
// import { createNotification } from '@/lib/notifications' // wired in Step 48

const applicationSchema = z.object({
  dog_id: z.string().uuid('dog_id must be a valid UUID'),
  shelter_id: z.string().uuid('shelter_id must be a valid UUID'),
  available_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'available_from must be YYYY-MM-DD'),
  available_until: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'available_until must be YYYY-MM-DD')
    .nullable()
    .optional(),
  why_this_dog: z
    .string()
    .min(10, 'Please explain in at least 10 characters why you want to foster this dog')
    .max(1000, 'Why this dog must be 1000 characters or fewer'),
  emergency_contact_name: z
    .string()
    .min(1, 'Emergency contact name is required')
    .max(200),
  emergency_contact_phone: z
    .string()
    .min(7, 'Emergency contact phone number is required')
    .max(50),
  responsibilities_acknowledged: z.literal(true, {
    errorMap: () => ({ message: 'You must acknowledge the fostering responsibilities' }),
  }),
  note: z.string().max(1000).nullable().optional(), // "Anything else" — optional
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) return NextResponse.json({ error: 'Authentication error' }, { status: 503 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = rateLimit(user.id, 10, 60000)
  if (!success) return rateLimitResponse()

  // Fetch foster_parents row to get foster_id
  const { data: foster, error: fosterError } = await supabase
    .from('foster_parents')
    .select('id')
    .eq('user_id', user.id)
    .single()
  if (fosterError || !foster) {
    return NextResponse.json({ error: 'Foster profile not found' }, { status: 404 })
  }

  // Parse + validate body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = applicationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
      { status: 422 },
    )
  }

  const data = parsed.data

  // Duplicate check — one application per foster per dog
  const { data: existing } = await supabase
    .from('applications')
    .select('id')
    .eq('dog_id', data.dog_id)
    .eq('foster_id', foster.id)
    .maybeSingle()
  if (existing) {
    return NextResponse.json({ error: 'You have already applied for this dog' }, { status: 409 })
  }

  // Insert
  const { data: application, error: insertError } = await supabase
    .from('applications')
    .insert({
      dog_id: data.dog_id,
      shelter_id: data.shelter_id,
      foster_id: foster.id,
      status: 'submitted',
      available_from: data.available_from,
      available_until: data.available_until ?? null,
      why_this_dog: sanitizeMultiline(data.why_this_dog),
      emergency_contact_name: sanitizeText(data.emergency_contact_name),
      emergency_contact_phone: sanitizeText(data.emergency_contact_phone),
      responsibilities_acknowledged: true,
      note: data.note ? sanitizeMultiline(data.note) : null,
    })
    .select()
    .single()

  if (insertError || !application) {
    console.error('[applications] insert failed:', insertError?.message)
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 })
  }

  // Notification + email fired in Step 48 — placeholder comment:
  // void notifyApplicationSubmitted(application, shelter_user_id)

  return NextResponse.json(application, { status: 201 })
}
```

**`src/components/foster/application-form-dialog.tsx`** — Dialog component

This is a `'use client'` component. It replaces the existing inline apply button logic on the dog detail page.

Props interface:
```ts
interface ApplicationFormDialogProps {
  dogId: string
  dogName: string
  shelterId: string
  shelterName: string
  alreadyApplied: boolean    // passed from server; disables trigger if true
  applicationId?: string     // passed if already applied; links to existing application
}
```

The component renders:
- **Trigger button:** `"Apply to Foster {dogName}"` — disabled + shows "Application Submitted" text when `alreadyApplied` is true.
- **Dialog content:** A form with the following fields in order:

| Field | Type | Label | Validation |
|---|---|---|---|
| `available_from` | `<input type="date">` | "Available from" | Required. Must not be in the past. |
| `available_until` | `<input type="date">` | "Available until (optional)" | Optional. If set, must be after `available_from`. |
| `why_this_dog` | `<Textarea>` | "Why do you want to foster {dogName}?" | Required. Min 10 chars. Max 1000. Shows character count. |
| `emergency_contact_name` | `<Input>` | "Emergency contact name" | Required. |
| `emergency_contact_phone` | `<Input type="tel">` | "Emergency contact phone number" | Required. |
| Responsibility acknowledgment | `<Checkbox>` | "I understand that fostering is a commitment and I will communicate openly with the shelter about any concerns." | Required. Form cannot submit without it checked. |
| `note` | `<Textarea>` | "Anything else you need us to know? (optional)" | Optional. Max 1000 chars. |

- **Submit button:** `"Submit Application"` — shows `Loader2` spinner while loading. Calls `POST /api/applications`. On success: shows `toast.success('Application submitted!')`, closes the dialog, calls `router.refresh()` to update the page state. On error: shows `toast.error('Something went wrong. Please try again.')`.
- **Cancel button:** `"Cancel"` — closes dialog, clears form state.

Use `react-hook-form` + `zodResolver` wired to the same `applicationSchema` from the API route (extract the schema to `src/lib/schemas.ts` alongside the existing schemas there, import it in both the API route and the dialog component).

---

#### Files to Modify

**`src/app/(foster)/foster/dog/[id]/page.tsx`**

1. Remove the existing direct Supabase `applications.insert()` call and the simple `<Button>Apply</Button>` element.
2. Import and render `<ApplicationFormDialog>` in its place, passing `dogId`, `dogName`, `shelterId`, `shelterName`, `alreadyApplied`, and `applicationId` from the server-fetched data.
3. The existing check for a duplicate application (which disables the apply button) is replaced by the `alreadyApplied` prop — the server page already queries for an existing application row and passes it down. Keep this server-side check; remove any client-side duplicate checking.
4. In DEV_MODE, pass `alreadyApplied={false}` and placeholder IDs so the dialog renders without crashing.

**`src/types/database.ts`**

Add the six new columns to the `Application` interface:

```ts
// Inside the Application interface, after the existing `note` field:
available_from: string | null           // ISO date string YYYY-MM-DD
available_until: string | null          // ISO date string YYYY-MM-DD, nullable
why_this_dog: string | null
emergency_contact_name: string | null
emergency_contact_phone: string | null
responsibilities_acknowledged: boolean
```

**`src/app/(shelter)/shelter/applications/[id]/page.tsx`**

Add a new card section below the existing foster profile card that displays all new application fields. This is a read-only display — no inputs. Style it as a `Card` with a `CardHeader` ("Application Details") and a grid of label/value pairs.

Display rules:
- `available_from` → format with `formatDate()` from `src/lib/helpers.ts`
- `available_until` → format with `formatDate()` if not null; show "Open-ended" if null
- `why_this_dog` → plain paragraph text, preserved whitespace
- `emergency_contact_name` + `emergency_contact_phone` → shown side by side
- `responsibilities_acknowledged` → show a green checkmark + "Acknowledged" if true; amber warning + "Not acknowledged" if false
- `note` ("Anything else") → show only if not null/empty

---

#### Pitfalls

- The `applicationSchema` Zod object is defined in both the API route and the dialog. Extract it to `src/lib/schemas.ts` to avoid duplication. The file already exists and has other schemas — add `applicationCreateSchema` there.
- `available_until` must be validated as strictly after `available_from` when both are provided. Use a Zod `.refine()` at the schema level, not inline in the component.
- The date inputs on iOS Safari render as text fields unless `type="date"` is used on a native `<input>` — do NOT use shadcn's `<Input>` component for date fields; use a native `<input type="date" className="...">` with the same visual styling.
- The existing dog detail page may have server-side logic that short-circuits (e.g., `notFound()`) before reaching the apply button. Ensure `alreadyApplied` is computed inside a try-catch so a DB error on the duplicate-check query doesn't break the entire page — default to `alreadyApplied: false` on error.
- The `POST /api/applications` route is new but must also be added to the rate-limit route list in `src/lib/rate-limit.ts` comments (or wherever that list is documented) so future auditors know it's covered.

---

#### Verification

1. Dog detail page: "Apply" button is gone; `"Apply to Foster [Dog Name]"` Dialog trigger is in its place.
2. Clicking the trigger opens the Dialog with all seven form fields visible.
3. Submitting with any required field empty shows an inline validation error on that field (not a toast — inline, per form patterns).
4. Submitting with all fields valid shows the `Loader2` spinner, then `toast.success('Application submitted!')`, then closes the dialog.
5. After submitting, the trigger button changes to "Application Submitted" and is disabled.
6. On the shelter side, open the application detail page. Confirm the "Application Details" card shows all six new fields with formatted values.
7. Trying to apply twice returns a `409` and shows an error toast.
8. Type check passes. No `any` types.

**Commit:** `feat: structured application form — availability, why-this-dog, emergency contact, acknowledgment (§46)`

---

### Step 47: Sentry Error Tracking
**Estimated time:** 1.5–2 hours
**TODO ref:** Infrastructure — catch and diagnose bugs during the pilot before users report them.

**What this adds:** Sentry error tracking wired into the Next.js App Router. All unhandled server errors, client-side React errors, and API route exceptions are captured and sent to a Sentry project dashboard in real time.

---

#### Prerequisites

Before writing any code, a Sentry project must exist:

1. Go to `https://sentry.io` and log in (or create an account).
2. Create a new **Project**. Select **Next.js** as the platform. Name it `fostr-find`.
3. Sentry will display a **DSN** — a URL that looks like `https://abc123@o123456.ingest.sentry.io/789`. Copy this value.
4. In **Project Settings → Client Keys (DSN)**, also note the project's Auth Token (needed for source maps). Generate one if none exists under **Settings → Auth Tokens**.

---

#### Files to Create

**`sentry.client.config.ts`** (project root)

```ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,           // 10% of transactions — adjust after pilot
  replaysSessionSampleRate: 0,     // disable session replays for now
  replaysOnErrorSampleRate: 0,
  enabled: process.env.NODE_ENV === 'production',
})
```

**`sentry.server.config.ts`** (project root)

```ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',
})
```

**`sentry.edge.config.ts`** (project root)

```ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: process.env.NODE_ENV === 'production',
})
```

**`instrumentation.ts`** (project root — Next.js 14 instrumentation hook)

```ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('./sentry.edge.config')
  }
}
```

---

#### Files to Modify

**`package.json`**

Add to `dependencies`:
```json
"@sentry/nextjs": "^8"
```

Run `npm install` after adding.

**`next.config.mjs`**

Wrap the existing config with `withSentryConfig`:

```js
import { withSentryConfig } from '@sentry/nextjs'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // ... existing config (images.remotePatterns, etc.) — do not remove any existing config
}

export default withSentryConfig(nextConfig, {
  org: 'your-sentry-org-slug',       // replace with the Sentry org slug
  project: 'fostr-find',
  silent: true,                       // suppress Sentry build output
  widenClientFileUpload: true,
  hideSourceMaps: true,               // hide source maps from client bundles
  disableLogger: true,
})
```

> **Finding the org slug:** In the Sentry dashboard, go to **Settings → General Settings**. The slug is in the URL: `sentry.io/organizations/<slug>/`.

**`src/app/error.tsx`**, **`src/app/(foster)/error.tsx`**, **`src/app/(shelter)/error.tsx`**

Each error boundary currently logs to `console.error`. Add explicit Sentry capture so handled React errors are also tracked (unhandled ones are auto-captured, but these boundaries catch errors before they become unhandled):

```ts
// Add at the top of each error.tsx file:
import * as Sentry from '@sentry/nextjs'

// Inside the useEffect that currently logs:
useEffect(() => {
  console.error('[error-boundary:root]', { message: error.message, digest })
  Sentry.captureException(error, {
    tags: { scope: 'root' },   // use 'foster' or 'shelter' in the respective files
    extra: { digest },
  })
}, [error, digest])
```

---

#### Environment Variables

Add to Vercel (see OPS-3):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SENTRY_DSN` | The DSN from the Sentry project (starts with `https://`) |
| `SENTRY_AUTH_TOKEN` | The auth token for source map uploads (starts with `sntrys_`) |

Also add `NEXT_PUBLIC_SENTRY_DSN` to your local `.env.local` for development (but Sentry is disabled in non-production via `enabled: process.env.NODE_ENV === 'production'`, so it won't send events locally).

---

#### Pitfalls

- `@sentry/nextjs` version 8 is the App Router-compatible release. Do NOT install version 7 — it does not support the `instrumentation.ts` hook.
- The `withSentryConfig` wrapper in `next.config.mjs` uploads source maps during `next build`. This requires `SENTRY_AUTH_TOKEN` to be set in the build environment (Vercel). If the token is missing, the build will warn but not fail — source maps just won't upload, making stack traces less readable.
- Do NOT set `tracesSampleRate: 1.0` in production — at 100% sampling, Sentry will capture every request and the free tier quota will exhaust quickly. `0.1` (10%) is appropriate for a pilot.
- The three config files (`sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`) must be at the **project root**, not inside `src/`. Next.js and the Sentry SDK look for them there by convention.
- In DEV_MODE, `enabled: process.env.NODE_ENV === 'production'` ensures Sentry never fires locally or in dev, so it does not interfere with the DEV_MODE flag or local development.

---

#### Verification

1. Deploy to production (Vercel redeploy after adding env vars).
2. In the Sentry dashboard, navigate to the `fostr-find` project.
3. Trigger a test error: navigate to any portal page while logged in, then temporarily break a server component (or use Sentry's "Send Test Event" button in **Settings → Client Keys → Send Test Event**). Confirm the event appears in the Sentry Issues feed within 30 seconds.
4. Confirm the error boundary pages still render correctly — adding Sentry must not change visible behavior.
5. Type check passes. Build passes.

**Commit:** `feat: Sentry error tracking setup for App Router (§47)`

---

### Step 48: Notification Center — Foundation
**Estimated time:** 3–4 hours
**Depends on:** Step 46 (the `POST /api/applications` route must exist before this step can add the `application_submitted` notification trigger)

**What this adds:**

- A `notifications` database table storing all platform events for each user.
- A `createNotification()` service-role helper in `src/lib/notifications.ts`.
- Thirteen notification types covering the full application lifecycle, messaging, invites, and roster changes.
- A `PATCH /api/notifications/read` endpoint for marking notifications read.
- A new `POST /api/messages` API route (replacing direct client-side Supabase insert in `MessageThread`) so the message-send path has server-side access to fire notifications.
- Notification firing wired into every relevant API route.
- `getPortalLayoutData` updated to include `unreadNotifications` count.

Step 49 builds the UI (bell icon, dropdown, notifications page) on top of this foundation.

---

#### Database Migration

**File to create:** `supabase/migrations/20240115000000_notifications.sql`

Run this SQL in the Supabase SQL Editor after creating the file:

```sql
-- Notification type enum (enforced via CHECK, not a Postgres ENUM, so it is easier to extend)
CREATE TABLE public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL    DEFAULT now(),
  user_id     UUID        NOT NULL    REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT        NOT NULL    CHECK (type IN (
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
  title       TEXT        NOT NULL,
  body        TEXT,
  link        TEXT,
  read        BOOLEAN     NOT NULL DEFAULT false,
  read_at     TIMESTAMPTZ,
  metadata    JSONB
);

-- Index for the two most common queries:
-- 1. Unread count for the badge (user_id + read)
-- 2. Notification list ordered by created_at
CREATE INDEX idx_notifications_user_read
  ON public.notifications(user_id, read);

CREATE INDEX idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users may only read their own notifications
CREATE POLICY "users read own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users may mark their own notifications as read (UPDATE read + read_at only)
CREATE POLICY "users update own notifications"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No INSERT policy — all inserts go through the service-role client in src/lib/notifications.ts
-- Service role bypasses RLS, so no INSERT policy is needed or wanted here.
```

---

#### New Files to Create

**`src/lib/notifications.ts`** — Service-role notification helper

```ts
import { createServiceClient } from '@/lib/supabase/service'

export type NotificationType =
  | 'application_submitted'
  | 'application_reviewing'
  | 'application_accepted'
  | 'application_declined'
  | 'application_completed'
  | 'application_withdrawn'
  | 'new_message'
  | 'invite_received'
  | 'invite_accepted'
  | 'invite_declined'
  | 'invite_cancelled'
  | 'roster_joined'
  | 'roster_left'

export interface CreateNotificationParams {
  userId: string           // auth.users.id of the recipient
  type: NotificationType
  title: string            // short, sentence-case, no trailing punctuation
  body?: string            // optional second line, truncated in dropdown at 80 chars
  link?: string            // relative URL to navigate to when the notification is clicked
  metadata?: Record<string, unknown>  // extra context, not displayed in UI
}

/**
 * Creates a notification row using the service-role client.
 * Never throws — notification creation must never block or fail the calling action.
 * Logs errors to console for Sentry to capture.
 */
export async function createNotification(
  params: CreateNotificationParams,
): Promise<void> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('notifications').insert({
    user_id:  params.userId,
    type:     params.type,
    title:    params.title,
    body:     params.body     ?? null,
    link:     params.link     ?? null,
    metadata: params.metadata ?? null,
  })
  if (error) {
    console.error('[notifications] createNotification failed:', {
      type: params.type,
      userId: params.userId,
      error: error.message,
    })
  }
}
```

> **Service-client allowlist:** `src/lib/__tests__/service-client-allowlist.test.ts` enforces that only a specific list of files may import `createServiceClient`. After creating `src/lib/notifications.ts`, add it to the allowlist in that test file. Failure to do so will cause the test suite to fail.

**`src/app/api/messages/route.ts`** — POST handler for sending messages

This replaces the direct Supabase insert in `MessageThread`. The client component will call this endpoint instead.

```ts
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { sanitizeMultiline } from '@/lib/helpers'
import { createNotification } from '@/lib/notifications'

const messageSchema = z.object({
  applicationId: z.string().uuid(),
  body: z.string().min(1, 'Message cannot be empty').max(4000),
})

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) return NextResponse.json({ error: 'Authentication error' }, { status: 503 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { success } = rateLimit(user.id, 30, 60000)  // 30 messages per minute
  if (!success) return rateLimitResponse()

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = messageSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, { status: 422 })
  }

  // Determine sender_role by looking up whether user is shelter or foster for this application
  const { data: application, error: appError } = await supabase
    .from('applications')
    .select(`
      id,
      foster:foster_parents!inner(id, user_id, first_name, last_name),
      shelter:shelters!inner(id, user_id, name)
    `)
    .eq('id', parsed.data.applicationId)
    .single()

  if (appError || !application) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  }

  const isFoster  = application.foster.user_id === user.id
  const isShelter = application.shelter.user_id === user.id
  if (!isFoster && !isShelter) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const senderRole: 'foster' | 'shelter' = isFoster ? 'foster' : 'shelter'

  const { data: message, error: insertError } = await supabase
    .from('messages')
    .insert({
      application_id: parsed.data.applicationId,
      sender_id: user.id,
      sender_role: senderRole,
      body: sanitizeMultiline(parsed.data.body),
      read: false,
    })
    .select()
    .single()

  if (insertError || !message) {
    console.error('[messages] insert failed:', insertError?.message)
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
  }

  // Fire notification to the other party
  const recipientUserId = isFoster
    ? application.shelter.user_id
    : application.foster.user_id
  const senderName = isFoster
    ? `${application.foster.first_name} ${application.foster.last_name}`
    : application.shelter.name
  const recipientLink = isFoster
    ? `/shelter/messages/${parsed.data.applicationId}`
    : `/foster/messages/${parsed.data.applicationId}`

  void createNotification({
    userId: recipientUserId,
    type: 'new_message',
    title: `New message from ${senderName}`,
    body: parsed.data.body.slice(0, 100),
    link: recipientLink,
    metadata: { applicationId: parsed.data.applicationId, messageId: message.id },
  })

  return NextResponse.json(message, { status: 201 })
}
```

**`src/app/api/notifications/read/route.ts`** — PATCH handler for marking notifications read

```ts
import { z } from 'zod'
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const readSchema = z.union([
  z.object({ ids: z.array(z.string().uuid()).min(1) }),  // mark specific notifications
  z.object({ all: z.literal(true) }),                    // mark all as read
])

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) return NextResponse.json({ error: 'Authentication error' }, { status: 503 })
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = readSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Provide either { ids: string[] } or { all: true }' }, { status: 422 })
  }

  const now = new Date().toISOString()

  if ('all' in parsed.data) {
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: now })
      .eq('user_id', user.id)
      .eq('read', false)
    if (error) {
      console.error('[notifications] mark all read failed:', error.message)
      return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 })
    }
  } else {
    // Only update notifications that belong to the current user (RLS enforces this too)
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: now })
      .in('id', parsed.data.ids)
      .eq('user_id', user.id)
    if (error) {
      console.error('[notifications] mark ids read failed:', error.message)
      return NextResponse.json({ error: 'Failed to mark notifications as read' }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
```

---

#### Files to Modify

**`src/lib/notifications.ts` — also add `Notification` type to `src/types/database.ts`**

Add to the `Application` section of `src/types/database.ts`:

```ts
export interface Notification {
  id: string
  created_at: string
  user_id: string
  type: NotificationType   // import from src/lib/notifications.ts or duplicate the union here
  title: string
  body: string | null
  link: string | null
  read: boolean
  read_at: string | null
  metadata: Record<string, unknown> | null
}
```

**`src/lib/portal-layout-data.ts`**

Add `unreadNotifications: number` to the return type `PortalLayoutData` and to the parallel query block inside `getPortalLayoutData()`:

```ts
// Add alongside the existing unreadMessages + pendingInvites queries:
const unreadNotificationsQuery = supabase
  .from('notifications')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', user.id)
  .eq('read', false)

// In the Promise.all destructure:
const [unreadMessagesResult, pendingInvitesResult, unreadNotificationsResult] =
  await Promise.all([unreadMessagesQuery, pendingInvitesQuery, unreadNotificationsQuery])

// In the return object:
unreadNotifications: unreadNotificationsResult.count ?? 0,
```

**`src/types/portal.ts`**

Add `unreadNotifications: number` to `PortalLayoutData`.

**`src/components/portal-nav.tsx`**

Add `unreadNotifications: number` to the `NavCounts` type:

```ts
export type NavCounts = {
  unreadMessages: number
  pendingInvites: number
  unreadNotifications: number   // NEW
}
```

Pass it down from the layouts — both `(foster)/layout.tsx` and `(shelter)/layout.tsx` already destructure `NavCounts` from `getPortalLayoutData`. Add `unreadNotifications` to the destructure and pass it in.

**`src/app/(foster)/foster/dog/[id]/page.tsx`** — remove direct insert, call API route

The `POST /api/applications` route was created in Step 46. If Step 46 still left any direct `supabase.from('applications').insert()` calls in this file, remove them now. All application creation goes through the API route.

**`src/components/messages/message-thread.tsx`**

Replace the direct `supabase.from('messages').insert(...)` call with a fetch to the new `POST /api/messages` route:

```ts
// BEFORE (remove):
const { data: newMsg, error } = await supabase
  .from('messages')
  .insert({ application_id: applicationId, sender_id: currentUserId, ... })
  .select()
  .single()

// AFTER (add):
const res = await fetch('/api/messages', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ applicationId, body: messageBody }),
})
const newMsg = res.ok ? await res.json() : null
if (!res.ok || !newMsg) {
  toast.error('Failed to send message. Please try again.')
  setLoading(false)
  return
}
```

The optimistic UI append, scroll-to-bottom, and Realtime subscription code in `MessageThread` do not change.

**API routes — add `createNotification()` calls**

Add notification firing (fire-and-forget with `void`) to each of the following API routes immediately after their successful database operation. Each notification fires to the specified recipient's `user_id`.

The application rows fetched by these routes already include the necessary joins. Read each route's existing query carefully to confirm you have access to `foster.user_id` and `shelter.user_id` before writing the notification call.

| Route file | Event | Recipient | `type` | `title` | `link` |
|---|---|---|---|---|---|
| `POST /api/applications` (Step 46) | Application submitted | Shelter's `user_id` | `application_submitted` | `"New application from {fosterName} for {dogName}"` | `/shelter/applications/{applicationId}` |
| `POST /api/applications/[id]/review` | Moved to reviewing | Foster's `user_id` | `application_reviewing` | `"Your application for {dogName} is under review"` | `/foster/applications/{applicationId}` |
| `POST /api/applications/[id]/accept` | Application accepted | Foster's `user_id` | `application_accepted` | `"Your application for {dogName} was accepted!"` | `/foster/messages/{applicationId}` |
| `POST /api/applications/[id]/decline` | Application declined | Foster's `user_id` | `application_declined` | `"Your application for {dogName} was not accepted"` | `/foster/applications/{applicationId}` |
| `POST /api/applications/[id]/complete` | Placement completed | Foster's `user_id` | `application_completed` | `"Your foster placement for {dogName} is complete"` | `/foster/history` |
| `POST /api/applications/[id]/complete` | Placement completed | Shelter's `user_id` | `application_completed` | `"{fosterName}'s foster placement for {dogName} is complete"` | `/shelter/applications/{applicationId}` |
| `POST /api/applications/[id]/withdraw` | Application withdrawn | Shelter's `user_id` | `application_withdrawn` | `"{fosterName} withdrew their application for {dogName}"` | `/shelter/applications` |
| `POST /api/shelter/foster-invites` | Invite sent | Foster's `user_id` (if account exists) | `invite_received` | `"{shelterName} has invited you to join their foster roster"` | `/foster/invites` |
| `POST /api/shelter/foster-invites/[id]/accept` | Invite accepted | Shelter's `user_id` | `invite_accepted` | `"{fosterName} accepted your roster invitation"` | `/shelter/fosters` |
| `POST /api/shelter/foster-invites/[id]/decline` | Invite declined | Shelter's `user_id` | `invite_declined` | `"{fosterName} declined your roster invitation"` | `/shelter/fosters` |
| `POST /api/shelter/foster-invites/[id]/cancel` | Invite cancelled | Foster's `user_id` (if account exists) | `invite_cancelled` | `"Your invitation from {shelterName} was cancelled"` | `/foster/invites` |
| `POST /api/applications/[id]/accept` (roster join side effect) | Foster added to roster | Foster's `user_id` | `roster_joined` | `"You've been added to {shelterName}'s foster roster"` | `/foster/shelters-roster` |
| `DELETE /api/foster/shelter-roster/[shelterId]` | Foster left roster | Shelter's `user_id` | `roster_left` | `"{fosterName} left your foster roster"` | `/shelter/fosters` |

> **Note on invite routes for non-account holders:** `shelter_foster_invites` allows inviting email addresses that don't have an account yet. When firing notifications for invite events, first check whether the invite has a `foster_id` (meaning an account exists). If `foster_id` is null, skip the notification — the email invitation is the only delivery mechanism for pre-signup users.

---

#### Pitfalls

- `createNotification` uses the service client. Read the existing `service-client-allowlist.test.ts` before writing — `src/lib/notifications.ts` must be added to its allowlist or the test suite will fail.
- Every `void createNotification(...)` call must be genuinely fire-and-forget — do NOT `await` it or place it before the `return NextResponse.json(...)` statement. The notification must never cause the primary action to fail.
- The `POST /api/messages` route changes the client-side message insert. After this step, the Realtime subscription in `MessageThread` remains unchanged — it still listens for new `messages` rows from other senders. The optimistic UI append for the sender's own message also remains unchanged. The only change is the HTTP call to send; the receive path is untouched.
- The `unreadNotifications` count in `getPortalLayoutData` runs as a third parallel query alongside the existing two. It must not block or fail the layout render — add a `?? 0` fallback on the count.
- `src/types/portal.ts` and `src/components/portal-nav.tsx` both declare `PortalLayoutData` / `NavCounts` interfaces. Both must be updated — missing one will cause a TypeScript error in the layout files.

---

#### Verification

1. Submit a new application. In the Supabase SQL Editor, run:
   ```sql
   SELECT type, title, link, read FROM notifications ORDER BY created_at DESC LIMIT 5;
   ```
   Confirm an `application_submitted` row exists with the shelter's `user_id`.
2. Accept the application. Confirm an `application_accepted` row exists with the foster's `user_id`.
3. Send a message. Confirm a `new_message` row exists for the recipient.
4. Call `PATCH /api/notifications/read` with `{ all: true }` via `curl` or a REST client. Confirm all rows for that user now show `read = true`.
5. Log out and back in. Confirm `getPortalLayoutData` returns `unreadNotifications > 0` before marking as read.
6. Type check passes. Test suite passes (`npm test`). Build passes.

**Commit:** `feat: notification center foundation — table, helper, API routes, trigger wiring (§48)`

---

### Step 49: Notification Center — UI
**Estimated time:** 2.5–3 hours
**Depends on:** Step 48 (foundation must be deployed and tested first)

**What this adds:**

- `NotificationBell` component: a bell icon in the portal sidebar with a red badge showing unread count. Clicking opens a Popover dropdown displaying the 8 most recent notifications.
- The dropdown shows each notification with a type-specific icon, title, body preview, relative timestamp, and read/unread visual state. A "Mark all as read" button and a "See all" link live at the bottom.
- `/foster/notifications` and `/shelter/notifications` pages: a full paginated list of all notifications, grouped by date.
- Clicking any notification marks it as read and navigates to its `link`.

---

#### Files to Create

**`src/components/notifications/notification-bell.tsx`** — Bell icon + Popover dropdown

This is a `'use client'` component. It receives `initialCount: number` from the server layout (so the badge renders immediately without a client fetch) but fetches the actual notification list on demand when the Popover opens.

```ts
interface NotificationBellProps {
  initialCount: number
}
```

Internal state:
- `count: number` — initialised from `initialCount`. Decrements when "Mark all as read" is clicked.
- `notifications: Notification[]` — empty until the Popover is opened for the first time.
- `loading: boolean` — true while fetching.

Behavior:
1. Renders a `<Button variant="ghost" size="icon">` containing `<Bell className="h-5 w-5" />` from lucide-react.
2. When `count > 0`, overlays a small red badge (absolute-positioned `<span>`) showing the count (capped at display at "9+" if count > 9).
3. Wraps in a `<Popover>` from shadcn/ui. `<PopoverTrigger asChild>` wraps the button. `<PopoverContent>` is 380px wide, aligned to the start edge.
4. When the Popover opens (`onOpenChange(true)`), fires a Supabase browser-client query to fetch the 8 most recent notifications for the current user, ordered by `created_at DESC`. Uses `createBrowserClient` from `@/lib/supabase/client`.
5. Popover content structure:
   - **Header row:** "Notifications" (`text-sm font-semibold`) + "Mark all as read" button (`variant="ghost" size="sm"`, hidden if `count === 0`).
   - **Notification list:** map over `notifications`. Each row:
     - Type icon (see icon map below), 16px, colored by semantic category.
     - `title` (`text-sm font-medium`) + optional `body` truncated to 80 characters (`text-xs text-muted-foreground`).
     - Relative timestamp using `formatRelativeTime` from `@/lib/helpers`.
     - Unread indicator: left-border tint or a `•` dot when `read === false`.
     - Entire row is a `<button>` that calls `handleNotificationClick(notification)`.
   - **Footer:** "See all notifications" `<Link>` pointing to `/foster/notifications` or `/shelter/notifications` (the component must know which portal it is in — pass `portal: 'foster' | 'shelter'` as a prop).
6. `handleNotificationClick(n)`:
   - If `!n.read`, call `PATCH /api/notifications/read` with `{ ids: [n.id] }` (fire-and-forget).
   - Navigate to `n.link` using `useRouter().push(n.link)`.
   - Decrement `count` by 1 in local state.
7. "Mark all as read" calls `PATCH /api/notifications/read` with `{ all: true }`, sets `count` to 0, and updates all notification rows in local state to `read: true`.

**Notification type → icon map** (all from `lucide-react`):

| Type | Icon | Color class |
|---|---|---|
| `application_submitted` | `FileText` | `text-amber-500` |
| `application_reviewing` | `Eye` | `text-amber-500` |
| `application_accepted` | `CheckCircle2` | `text-green-600` |
| `application_declined` | `XCircle` | `text-destructive` |
| `application_completed` | `Award` | `text-purple-600` |
| `application_withdrawn` | `Undo2` | `text-muted-foreground` |
| `new_message` | `MessageCircle` | `text-blue-500` |
| `invite_received` | `Mail` | `text-primary` |
| `invite_accepted` | `UserCheck` | `text-green-600` |
| `invite_declined` | `UserX` | `text-destructive` |
| `invite_cancelled` | `X` | `text-muted-foreground` |
| `roster_joined` | `Users` | `text-warm` |
| `roster_left` | `UserMinus` | `text-muted-foreground` |

**`src/app/(foster)/foster/notifications/page.tsx`** and **`src/app/(shelter)/shelter/notifications/page.tsx`**

Both pages follow the same server component pattern:

1. `createClient()` + `getUser()` with the standard error handling pattern.
2. Fetch notifications: `.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50)`.
3. Pass results to a shared client component `NotificationsList` (`src/components/notifications/notifications-list.tsx`).

Loading skeleton: `src/app/(foster)/foster/notifications/loading.tsx` and `src/app/(shelter)/shelter/notifications/loading.tsx` — a simple list of `Skeleton` rows.

**`src/components/notifications/notifications-list.tsx`** — Shared client component

Props: `{ notifications: Notification[], portal: 'foster' | 'shelter' }`

Renders:
- **"Mark all as read" button** at the top (visible only if any notification is unread). On click: calls `PATCH /api/notifications/read` with `{ all: true }`, updates local state.
- **Grouped list** — group notifications by date into buckets: "Today", "Yesterday", "This Week", "Earlier". Use `formatDate` / `formatRelativeTime` from `@/lib/helpers.ts` for grouping and display.
- Each notification row: same visual structure as the Popover rows (type icon, title, body, timestamp, unread indicator). Clicking marks it read + navigates to `n.link`.
- **Empty state:** `<EmptyState illustration="notifications" message="You're all caught up" />` — add `'notifications'` to the `EmptyState` illustration vocabulary if it doesn't already exist (a `Bell` icon from lucide is sufficient).

---

#### Files to Modify

**`src/components/portal-sidebar.tsx`** (or wherever the desktop sidebar renders `NavLinks` and `PortalSidebarUser`)

Add `<NotificationBell initialCount={unreadNotifications} portal={portal} />` between the `NavLinks` section and the `PortalSidebarUser` section. The `unreadNotifications` value comes from the layout's `getPortalLayoutData()` return, which was updated in Step 48.

The `portal` prop is determined by which layout is rendering: `'foster'` in `(foster)/layout.tsx`, `'shelter'` in `(shelter)/layout.tsx`.

**`src/components/portal-nav.tsx`** — MobileNav

Add the same `<NotificationBell>` to the mobile `Sheet` content — place it between the nav links and the sign-out section.

**`src/components/portal-nav.tsx`** — `FOSTER_NAV` and `SHELTER_NAV` arrays

Add a Notifications nav entry to each array so the page is also reachable via the sidebar:

```ts
// FOSTER_NAV — add after Messages:
{ href: '/foster/notifications', label: 'Notifications', icon: Bell }

// SHELTER_NAV — add after Messages:
{ href: '/shelter/notifications', label: 'Notifications', icon: Bell }
```

Import `Bell` from `lucide-react`. This gives the notifications page a persistent sidebar link, complementing the bell-icon dropdown.

---

#### Pitfalls

- The `NotificationBell` Popover fetches notifications on open, not on mount. Do NOT fetch in a `useEffect` with no dependency — this would fire on every render. Fetch inside the Popover's `onOpenChange` handler, guarded by `if (open && notifications.length === 0)` so it only fetches once per mount.
- The `count` badge decrements locally when a notification is clicked or all are marked read. It does NOT re-fetch from the server — the user expects the count to drop immediately. On the next full page load, `getPortalLayoutData` will return the correct fresh count from the DB.
- The Popover does NOT subscribe to Supabase Realtime. New notifications will not appear in an already-open Popover without a page refresh. This is acceptable for the pilot — add Realtime subscription as a post-pilot improvement.
- The `/foster/notifications` and `/shelter/notifications` pages are new routes. Add them to `src/app/robots.ts` disallow list (they are authenticated pages, should not be indexed):
  ```ts
  // In the existing disallows array, add:
  '/foster/notifications',
  '/shelter/notifications',
  ```
- When adding `'notifications'` to the `EmptyState` illustration vocabulary, follow the exact same pattern as the other seven glyphs (`paw`, `dog`, `messages`, etc.) in `src/components/empty-state.tsx`. Use `Bell` from lucide at `h-12 w-12 opacity-40`.

---

#### Verification

1. Log in to both portals. Navigate to `/foster/notifications` and `/shelter/notifications`. Both pages render without errors and show an empty state if no notifications exist.
2. Trigger the application submitted flow (submit an application as a foster). Without refreshing, open the shelter portal in another tab. Confirm the bell badge shows a non-zero count.
3. Click the bell icon. Confirm the Popover opens with the notification listed.
4. Click the notification. Confirm it navigates to the correct link and the notification is now shown as read (no dot/tint).
5. Click "Mark all as read." Confirm the badge disappears and all rows lose the unread indicator.
6. Navigate to `/shelter/notifications`. Confirm the full list renders with correct grouping (Today / Yesterday / etc.).
7. Notifications sidebar nav item is visible and active when on the notifications page.
8. Type check passes. Build passes.

**Commit:** `feat: notification center UI — bell dropdown and notifications page (§49)`

---

## Post-Pilot Backlog

> Do not implement any of these items during the pilot phase without explicit instruction. They are documented here for planning purposes only. When the time comes, each item should be specced as a full numbered step following the same format as Steps 46–49 above.

| Priority | Item | Source | Notes |
|---|---|---|---|
| High | CI/CD pipeline (GitHub Actions → Vercel) | §15 | Automate test + build on every PR. Wire `npm test` + `tsc --noEmit` as required checks. |
| High | Geocoding pipeline for real addresses | §22 deferred log | Distance filter works with seeded coordinates but not real shelter/foster addresses. Requires a Mapbox or Google Geocoding API call at onboarding time. |
| High | Supabase auth rate limits audit | Phase 3 deferred log | Review `auth.rate_limit.*` settings in Supabase dashboard. Document and set explicitly before public growth. |
| High | New-message email notification (debounced) | §12 deferred log | Currently skipped. Add per-thread 15-minute debounce before re-enabling Resend trigger on message send. |
| Medium | Saved dogs / favorites | §6.5 | `dog_saves` table, heart icon on dog detail, saved list in foster nav. |
| Medium | Shelter verification workflow | §22 | Admin review queue for `is_verified`. Currently set manually via SQL (OPS-5). Needs an admin interface or a request + email flow. |
| Medium | Error tracking for client-side analytics | Remaining Items | PostHog or Mixpanel. Wire after pilot to understand usage patterns. |
| Medium | Application audit trail / soft-delete | Remaining Items deferred log | Hard `DELETE` on withdrawal loses history. Add `withdrawn_at` column and swap to soft delete for dispute handling. |
| Medium | `og:image` for dog share links | §6.3 deferred log | `ShareButton` works but shared links preview without an image. Blocked on dog photo being required. |
| Medium | Dynamic sitemap entries for `/shelters/[slug]` and `/foster/dog/[id]` | §6.1 deferred log | Currently `sitemap.ts` only emits public static routes. |
| Medium | Photo drag-and-drop reorder in `DogForm` | §2 deferred log | Dog thumbnails render in insertion order; first photo is used for browse card. No reorder UI. |
| Medium | Orphaned storage objects cleanup | §19 deferred log | Avatar/logo/dog photos remain in Supabase Storage after account deletion. Add explicit `storage.from().remove()` pass in `DELETE /api/account/delete`. |
| Low | Mutual reporting (foster ↔ shelter) | §6.4 | `reports` table, structured form, email triage queue. Requires product/legal alignment on categories and moderation flow. |
| Low | Map view of shelters in radius | §6.6 | Blocked on geocoding pipeline (High item above). Add map component after geocoding is production-ready. |
| Low | Multi-staff shelter access | §23 | `shelter_members` join table, invitation flow, owner/staff roles. Significant scope — defer until pilot feedback confirms demand. |
| Low | Herds — shelter emergency groups | §6.2 deferred log | Broadcast/group chat for shelter rosters. Schema is forward-compatible (composite PK on `shelter_fosters`). |
| Low | SMS invite path for roster invites | §6.2 deferred log | Currently email-only. Requires Twilio integration and `phone` column on `shelter_foster_invites`. |
| Low | Print stylesheet QA on real hardware | §6 Phase 5-b | Print CSS shipped but only tested in Chrome devtools. Validate on a real printer before advertising printable records. |
| Low | `terms_accepted_at` persistence | §21 deferred log | Signup checkbox exists but acceptance timestamp is not stored. Needs a migration before legal defensibility matters. |
| Low | Session expiry graceful handling | §13 | Graceful refresh/redirect on expired tokens beyond the existing layout-level auth check. |
| Low | CSRF protection audit | §13 | Evaluate necessity with Supabase auth pattern. Low risk today; revisit at scale. |
| Low | Redis-backed rate limiting | §30 deferred log | In-memory rate limit doesn't survive serverless restarts or multi-region. Swap for Upstash Redis when deploying at scale. |
| Low | Error boundary keyboard accessibility | §6 Phase 5-b | Collapsed sidebar keyboard nav not fully tested. Confirm arrow-key focus order on toggle. |
| Low | Social media links in public footer | §38 deferred log | `public-footer.tsx` has only a Mail icon. Add Instagram/Twitter/LinkedIn once real handles exist. |
| Low | Hero photo commission | §37 deferred log | Current hero uses a licensed Unsplash URL (`photo-1583337130417-3346a1be7dee`). Replace with owned/licensed asset before broad public launch. |
| Low | Note edit/delete in shelter roster | §6.2 deferred log | `shelter_foster_notes` has `updated_at` trigger. Just needs a PUT/DELETE route and UI. |
| Low | Ghost-invite TTL / expiry | §6.2 deferred log | Pending invites never expire. Add cron job or TTL column when invite list gets noisy. |

---

## Deferred Follow-ups Log (continued from `roadmap.md`)

> Append new deferred items here as Steps 46–49 are implemented. Follow the same format as `roadmap.md`'s Deferred Follow-ups Log.

| Date | From | Deferred item | To | Notes |
|---|---|---|---|---|
| — | Step 46 | `applicationCreateSchema` should be extracted to `src/lib/schemas.ts` and imported by both the API route and the dialog component | Step 46 implementation | Do not duplicate the schema. |
| — | Step 48 | `POST /api/messages` changes the client-side message-send path. `MessageThread`'s Realtime subscription (Step 17) is unchanged — it listens for DB-level `INSERT` on `messages`, which still fires regardless of whether the insert was made via the old client path or the new API route. | n/a — intentional, no action needed | Documented to prevent confusion. |
| — | Step 49 | `NotificationBell` does not subscribe to Realtime — the bell count only updates on full page load. | Post-pilot | Add `postgres_changes` subscription on `notifications` where `user_id = auth.uid()` to update the badge in real time. Pattern is identical to the Realtime subscription in `MessageThread`. |
| — | Step 49 | `/foster/notifications` and `/shelter/notifications` are not paginated — query is capped at 50 rows. | Post-pilot | Add cursor-based pagination with a "Load more" button once the pilot generates enough notification volume to need it. |
