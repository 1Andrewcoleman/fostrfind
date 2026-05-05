# Agent Handoff · 2026-04-18

Written for the next agent picking up this project. **Read this before doing anything else** — the roadmap and CLAUDE.md tell you *what* to build; this tells you *what I learned by building it* that those files don't mention.

**Session covered:** Phase 1 Steps 1–12 complete (12/12 ✅). Plus demo tooling, RLS fixes, and a few pre-existing bug fixes discovered along the way.
**Repo state at handoff:** branch `claude/angry-wilbur` at commit `5e7a242` (last feat commit). Worktree clean. Main is 1 commit ahead of `origin/main` (the original roadmap/TODO add from session start). Nothing pushed this session.

---

## Environment quirks

- **The worktree has its own `node_modules`** from when Step 1 removed `pg` and re-ran `npm install` inside it. This creates an ESLint plugin-duplication conflict with the parent repo's `node_modules` (both define `@next/next`). **Do not run raw `eslint`** — use `node node_modules/next/dist/bin/next lint` instead, or skip lint entirely and rely on `tsc --noEmit`. The parent repo's working tree is on `main`; don't switch either tree's branch without thinking.

- **`.env.local` in the worktree is a symlink** to `../../../.env.local` (the main repo's). Created during the Option A setup. Do not `rm` it, do not replace with a copy. If you need to add an env var, edit the main repo's file once and both see it.

- **Node 25 breaks `npx`**. Run binaries directly: `node node_modules/<pkg>/dist/bin/<bin>`. This is documented in `CLAUDE.md` but it's easy to forget mid-step.

- **Supabase project has "Confirm email" turned OFF**. Every `signUp()` creates a user with `email_confirmed_at` already populated. This means Step 7's verify-email interstitial *works correctly* but never lingers visibly — it redirects immediately. **Don't treat fast redirects as a bug.** If you want to actually SEE the interstitial in preview, temporarily flip "Confirm email" ON in the Resend dashboard.

- **Master dev accounts use `.local` emails** (`dev-shelter@fostrfind.local` / `dev-foster@fostrfind.local`). These are invalid at the DNS level. Resend will REJECT these if you try to send real emails with a real API key — you'll get `Email address "dev-shelter@fostrfind.local" is invalid` in the server logs, and the UI will show the account-enumeration-safe generic success state. **If you need real end-to-end email testing, either:** (a) ask the user for Option B (add `DEV_OVERRIDE_EMAIL` rewriter), (b) re-run `scripts/setup-master-accounts.mjs` with real email addresses, or (c) verify a real sending domain in Resend and change the master emails.

- **Preview server auto-started as ID `796aa878-5f08-4142-83e8-db17b93703f6`** during Step 8 when I whitelisted Supabase hostnames in `next.config.mjs`. Still running at end of session. Ok to reuse; restart only if you change `next.config.mjs` again.

---

## Codebase patterns not in the roadmap

- **Supabase nested-join TypeScript is wrong at runtime.** Supabase's type-gen models `select('*, foster:foster_parents(...)')` as returning `foster: {...}[]` (array). At runtime, PostgREST returns a single object for one-to-one FKs. When TS squawks, use `as unknown as CompletedAppRow[]` with a comment. Prior-art patterns to copy:
  - `src/app/(shelter)/shelter/dogs/page.tsx` — full comment explaining the tradeoff
  - All four API routes under `src/app/api/applications/[id]/` — narrow row interfaces like `AcceptedApplicationRow`, `DeclinedApplicationRow`, `CompletedApplicationRow` that match runtime shape

- **Client-side auth guards, not server-side.** `/onboarding`, `/auth/verify-email`, `/foster/dashboard` (actually server-rendered but Step 2's greeting helper is server too) — these gate their content with `useEffect` + `useState('checking')` + spinner rather than server `redirect()`. The roadmap's Step 7 pitfall says "use server-side redirect" — that's NOT compatible with the existing client components that hold useState. **Don't refactor unless the user explicitly asks.** The ~200ms spinner flash is acceptable.

- **`ApplicationStatusCard` has defensive null-safety** for nested joins (`application.dog?.name ?? 'Unknown dog'`, `application.shelter?.name ?? 'Unknown shelter'`). Added during Step 9's RLS discovery. Do not remove — even with the RLS fix in place, this is defense-in-depth and prevents future RLS regressions from crashing pages.

- **Supabase JS client in Next.js App Router** is different client-vs-server:
  - Client Components → `import { createClient } from '@/lib/supabase/client'`
  - Server Components / API Routes → `import { createClient } from '@/lib/supabase/server'` (async!)
  - Admin / scripts → raw `createClient(url, SERVICE_ROLE_KEY, { auth: { persistSession: false } })`
  - Never mix. Never import the server client from a `'use client'` bundle.

- **Resend SDK can't be imported into client bundles.** The only server-side entry point for email sends is `sendEmail()` from `@/lib/email`. Client-side triggers (like the apply button on `/foster/dog/[id]`) must go through `POST /api/notifications/send` instead. This is why that route exists and is auth-gated even though all the API-route-side trigger points import sendEmail directly.

- **Fire-and-forget pattern for all trigger-point emails.** Every email send is `void sendEmail({...})` with no `await`. An email outage must never fail a user action. `sendEmail` swallows its own errors and logs them — it never throws.

- **The `applications` table has NO `UNIQUE(dog_id, foster_id)` constraint.** Dog detail page does a client-side duplicate check that races. §25 of the roadmap is the scheduled fix.

- **The `foster_parents` and `shelters` tables have NO `UNIQUE(user_id)` constraints.** I discovered this the hard way in Step 10 when `upsert({...}, { onConflict: 'user_id' })` in the foster profile form was silently failing with `42P10`. I swapped the upsert to `.update().eq('user_id', ...)` as an immediate fix, and extended §25's scope to add both constraints. **Anywhere you see `.upsert(..., { onConflict: 'user_id' })` in new code, pause** — it will fail until §25 lands. Prefer `.update()` when the row is guaranteed to exist (i.e., the page rendered past `RoleGuard`).

- **Hard navigations after auth state changes.** `window.location.href = ...` not `router.push(...)` after anything that changes session cookies. This is already in CLAUDE.md but worth reinforcing — I broke this once during my signup refactor (Step 7) and had to re-fix.

---

## Dev tooling assets (new this session)

Everything is at `scripts/` or `supabase/migrations/`:

| File | Purpose | Idempotent? |
|---|---|---|
| `scripts/setup-master-accounts.mjs` | Creates two master auth users via Admin API, auto-confirms emails, inserts shelter/foster profile rows, appends creds to `.env.local` | Yes. Safe to re-run; skips existing users. |
| `scripts/seed-demo-data.mjs` | 12 dogs / 6 applications / 10 messages / 1 rating, all attached to the master accounts | No-op if dogs already exist; **`--reset` wipes + reseeds**. Safety-guarded by shelter email match so it can't nuke production. |
| `supabase/migrations/20240105000000_shelters_public_read.sql` | Adds 2 RLS policies: public shelter read + foster-can-read-applied-dogs. **Already applied to the dev Supabase.** | Creating a policy that exists will error — don't re-apply. |
| `supabase/migrations/20240112000000_storage_buckets.sql` | Creates 3 storage buckets + 3 RLS policies (public read, auth upload, owner delete). **Already applied.** | `INSERT ... ON CONFLICT DO NOTHING` on buckets; CREATE POLICY will error if re-run. |

**Credentials in `.env.local`** (under `DEV_MASTER_*_EMAIL` / `DEV_MASTER_*_PASSWORD`). Passwords are 24-char base64url strings generated at first `setup-master-accounts.mjs` run. Keep them there; the seed script reads them.

---

## Preview verification quirks

- **File inputs can't be filled with `preview_fill`.** Use this pattern via `preview_eval`:
  ```js
  const file = new File([bin], 'name.png', { type: 'image/png' })
  const dt = new DataTransfer()
  dt.items.add(file)
  input.files = dt.files
  input.dispatchEvent(new Event('change', { bubbles: true }))
  ```

- **Radix tab clicks** sometimes don't register via `preview_eval .click()`. Use `preview_click` with the real CSS selector (`button[role="tab"]:nth-of-type(2)`) or dispatch a full `pointerdown`/`mouseup` sequence.

- **Sign-out via the UI sidebar button is flaky under automation** — the sheet animation races with the async handler. Workaround that always works:
  ```js
  document.cookie.split(';').forEach(c => {
    const eq = c.indexOf('=')
    const name = (eq > -1 ? c.substr(0, eq) : c).trim()
    if (name.startsWith('sb-')) document.cookie = name + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
  })
  window.location.href = '/login'
  ```

- **`next.config.mjs` requires a server restart**, not just a reload. Next.js reads it once at boot. `preview_stop` + `preview_start` is the workflow.

- **The preview's session is HTTP-only cookies, not client-accessible beyond `sb-*` name prefix clearing**. If you need to verify something from a specific user's perspective, actually sign them in via the login form.

- **Small test images (1×1 PNG)** may silently skip the `resizeImageForUpload` canvas pipeline because the resulting JPEG blob is empty. Not a bug — the helper falls back to the original file. For visible "resize actually did something" proof, use a larger image.

---

## Workflow conventions adopted this session

**The user called these out explicitly; follow them strictly going forward.**

1. **One step at a time.** Never batch multiple roadmap steps in one commit. Execute, verify, commit, await go-ahead for the next step.

2. **Plain-language summaries.** After every `feat:` commit, the user wants a post-commit message that explains what a real user would see/notice, not just a technical diff. Keep it short (3-6 short paragraphs) + a verification evidence block.

3. **Deferred Follow-ups Log discipline.** When a step defers something (rate limiting, Zod validation, error sanitization, etc.) the commit MUST:
   - Append a row to the "Deferred Follow-ups Log" at the bottom of `docs/roadmap.md` with date + source step + target hardening step + 1-sentence rationale.
   - Expand the target hardening step's scope list with the specific files/routes introduced. E.g., Step 30 (rate limiting) has an explicit route roster; when I added a new API route I added it to that roster.
   - Cite the "added-scope from Step N deferral" marker so future-you can trace provenance.

   This was NOT done for Steps 2–6. The docs commit `5ed09e1` retroactively fixed them. Don't let it drift again.

4. **Commit messages are multi-paragraph.** Subject line + 2-4 paragraphs of rationale + an explicit verification evidence block. Look at `5e7a242` as the reference shape. The user has never asked me to shorten one; they've complimented the thoroughness.

5. **Risky-action confirmation.** Things that mutate the user's real Supabase project, touch git config, push to origin, or apply migrations get a confirm-first stance. The user is doing migration applies manually via the SQL Editor (I gave them the SQL block). I am NOT to attempt DDL via PostgREST.

---

## Decisions and defaults locked in this session

- **Resend:** user has chosen **Option A** (skip real key, stay in mock/console mode). `RESEND_API_KEY=your_resend_api_key_here` stays as-is. `sendEmail()` console-logs `[email] (mock) "subject" → to`.

- **Image resize:** client-side only (Canvas via `createImageBitmap`), no server-side `sharp`. The user hasn't objected. Keep this boundary.

- **Email templates:** plain React + inline styles, **no `@react-email/components`**. Bundle size and portability wins over Ergonomics. Don't introduce it.

- **Foster avatar / shelter logo storage:** path convention is `{userId}/{uuid}.{ext}`. Uploading a new one orphans the old storage object; the form only updates the DB column. Intentional — storage GC is a separate TODO.md §12 item. Don't add aggressive cleanup to the forms.

- **Signout quirk:** user flagged but did NOT ask me to fix the sidebar sign-out race. Leave it.

- **Git identity:** commits are authored as `andrewlovellecoleman@Andrews-MacBook-Pro.local` (hostname-derived). User declined to fix. Don't touch git config.

---

## Things you might want to do in a future session

Unprompted, in priority order if the user opens-ended asks "what's next":

1. **Push to origin.** `main` is 1 commit ahead. `claude/angry-wilbur` is ~15 commits ahead. Offer to push; never force-push without explicit approval.

2. **Phase 2 Step 13 (text search on browse)** is the smallest and most satisfying next feature — 1–1.5 hr estimated.

3. **Phase 3 hardening before more features.** Lots of deferrals piled up in the Follow-ups Log. The user's been clear they care about this category; might prefer it to adding more surface area.

4. **Address the Resend `.local` email problem** if the user ever wants to actually send emails. Options documented in earlier chat.

5. **Consider consolidating the ESLint situation** — worktree's `node_modules` was installed involuntarily during Step 1. If the user wants clean lint, either delete the worktree's `node_modules` (and run tools from the parent) or hoist the ESLint config.

---

## What NOT to touch

- Don't re-run `npm install` inside the worktree unless you have a specific reason. It re-creates the ESLint conflict.
- Don't apply the 20240105 or 20240112 migrations again — already applied remotely. The SQL files live in `supabase/migrations/` for repo-as-source-of-truth, but Supabase's remote doesn't track migration file presence.
- Don't modify the master-account passwords in `.env.local`. The seed script re-reads them.
- Don't delete `.serena/` (ignored; some AI tool's cache).
- Don't try to DDL from PostgREST with the service role key — it doesn't work. Migrations go through the dashboard SQL editor or `supabase db push`.
