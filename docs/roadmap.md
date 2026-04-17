# Fostr Fix — Master Roadmap

> **For AI agents:** This is the single source of truth for platform development. When asked to "pick up where you left off," find the first unchecked `- [ ]` step, read its context, and create a detailed implementation plan for that step. Each step is scoped to one coding session (1–3 hours). Always read [`docs/TODO.md`](./TODO.md) and [`CLAUDE.md`](../CLAUDE.md) before starting any step.

**Goal:** Ship Fostr Fix from current MVP state to production-ready platform.

**Current state:** Core flows work (onboarding, dog CRUD, browse, applications, messaging, ratings, dashboards). Missing: several features, hardening, infrastructure, and polish.

**Ordering:** Feature-complete first → Hardening → Infrastructure → Polish.

**How to use this file:**
1. Find the first unchecked step below
2. Read the step's full context (files, pitfalls, verification)
3. Implement it completely — no skeletons, no stubs
4. Check the box when done
5. Commit with the suggested message format

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
- **No TODO comments in new code.** If something can't be done in this step, it belongs in the roadmap or `TODO.md` — not in a code comment that will be forgotten. The only acceptable TODO is a reference to a specific future step: `// Wired in Step 17 (Realtime)`.
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

---

## Phase 1: Core Feature Gaps

> These are missing features that users will immediately notice. Builds out the remaining functionality before hardening.

---

### Step 1: Quick Wins — Centralize DEV_MODE + Remove Dead Dependency
**TODO ref:** [§26 YELLOW](./TODO.md#26-pre-launch-hardening)
**Estimated time:** 30–45 minutes

**Why first:** Every subsequent step touches files that duplicate the DEV_MODE constant. Centralizing it now prevents merge conflicts and drift for all future work.

**Files to modify:**
- `src/lib/constants.ts` — add `DEV_MODE` export
- ~24 files that define `const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')` inline — replace with import
- `package.json` — remove `pg` dependency

**How to find all DEV_MODE definitions:**
```bash
grep -rn "const DEV_MODE" src/
```

**Implementation:**
1. Add to `src/lib/constants.ts`:
   ```ts
   export const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')
   ```
2. In every file found by the grep, replace the inline definition with:
   ```ts
   import { DEV_MODE } from '@/lib/constants'
   ```
3. Remove `"pg": "..."` from `package.json` dependencies
4. Run `npm install` to update lockfile

**Pitfalls:**
- Some files use `DEV_MODE` at module scope (top-level `const`). The import must also be top-level — this is fine for Next.js since `process.env.NEXT_PUBLIC_*` is inlined at build time.
- Don't accidentally remove the DEV_MODE check in `src/lib/supabase/middleware.ts` — it uses the same pattern but inside the `updateSession` function. Refactor it to import from constants too.

**Verification:**
```bash
# Confirm no remaining inline definitions
grep -rn "const DEV_MODE" src/
# Should return 0 results

# Type check
node node_modules/typescript/bin/tsc --noEmit

# Dev server still works
node node_modules/next/dist/bin/next dev
```

**Commit:** `refactor: centralize DEV_MODE constant, remove unused pg dep`

---

### Step 2: Foster Dashboard
**TODO ref:** [§17 — Foster Dashboard](./TODO.md#17-foster-dashboard)
**Estimated time:** 1.5–2 hours

**Why now:** Fosters currently land on `/foster/browse` after login. A dashboard gives them a home base with stats and quick actions, mirroring the shelter dashboard.

**Files to create:**
- `src/app/(foster)/foster/dashboard/page.tsx` — server component, fetches stats
- `src/app/(foster)/foster/dashboard/loading.tsx` — skeleton loader

**Files to modify:**
- `src/components/portal-nav.tsx` — add Dashboard to `FOSTER_NAV` array (insert as first item)
- `src/lib/auth-routing.ts` — change foster destination from `/foster/browse` to `/foster/dashboard`

**Pattern to follow:** Mirror `src/app/(shelter)/shelter/dashboard/page.tsx` exactly. That page:
1. Gets user via `createClient()` + `getUser()`
2. Fetches shelter row by `user_id`
3. Runs parallel queries: active dog count, pending app count, unread messages, recent applications
4. Renders greeting + stat cards + recent applications list

**For the foster dashboard, fetch:**
- Active applications count (`status IN ('submitted', 'reviewing', 'accepted')`)
- Current fostering count (`status = 'accepted'` — dogs currently placed with this foster)
- Unread messages count (same pattern as shelter dashboard)
- Recent applications (last 5, joined with `dogs` + `shelters`)

**Stat cards layout** (use the same warm icon-pill pattern from shelter dashboard):
- "Active Applications" — `FileText` icon, amber pill
- "Currently Fostering" — `Heart` icon, green pill
- "Unread Messages" — `MessageCircle` icon, blue pill

**Greeting:** "Good [morning/afternoon/evening], [first_name]" — same `getTimeOfDay()` helper as shelter dashboard.

**Nav change in `portal-nav.tsx`:**
```ts
// FOSTER_NAV — add as FIRST item:
{ href: '/foster/dashboard', label: 'Dashboard', icon: LayoutDashboard },
```
Import `LayoutDashboard` from `lucide-react`.

**Auth routing change in `src/lib/auth-routing.ts`:**
```ts
// Change:
if (foster) return '/foster/browse'
// To:
if (foster) return '/foster/dashboard'
```

**Loading skeleton (`loading.tsx`):** Copy structure from `src/app/(shelter)/shelter/dashboard/loading.tsx` — three `Skeleton` cards + a list of `Skeleton` rows.

**Pitfalls:**
- The foster `RoleGuard` in `src/app/(foster)/layout.tsx` already protects all routes under `(foster)/`. No additional auth needed on the dashboard page itself.
- The unread message count query must use `sender_role != 'foster'` (count messages FROM shelters that are unread). The shelter dashboard uses `sender_role != 'shelter'`. Don't copy-paste without flipping this.
- The greeting helper `getTimeOfDay()` is defined inside the shelter dashboard page, not extracted. Either extract it to `src/lib/helpers.ts` or redefine it in the foster dashboard. Extracting is better — do that.

**Verification:**
1. Start dev server, navigate to `/foster/dashboard`
2. In DEV_MODE, verify greeting shows, stat cards render with 0 counts, recent applications section shows empty state
3. Verify nav sidebar shows "Dashboard" as first item with active state when on `/foster/dashboard`
4. Verify `/foster/browse` still works and is accessible from nav
5. Type check passes

**Commit:** `feat: add foster dashboard with stats and recent applications (§17)`

---

### Step 3: Application Workflow — "Mark as Reviewing" + Foster Withdrawal
**TODO ref:** [§18 — Application Workflow Gaps](./TODO.md#18-application-workflow-gaps) (first two items)
**Estimated time:** 2–2.5 hours

**What this adds:**
1. Shelter can move an application from `submitted` → `reviewing`
2. Foster can withdraw a `submitted` or `reviewing` application

**Files to create:**
- `src/app/api/applications/[id]/review/route.ts` — POST handler for reviewing transition
- `src/app/api/applications/[id]/withdraw/route.ts` — POST handler for foster withdrawal

**Files to modify:**
- `src/components/shelter/accept-decline-buttons.tsx` — add "Mark as Reviewing" button when status is `submitted`
- `src/components/foster/application-status-card.tsx` — add "Withdraw" button when status is `submitted` or `reviewing`

**API route pattern — `/api/applications/[id]/review/route.ts`:**
Follow the exact same pattern as `accept/route.ts`:
1. `createClient()` + `getUser()` — 401 if no user
2. Fetch application with `.select('*, shelter:shelters!inner(user_id)')` — 404 if not found
3. Verify `shelter.user_id === user.id` — 403 if not owner
4. Idempotency: if already `reviewing`, return 200 (not error)
5. Guard: only allow if current status is `submitted`
6. Update `status` to `reviewing` — no dog status change needed
7. Return updated application

**API route — `/api/applications/[id]/withdraw/route.ts`:**
Different auth pattern — this is the FOSTER's action:
1. `createClient()` + `getUser()` — 401 if no user
2. Fetch application with `.select('*, foster:foster_parents!inner(user_id)')` — 404 if not found
3. Verify `foster.user_id === user.id` — 403 if not the applicant
4. Guard: only allow if status is `submitted` or `reviewing` — 409 otherwise
5. Delete the application row (or set status to `withdrawn` — prefer DELETE since the application hasn't progressed)
6. Return 200

**UI — "Mark as Reviewing" button:**
In `accept-decline-buttons.tsx`, the current code shows Accept + Decline when status is `submitted` or `reviewing`. Add a third button **only when status is `submitted`**:
```tsx
{application.status === 'submitted' && (
  <Button variant="outline" onClick={handleReview} disabled={loading}>
    {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
    Mark as Reviewing
  </Button>
)}
```
The handler calls `fetch(`/api/applications/${application.id}/review`, { method: 'POST' })`, then `router.refresh()`.

**UI — "Withdraw Application" button:**
In `application-status-card.tsx`, add a button when status is `submitted` or `reviewing`:
```tsx
{['submitted', 'reviewing'].includes(application.status) && (
  <AlertDialog>
    {/* Confirmation: "Are you sure you want to withdraw your application for {dog.name}?" */}
    {/* On confirm: fetch(`/api/applications/${application.id}/withdraw`, { method: 'POST' }) */}
    {/* On success: toast.success('Application withdrawn') + router.refresh() */}
  </AlertDialog>
)}
```
Use `AlertDialog` for confirmation (same pattern as delete dog).

**Pitfalls:**
- The `StatusBadge` component in `src/components/status-badge.tsx` already handles the `reviewing` status with amber color + Eye icon. No changes needed there.
- The `application-status-card.tsx` imports — make sure to import `AlertDialog` components and `Loader2`.
- When withdrawing, if the dog was moved to `pending` (application was accepted), withdrawal should NOT be allowed — the guard `status IN ('submitted', 'reviewing')` handles this.
- After withdrawal (DELETE), the foster's applications list will automatically exclude it on next fetch. No client-side state cleanup needed beyond `router.refresh()`.

**Verification:**
1. Shelter: view a submitted application → "Mark as Reviewing" button visible → click → status changes to "Reviewing" → Accept/Decline still available
2. Foster: view submitted application → "Withdraw" button visible → click → confirmation dialog → confirm → application removed from list
3. Foster: view accepted application → "Withdraw" button NOT visible
4. Type check passes

**Commit:** `feat: add reviewing status transition and foster withdrawal (§18)`

---

### Step 4: Application Workflow — Message Links from Application Pages
**TODO ref:** [§18 — Application Workflow Gaps](./TODO.md#18-application-workflow-gaps) (third item)
**Estimated time:** 45 minutes–1 hour

**What this adds:** Direct "Message" button/link on application pages so users can jump to the message thread without navigating through the messages list.

**Files to modify:**
- `src/components/foster/application-status-card.tsx` — add message link for accepted/completed applications
- `src/app/(shelter)/shelter/applications/[id]/page.tsx` — add message link in the application detail header

**Foster side — `application-status-card.tsx`:**
The card already shows a "Messages" link when `status === 'accepted'` (line ~60). Extend to also show for `completed`:
```tsx
{['accepted', 'completed'].includes(application.status) && (
  <Link href={`/foster/messages/${application.id}`} className="...">
    <MessageCircle className="h-4 w-4 mr-1" />
    Messages
  </Link>
)}
```

**Shelter side — application detail page:**
In the header area (near the status badge and action buttons), add:
```tsx
{['accepted', 'completed'].includes(application.status) && (
  <Button variant="outline" asChild>
    <Link href={`/shelter/messages/${application.id}`}>
      <MessageCircle className="h-4 w-4 mr-2" />
      Message Foster
    </Link>
  </Button>
)}
```

**Pitfalls:**
- Message threads only exist for accepted/completed applications (the message list pages filter by these statuses). Do NOT show message links for submitted/reviewing/declined applications — there's no thread to navigate to.
- The thread page at `/foster/messages/[applicationId]` and `/shelter/messages/[applicationId]` will create the thread on first message send, so linking to it when no messages exist is fine — the empty state handles it.

**Verification:**
1. Foster: accepted application card shows "Messages" link → clicking navigates to thread
2. Shelter: application detail page for accepted app shows "Message Foster" button → navigates to thread
3. Declined/submitted applications do NOT show message links
4. Type check passes

**Commit:** `feat: add message links on application pages (§18)`

---

### Step 5: Dog Management — Status Override + Placed Dogs History
**TODO ref:** [§19 — Dog & Shelter Management Gaps](./TODO.md#19-dog--shelter-management-gaps)
**Estimated time:** 2–2.5 hours

**What this adds:**
1. Shelter can manually reset a dog from `pending` back to `available` (e.g., foster backed out)
2. Shelter dogs page shows a "Placed" tab with completed placements

**Files to create:**
- `src/app/api/dogs/[id]/status/route.ts` — PATCH handler for status override

**Files to modify:**
- `src/app/(shelter)/shelter/dogs/[id]/page.tsx` — add status dropdown/control on edit page
- `src/app/(shelter)/shelter/dogs/page.tsx` — add tabs for "Active" vs "Placed" dogs

**API route — `/api/dogs/[id]/status/route.ts`:**
```
PATCH /api/dogs/[id]/status
Body: { status: 'available' }
```
1. Auth + shelter ownership check (same pattern as DELETE route)
2. Only allow transition `pending → available` (not arbitrary status changes)
3. When resetting to `available`, also decline any `accepted` application for this dog (the placement fell through)
4. Return updated dog

**Status control on edit dog page:**
Add a section above `DogForm` that shows current status and, if `pending`, offers a "Re-list as Available" button:
```tsx
{dog.status === 'pending' && (
  <Card className="mb-6 border-amber-200 bg-amber-50">
    <CardContent className="flex items-center justify-between py-4">
      <div>
        <p className="font-medium">This dog is currently pending placement</p>
        <p className="text-sm text-muted-foreground">If the placement fell through, you can re-list this dog</p>
      </div>
      <Button variant="outline" onClick={handleRelist}>Re-list as Available</Button>
    </CardContent>
  </Card>
)}
```

**Placed dogs tab on `/shelter/dogs`:**
Currently this page fetches dogs with no status filter. Modify to:
1. Fetch all dogs for this shelter (not just available)
2. Add `Tabs` component: "Active" (available + pending) and "Placed" (placed + adopted)
3. "Active" tab shows the existing dog cards
4. "Placed" tab shows placed dogs with their completion date and foster name (join with `applications` where `status = 'completed'`)

**Pitfalls:**
- When re-listing a dog, must also handle the associated accepted application. The API should decline it (set status to `declined`) or add a new status like `cancelled`. Using `declined` is simpler and avoids schema changes.
- The `DogCard` component in `src/components/shelter/dog-card.tsx` may not show status currently — verify and add a `StatusBadge` if missing so the shelter knows which dogs are pending vs available.
- The placed dogs query needs a JOIN with applications to get the foster name. Use:
  ```ts
  .select('*, applications!inner(id, status, foster:foster_parents(first_name, last_name))')
  .eq('status', 'placed')
  .eq('applications.status', 'completed')
  ```

**Verification:**
1. Edit page for a `pending` dog shows "Re-list" card → click → dog status resets to `available` → associated application is declined
2. Edit page for an `available` dog does NOT show the re-list card
3. Dogs list page has Active/Placed tabs → Placed tab shows placed dogs with foster name
4. Type check passes

**Commit:** `feat: dog status override and placed dogs history (§19)`

---

### Step 6: Auth — Forgot Password Flow
**TODO ref:** [§16 — Auth Critical Gaps](./TODO.md#16-auth--critical-gaps) (first item)
**Estimated time:** 1.5–2 hours

**What this adds:** "Forgot password?" link on login → email with reset link → reset password page.

**Files to create:**
- `src/app/auth/reset-password/page.tsx` — client component: new password form
- `src/app/auth/forgot-password/page.tsx` — client component: email input to request reset

**Files to modify:**
- `src/app/login/page.tsx` — add "Forgot password?" link

**Flow:**
1. User clicks "Forgot password?" on login → navigates to `/auth/forgot-password`
2. User enters email → calls `supabase.auth.resetPasswordForEmail(email, { redirectTo: '${origin}/auth/reset-password' })`
3. Supabase sends email with magic link
4. User clicks link → redirected to `/auth/reset-password` with token in URL hash
5. Page calls `supabase.auth.onAuthStateChange()` to detect the `PASSWORD_RECOVERY` event
6. User enters new password → calls `supabase.auth.updateUser({ password: newPassword })`
7. Success → redirect to login with toast

**Forgot password page (`/auth/forgot-password/page.tsx`):**
Simple form:
- Email input
- "Send Reset Link" button
- Success state: "Check your email for a password reset link"
- Error state: show generic message (don't reveal if email exists)

**Reset password page (`/auth/reset-password/page.tsx`):**
```tsx
'use client'
// Must be a client component to use onAuthStateChange

// On mount, listen for PASSWORD_RECOVERY event:
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      setCanReset(true)
    }
  })
  return () => subscription.unsubscribe()
}, [])
```
Form:
- New password input (with min length 8 validation)
- Confirm password input
- "Reset Password" button
- On submit: `supabase.auth.updateUser({ password })` → success toast → `window.location.href = '/login'`

**Login page change:**
Add below the password input:
```tsx
<Link href="/auth/forgot-password" className="text-sm text-primary hover:underline">
  Forgot password?
</Link>
```

**Pitfalls:**
- The `redirectTo` URL in `resetPasswordForEmail` must be added to "Redirect URLs" in the Supabase dashboard (Authentication → URL Configuration). Document this in a comment.
- Supabase's magic link includes a hash fragment (`#access_token=...&type=recovery`). The `@supabase/ssr` client handles this automatically when `onAuthStateChange` fires with `PASSWORD_RECOVERY`.
- In DEV_MODE (no real Supabase), the reset flow won't work. Add a DEV_MODE check that shows "Password reset is not available in dev mode" instead of the form.
- Do NOT use `router.push()` after password reset — use `window.location.href = '/login'` for hard navigation (same pattern as signup/login, documented in CLAUDE.md).

**Verification:**
1. Login page shows "Forgot password?" link
2. Clicking it navigates to `/auth/forgot-password`
3. Entering email and submitting shows success message (in DEV_MODE, shows dev mode notice)
4. Reset password page renders the form
5. Type check passes

**Commit:** `feat: forgot password and reset password flow (§16)`

---

### Step 7: Auth — Email Verification Handling
**TODO ref:** [§16 — Auth Critical Gaps](./TODO.md#16-auth--critical-gaps) (second item)
**Estimated time:** 1–1.5 hours

**What this adds:** After signup, show "verify your email" interstitial. Block onboarding until email is confirmed.

**Files to create:**
- `src/app/auth/verify-email/page.tsx` — interstitial page with resend option

**Files to modify:**
- `src/app/signup/page.tsx` — redirect to `/auth/verify-email` instead of `/onboarding`
- `src/app/onboarding/page.tsx` — check `email_confirmed_at` before allowing onboarding
- `src/app/auth/callback/route.ts` — handle email confirmation callback type

**Flow:**
1. User signs up → redirected to `/auth/verify-email` (not `/onboarding`)
2. Interstitial shows: "Check your email to verify your account" + "Resend verification email" button
3. User clicks email link → Supabase confirms email → redirects to `/auth/callback`
4. Callback detects confirmed user → redirects to `/onboarding`

**Signup page change (`src/app/signup/page.tsx`):**
```ts
// Change redirect destination:
// FROM: window.location.href = '/onboarding'
// TO:   window.location.href = '/auth/verify-email'
```

**Verify email page (`/auth/verify-email/page.tsx`):**
- Show email address (pass via query param or retrieve from session)
- "Resend" button: `supabase.auth.resend({ type: 'signup', email })`
- Auto-check: poll `supabase.auth.getUser()` every 5 seconds; if `email_confirmed_at` is set, redirect to `/onboarding`

**Onboarding guard (`src/app/onboarding/page.tsx`):**
Add at the top of the component:
```ts
const { data: { user } } = await supabase.auth.getUser()
if (user && !user.email_confirmed_at) {
  redirect('/auth/verify-email')
}
```

**Pitfalls:**
- Supabase sends confirmation emails automatically on `signUp()` — you don't need to trigger this manually. But the confirmation URL must be in the Supabase dashboard's "Redirect URLs."
- The email confirmation callback comes through `/auth/callback` with `type=signup` (or `type=email`). The existing callback handler already exchanges the code — just make sure `getPostAuthDestination()` works for a user with no shelter/foster profile (returns `/onboarding`).
- In DEV_MODE, skip the email verification check entirely — there's no real auth happening.
- Some users may have signed up before this change was deployed. Their `email_confirmed_at` may be null. Handle this gracefully — don't lock out existing users. Consider only enforcing for new signups (check `created_at` vs deploy date) or run a migration to confirm existing users.

**Verification:**
1. Signup → redirected to `/auth/verify-email` (not onboarding)
2. Verify email page shows message and resend button
3. Direct navigation to `/onboarding` without confirmed email redirects back to verify page
4. In DEV_MODE, signup still goes to onboarding (skip verification)
5. Type check passes

**Commit:** `feat: email verification interstitial after signup (§16)`

---

### Step 8: Photo & File Storage Infrastructure
**TODO ref:** [§12 — Photo & File Storage](./TODO.md#12-photo--file-storage)
**Estimated time:** 2–2.5 hours

**What this adds:** Reusable file upload infrastructure — storage helper, image resize, bucket setup, validation.

**Files to create:**
- `src/lib/storage.ts` — shared upload helper (upload, delete, get public URL)
- `supabase/migrations/20240105000000_storage_buckets.sql` — create buckets + RLS policies

**Files to modify:**
- `src/app/api/upload/photo/route.ts` — replace stub with real implementation
- `next.config.mjs` — add Supabase Storage image domain
- `src/lib/constants.ts` — add storage constants (bucket names, max file size, allowed types)

**Storage helper (`src/lib/storage.ts`):**
```ts
import { SupabaseClient } from '@supabase/supabase-js'

export const STORAGE_BUCKETS = {
  dogPhotos: 'dog-photos',
  shelterLogos: 'shelter-logos',
  fosterAvatars: 'foster-avatars',
} as const

export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

export async function uploadImage(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
  file: File,
): Promise<{ url: string } | { error: string }> {
  // 1. Validate file type and size
  // 2. Upload to Supabase Storage
  // 3. Get public URL
  // 4. Return URL or error
}

export async function deleteImage(
  supabase: SupabaseClient,
  bucket: string,
  path: string,
): Promise<void> {
  // Remove from storage
}
```

**Migration — storage buckets + RLS:**
```sql
-- Create buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('dog-photos', 'dog-photos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('shelter-logos', 'shelter-logos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('foster-avatars', 'foster-avatars', true) ON CONFLICT DO NOTHING;

-- RLS: anyone can read public buckets
CREATE POLICY "Public read" ON storage.objects FOR SELECT USING (bucket_id IN ('dog-photos', 'shelter-logos', 'foster-avatars'));

-- RLS: authenticated users can upload to their relevant bucket
CREATE POLICY "Shelter upload dog photos" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'dog-photos' AND auth.uid() IS NOT NULL);
-- (similar for logos and avatars)

-- RLS: users can delete their own uploads
CREATE POLICY "Owner delete" ON storage.objects FOR DELETE
  USING (auth.uid()::text = (storage.foldername(name))[1]);
```

**Upload API route — replace stub:**
The current stub at `src/app/api/upload/photo/route.ts` returns placeholder JSON. Replace with:
1. Auth check via `createClient()` + `getUser()`
2. Parse `FormData` from request
3. Validate file (type, size)
4. Generate unique path: `{userId}/{uuid}.{ext}`
5. Call `uploadImage()` helper
6. Return `{ url }` or error

**next.config.mjs:**
```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: '*.supabase.in',
      },
    ],
  },
}
export default nextConfig
```

**Pitfalls:**
- Storage bucket creation via SQL migration only works if migrations are applied via `supabase db push` or the SQL editor. Document this clearly in a comment.
- Supabase Storage RLS uses `storage.objects` table, not the app's schema tables. The policy syntax is different from regular table RLS.
- The `storage.foldername(name)` function returns path segments. Using `{userId}/` as the first path segment lets the "Owner delete" policy work by matching `auth.uid()` to the folder name.
- Image resize is NOT included in this step — that's a nice-to-have. Focus on upload + validation + storage only. The `sharp` library would add significant bundle size for server-side resize.
- The `NEXT_PUBLIC_SUPABASE_URL` is needed to construct public URLs. In DEV_MODE there's no real URL, so the upload route should return a placeholder in DEV_MODE.

**Verification:**
1. Type check passes
2. Upload API returns proper error for missing auth, wrong file type, too-large file
3. Upload API successfully uploads a file and returns a valid Supabase Storage URL (requires real Supabase project — skip in DEV_MODE)
4. `next/image` can load images from the Supabase Storage domain

**Commit:** `feat: file storage infrastructure — upload helper, buckets, RLS (§12)`

---

### Step 9: Dog Photo Upload + Preview
**TODO ref:** [§2 items 5-6](./TODO.md#2-dog-crud-shelter-side), [§5 item 2](./TODO.md#5-api-routes)
**Estimated time:** 2–2.5 hours
**Depends on:** Step 8 (storage infrastructure)

**What this adds:** Working photo upload in `DogForm` — select files, preview thumbnails, upload to Supabase Storage, save URLs to dog record.

**Files to modify:**
- `src/components/shelter/dog-form.tsx` — wire file input, preview, upload on save

**Current state of `dog-form.tsx`:**
- Lines 149-164: Disabled upload area with placeholder UI
- Line 163: `{/* TODO: render uploaded photo previews here */}`
- No `<input type="file">` element
- Photos array is in the form schema but always submitted empty

**Implementation:**
1. Add hidden `<input type="file" multiple accept="image/*">` behind the upload area
2. On file select: create `URL.createObjectURL()` previews, store in local state
3. Show thumbnail grid below the upload area (each with an X to remove)
4. On form submit: upload each new file via `fetch('/api/upload/photo', { body: formData })`, collect returned URLs
5. Include URLs in the `photos` array when inserting/updating the dog record
6. For existing dogs: show already-uploaded photos as thumbnails, allow removing (deletes from storage)

**Photo preview component (inline in `dog-form.tsx` or extract):**
```tsx
<div className="grid grid-cols-4 gap-2 mt-3">
  {previews.map((preview, i) => (
    <div key={i} className="relative aspect-square rounded-lg overflow-hidden border">
      <Image src={preview.url} alt="" fill className="object-cover" />
      <button
        type="button"
        onClick={() => removePhoto(i)}
        className="absolute top-1 right-1 rounded-full bg-black/50 p-1 text-white hover:bg-black/70"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  ))}
</div>
```

**Pitfalls:**
- Upload should happen on form submit, NOT on file select. This avoids orphaned uploads if the user cancels.
- The `photos` column in the `dogs` table is `text[]` (Postgres array). Supabase accepts arrays in insert/update.
- When editing a dog, the form must distinguish between existing photos (already uploaded, have Supabase URLs) and new photos (local blob URLs, need upload). Track them separately.
- Max 5 photos is a reasonable limit — validate client-side.
- File upload is sequential (one at a time) to avoid rate limits. Use `Promise.all` only if the API is robust.

**Verification:**
1. Dog form shows clickable upload area
2. Selecting files shows thumbnail previews
3. Removing a preview removes it from the list
4. Saving the form uploads photos and saves URLs to the dog record
5. Editing a dog shows existing photos as thumbnails
6. Browse page shows uploaded dog photos

**Commit:** `feat: dog photo upload with preview in DogForm (§2)`

---

### Step 10: Avatar & Logo Upload
**TODO ref:** [§8 — Profile Management](./TODO.md#8-profile-management) (third item)
**Estimated time:** 1.5–2 hours
**Depends on:** Step 8 (storage infrastructure)

**What this adds:** Working avatar upload for foster profile, logo upload for shelter settings.

**Files to modify:**
- `src/components/foster/foster-profile-form.tsx` — wire avatar upload
- `src/components/shelter/shelter-settings-form.tsx` — wire logo upload

**Pattern:** Both forms currently have disabled file inputs. Wire them using the same upload pattern from Step 9 but simpler (single file, not multi):
1. Add hidden file input triggered by clicking the avatar/logo area
2. On select: show preview using `URL.createObjectURL()`
3. On form submit: upload via `/api/upload/photo` with bucket param
4. Save returned URL to the `avatar_url` or `logo_url` column

**Upload path convention:**
- Foster avatars: `foster-avatars/{userId}/avatar.{ext}`
- Shelter logos: `shelter-logos/{userId}/logo.{ext}`

Using a fixed filename (`avatar.{ext}`) means re-uploading automatically overwrites the old file — no orphan cleanup needed.

**Pitfalls:**
- The `Avatar` component in the sidebar (`portal-sidebar-user.tsx`) reads `avatarUrl` from `PortalIdentity`. After upload, the sidebar won't update until the next page load. This is acceptable for now.
- The upload API currently assumes `dog-photos` bucket. Modify it to accept a `bucket` parameter in the FormData, or create separate endpoints. Accepting a `bucket` param is simpler — add validation that the bucket is one of the three allowed values.

**Verification:**
1. Foster profile: click avatar area → file picker → preview shown → save → avatar persists on reload
2. Shelter settings: click logo area → file picker → preview shown → save → logo persists
3. Sidebar shows updated avatar/logo after page reload
4. Type check passes

**Commit:** `feat: avatar and logo upload on profile forms (§8)`

---

### Step 11: Email Notifications — Setup + Templates
**TODO ref:** [§11 — Email Notifications (Resend)](./TODO.md#11-email-notifications-resend) (first two items)
**Estimated time:** 2–2.5 hours

**What this adds:** Resend integration, email template components, and the send helper.

**Files to create:**
- `src/lib/email.ts` — send email helper wrapping Resend
- `src/emails/application-submitted.tsx` — React email template
- `src/emails/application-accepted.tsx` — React email template
- `src/emails/application-declined.tsx` — React email template
- `src/emails/placement-completed.tsx` — React email template
- `src/emails/new-message.tsx` — React email template

**Files to modify:**
- `src/app/api/notifications/send/route.ts` — replace stub with real Resend calls
- `package.json` — `resend` is already a dependency (v6.10)

**Email helper (`src/lib/email.ts`):**
```ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendEmail({
  to,
  subject,
  react,
}: {
  to: string
  subject: string
  react: React.ReactElement
}) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[email] Would send "${subject}" to ${to}`)
    return { success: true, mock: true }
  }
  const { error } = await resend.emails.send({
    from: 'Fostr Fix <noreply@fostrfix.com>',
    to,
    subject,
    react,
  })
  if (error) {
    console.error('[email] Send failed:', error)
    return { success: false, error: error.message }
  }
  return { success: true }
}
```

**Email templates:** Use basic React components (Resend supports React email). Keep templates simple — plain HTML with inline styles. Each template receives typed props:
```tsx
// src/emails/application-submitted.tsx
interface Props {
  shelterName: string
  dogName: string
  fosterName: string
  applicationUrl: string
}
export function ApplicationSubmittedEmail({ shelterName, dogName, fosterName, applicationUrl }: Props) {
  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <h1>New Application for {dogName}</h1>
      <p>Hi {shelterName},</p>
      <p>{fosterName} has applied to foster {dogName}.</p>
      <a href={applicationUrl}>View Application</a>
    </div>
  )
}
```

**Pitfalls:**
- Resend requires a verified domain or uses their sandbox domain for testing. The `from` address must be from a verified domain. Document this requirement.
- `RESEND_API_KEY` is in `.env.example` but may not be set. The helper gracefully falls back to console logging when the key is missing — this preserves DEV_MODE behavior.
- Do NOT use `@react-email/components` — that's a separate package with complex setup. Use plain React + inline styles for templates. Resend can render React components directly.
- Email sending should be fire-and-forget (don't block the API response). Use `void sendEmail(...)` without awaiting, or await but don't fail the request if email fails.

**Verification:**
1. Without `RESEND_API_KEY`: notification route logs to console, returns success
2. With `RESEND_API_KEY`: test via Resend sandbox or verified domain
3. All 5 templates render without errors (test by importing and calling with props)
4. Type check passes

**Commit:** `feat: email notification infrastructure with Resend templates (§11)`

---

### Step 12: Email Notifications — Wire Trigger Points
**TODO ref:** [§11 — Email Notifications (Resend)](./TODO.md#11-email-notifications-resend) (items 2-6)
**Estimated time:** 1.5–2 hours
**Depends on:** Step 11 (email infrastructure)

**What this adds:** Actually send emails when events happen — application submitted, accepted, declined, completed, new message.

**Files to modify:**
- `src/app/api/applications/[id]/accept/route.ts` — send email to foster after accepting
- `src/app/api/applications/[id]/decline/route.ts` — send email to foster after declining
- `src/app/api/applications/[id]/complete/route.ts` — send email to both parties
- `src/app/(foster)/foster/dog/[id]/page.tsx` — send email to shelter after applying (or add to a new API route)
- `src/components/messages/message-thread.tsx` — send email to recipient on new message

**Pattern for each trigger point:**
After the successful database operation, fire-and-forget an email:
```ts
// Example in accept/route.ts, after successful status update:
import { sendEmail } from '@/lib/email'
import { ApplicationAcceptedEmail } from '@/emails/application-accepted'

// ... after successful update ...
void sendEmail({
  to: fosterEmail,
  subject: `Great news! Your application for ${dogName} was accepted`,
  react: ApplicationAcceptedEmail({ dogName, shelterName, threadUrl }),
})
```

**Email data needed per trigger:**
| Event | Recipient | Data needed | Source |
|-------|-----------|-------------|--------|
| Application submitted | Shelter email | foster name, dog name, application URL | Application insert response |
| Application accepted | Foster email | dog name, shelter name, thread URL | Accept route - already has application + joins |
| Application declined | Foster email | dog name, shelter name | Decline route - already has application + joins |
| Placement completed | Both emails | dog name, foster name, shelter name | Complete route - already has application + joins |
| New message | Other party email | sender name, message preview, thread URL | Message insert - need to fetch recipient email |

**Pitfalls:**
- New message emails should be **debounced** — don't email on every single message. Options: (a) only email if the recipient hasn't been active in the thread for 5+ minutes, or (b) skip message notification emails for MVP and add them later. Recommend option (b) — mark it as a follow-up in the code.
- The application submission currently happens in a client component (`foster/dog/[id]/page.tsx`), not an API route. To send an email, either: (a) call the `/api/notifications/send` route from the client after insert, or (b) refactor the application insert into an API route. Option (a) is simpler for now.
- Emails need the recipient's email address. The current queries don't always join the user's auth email. You may need to query `auth.users` via `supabase.auth.admin.getUserById()` (requires service role key) or store emails in the profile tables. The simpler approach: the `shelters` and `foster_parents` tables have an `email` field — use that.

**Verification:**
1. Accept an application → foster receives email (or console log if no API key)
2. Decline → foster notified
3. Complete → both parties notified
4. Submit application → shelter notified
5. No crashes if email send fails (fire-and-forget)
6. Type check passes

**Commit:** `feat: wire email notifications on application events (§11)`

---

## Phase 2: Extended Features

> Features that round out the platform — search, ratings, settings, legal.

---

### Step 13: Browse — Text/Keyword Search
**TODO ref:** [§20 — Browse & Discovery Gaps](./TODO.md#20-browse--discovery-gaps) (first item)
**Estimated time:** 1–1.5 hours

**What this adds:** Free-text search box in the filter sidebar that filters by dog name and breed.

**Files to modify:**
- `src/components/foster/filter-sidebar.tsx` — add search input to `BrowseFilterForm`
- `src/app/(foster)/foster/browse/page.tsx` — add `search` to FilterState, apply to filtering logic, sync to URL params

**Implementation:**
1. Add `search: string` to the `FilterState` type in browse page
2. Add a text input at the top of `BrowseFilterForm`:
   ```tsx
   <Input
     placeholder="Search by name or breed..."
     value={filters.search}
     onChange={(e) => onFilterChange({ ...filters, search: e.target.value })}
   />
   ```
3. In the client-side filter function, add:
   ```ts
   if (filters.search) {
     const q = filters.search.toLowerCase()
     filtered = filtered.filter(d =>
       d.name.toLowerCase().includes(q) || d.breed.toLowerCase().includes(q)
     )
   }
   ```
4. Sync `search` to URL params (same pattern as existing filters)
5. Add a removable chip for the active search term in the results area

**Pitfalls:**
- The `BrowseFilterForm` component is rendered in two places: desktop `Card` and mobile `Sheet`. Both instances share the same `FilterState` from the parent. The search input needs the `idPrefix` prop for unique IDs (same as other form elements in the filter sidebar).
- Debounce the search input by 300ms to avoid excessive re-renders as the user types. Use a simple `useEffect` with `setTimeout`/`clearTimeout` pattern.
- URL param key: use `q` (short, standard) rather than `search`.

**Verification:**
1. Search box appears at top of filter sidebar (desktop and mobile)
2. Typing "lab" filters to dogs with "lab" in name or breed
3. Clearing search shows all dogs again
4. Search term appears as removable chip above results
5. Search term persists in URL (`?q=lab`)
6. Type check passes

**Commit:** `feat: text search on browse page by name and breed (§20)`

---

### Step 14: Browse — Pre-populate Filters from Foster Preferences
**TODO ref:** [§20 — Browse & Discovery Gaps](./TODO.md#20-browse--discovery-gaps) (second item)
**Estimated time:** 45 minutes–1 hour

**What this adds:** On first visit (no URL params), initialize filters from the foster's saved preferences (`pref_size`, `pref_age`, `pref_medical`).

**Files to modify:**
- `src/app/(foster)/foster/browse/page.tsx` — fetch foster preferences, use as default filter state

**The `foster_parents` table has:**
- `pref_size` — text (e.g., 'medium')
- `pref_age` — text (e.g., 'adult')
- `pref_medical` — boolean (comfortable with medical needs)

**Implementation:**
1. On mount, check if URL has any filter params. If yes, use URL params (existing behavior).
2. If no URL params, fetch the foster's preferences:
   ```ts
   const { data: foster } = await supabase
     .from('foster_parents')
     .select('pref_size, pref_age, pref_medical')
     .eq('user_id', user.id)
     .single()
   ```
3. Initialize `FilterState` from preferences:
   ```ts
   const defaultFilters: FilterState = {
     sizes: foster?.pref_size ? [foster.pref_size] : [],
     ages: foster?.pref_age ? [foster.pref_age] : [],
     gender: null,
     medicalOk: foster?.pref_medical ?? false,
     search: '',
   }
   ```
4. Push these defaults into URL params so the state is consistent

**Pitfalls:**
- This is a client component, so use `createClient()` (browser client) to fetch preferences.
- Only pre-populate on first load (empty URL params). If the user has explicitly cleared filters, don't re-populate. Track this with a `hasInitialized` ref.
- In DEV_MODE, there's no auth/user, so skip preference fetching and use empty defaults.

**Verification:**
1. Foster with pref_size="medium" visits `/foster/browse` → "Medium" filter pre-selected
2. Foster clears the filter → filters stay cleared (no re-populate)
3. Foster with URL params visits browse → URL params take precedence
4. Type check passes

**Commit:** `feat: pre-populate browse filters from foster preferences (§20)`

---

### Step 15: Browse — Pagination
**TODO ref:** [§20 — Browse & Discovery Gaps](./TODO.md#20-browse--discovery-gaps) (fourth item), [§3 item 4](./TODO.md#3-browse--search-foster-side)
**Estimated time:** 1.5–2 hours

**What this adds:** Paginated dog fetching instead of loading all dogs at once.

**Files to modify:**
- `src/app/(foster)/foster/browse/page.tsx` — add pagination state, fetch with limit/offset, "Load More" button

**Approach:** Use cursor-based pagination (Supabase `range()`) with a "Load More" button at the bottom of the grid. This is simpler than page numbers and works well with client-side filtering.

**Implementation:**
1. Fetch first 24 dogs: `.range(0, 23)` (Supabase range is inclusive)
2. Track `hasMore` state based on whether the response returned a full page
3. "Load More" button at bottom fetches next 24 with `.range(offset, offset + 23)`
4. Append to existing dogs array (don't replace)
5. Client-side filtering applies to ALL loaded dogs

**Important architectural note:** Client-side filtering + server-side pagination creates a UX issue: if the user filters by "small" dogs and only 2 of the first 24 are small, they see 2 results with a "Load More" button. This is acceptable for MVP — note it as a future improvement to move filtering server-side.

**Pitfalls:**
- The current code fetches all dogs and filters client-side. Pagination means the user might not see all matching dogs without loading more pages. This is a known trade-off.
- The `dogs` count in the "X dogs found" header should reflect filtered results from loaded dogs, not total DB count. Add a note like "showing X of loaded dogs" or "load more to see all results."
- DEV_MODE uses `PLACEHOLDER_DOGS` (line ~24-50 in browse page). These should also be paginated for consistency, or just return all placeholders (they're a small fixed array).

**Verification:**
1. Browse page initially loads 24 dogs (or fewer if there are fewer)
2. "Load More" button appears when more dogs exist
3. Clicking loads next page and appends
4. Filters work on all loaded dogs
5. Type check passes

**Commit:** `feat: paginated dog browsing with load-more (§3, §20)`

---

### Step 16: Public Shelter Profile Page
**TODO ref:** [§20 — Browse & Discovery Gaps](./TODO.md#20-browse--discovery-gaps) (third item)
**Estimated time:** 1.5–2 hours

**What this adds:** Public page at `/shelter/[slug]` showing shelter info and active dog listings.

**Files to create:**
- `src/app/shelter/[slug]/page.tsx` — server component (public, outside route groups)
- `src/app/shelter/[slug]/loading.tsx` — skeleton

**Files to modify:**
- `src/components/foster/browse-dog-card.tsx` — make shelter name a link to `/shelter/{slug}`

**Page content:**
- Shelter name, logo, location, bio, website, social links
- Verified badge (if `is_verified`)
- Grid of active dogs (status = 'available') for this shelter
- "Apply" CTA on each dog card (links to dog detail page)

**Implementation:**
1. Fetch shelter by slug: `.select('*').eq('slug', params.slug).single()`
2. If not found, `notFound()`
3. Fetch active dogs for this shelter
4. Render header + dog grid (reuse `BrowseDogCard` component)

**Pitfalls:**
- This page is OUTSIDE the `(foster)/` and `(shelter)/` route groups — it's a public page. No `AuthGuard` or `RoleGuard`.
- The `shelters.slug` column may not be unique. Check the schema — if not, add a unique index. The initial schema creates slug with `slugify(name) + random suffix`, which should be unique in practice, but enforce it.
- Add `metadata` export for SEO: `title: "${shelter.name} | Fostr Fix"`.
- In DEV_MODE, the Supabase query won't work. Show a placeholder shelter profile.

**Verification:**
1. Navigate to `/shelter/{slug}` → shows shelter info + active dogs
2. Shelter name on browse dog card is now a link → clicking navigates to shelter profile
3. Invalid slug → 404 page
4. Type check passes

**Commit:** `feat: public shelter profile page (§20)`

---

### Step 17: Realtime Messaging
**TODO ref:** [§6 — Messaging](./TODO.md#6-messaging) (fifth item)
**Estimated time:** 2–2.5 hours

**What this adds:** Live message updates without page refresh using Supabase Realtime.

**Files to modify:**
- `src/components/messages/message-thread.tsx` — add Realtime subscription for new messages

**Current state:** `message-thread.tsx` line 10-11 explicitly states Realtime is omitted. Messages only appear on page load or refresh. `TypingIndicator` component exists but `showTypingIndicator` defaults to `false`.

**Implementation:**
1. After initial render, subscribe to Realtime channel:
   ```ts
   useEffect(() => {
     const channel = supabase
       .channel(`messages:${applicationId}`)
       .on('postgres_changes', {
         event: 'INSERT',
         schema: 'public',
         table: 'messages',
         filter: `application_id=eq.${applicationId}`,
       }, (payload) => {
         const newMessage = payload.new as Message
         // Only add if not the current user's message (avoid duplicate with optimistic)
         if (newMessage.sender_id !== currentUserId) {
           setMessages(prev => [...prev, newMessage])
         }
       })
       .subscribe()

     return () => { supabase.removeChannel(channel) }
   }, [applicationId, currentUserId])
   ```
2. Remove the comment about Realtime being omitted
3. Auto-scroll to bottom when new messages arrive (existing `scrollToBottom` function)

**Pitfalls:**
- **Duplicate messages:** The user's own messages are already added optimistically. When the Realtime subscription fires for the INSERT, the message is already in the list. Filter by `sender_id !== currentUserId` to avoid duplicates.
- **Supabase Realtime requires the `realtime` schema extension** to be enabled on the `messages` table. This is done in the Supabase dashboard (Database → Replication → add `messages` table) or via SQL: `ALTER PUBLICATION supabase_realtime ADD TABLE messages;`. Add this to a migration.
- In DEV_MODE, there's no real Supabase, so Realtime won't connect. The subscription will silently fail — this is fine.
- **Channel naming:** Use `messages:${applicationId}` as the channel name to scope to the specific thread.
- **Mark-as-read on incoming:** When a new message arrives via Realtime, it's unread. Call the mark-as-read logic for the new message. The current mark-as-read runs server-side on page load — for Realtime messages, do it client-side:
  ```ts
  await supabase.from('messages').update({ read: true }).eq('id', newMessage.id)
  ```

**Files to create:**
- `supabase/migrations/20240106000000_realtime_messages.sql`:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  ```

**Verification:**
1. Open two browser windows (shelter + foster for same application)
2. Send message from one → appears in real-time in the other (no refresh)
3. No duplicate messages on the sender's side
4. Message marked as read when received in open thread
5. Unsubscribes on component unmount (no memory leak)
6. Type check passes

**Commit:** `feat: real-time messaging via Supabase Realtime (§6)`

---

### Step 18: Account Settings — Password + Email Change
**TODO ref:** [§21 — Account Settings](./TODO.md#21-account-settings) (first two items)
**Estimated time:** 1.5–2 hours

**What this adds:** Users can change their password and email from within the app.

**Current state:** Shelter settings page has an empty "Account" tab (line ~73). Foster profile has no account section.

**Files to create:**
- `src/components/account-settings-form.tsx` — shared client component for password/email change

**Files to modify:**
- `src/app/(shelter)/shelter/settings/page.tsx` — populate the "Account" tab with the form
- `src/app/(foster)/foster/profile/page.tsx` — add an "Account" section or tab

**Account settings form:**
Two sections:
1. **Change email:** input for new email → `supabase.auth.updateUser({ email: newEmail })` → Supabase sends confirmation to new email → show "Check your new email to confirm"
2. **Change password:** current password (optional — Supabase doesn't require it for authenticated users), new password, confirm new password → `supabase.auth.updateUser({ password: newPassword })` → success toast

**Pitfalls:**
- `supabase.auth.updateUser()` is a CLIENT-side operation (requires active session). This must be a `'use client'` component using the browser Supabase client.
- Email change requires the user to confirm via email. Until confirmed, the old email stays active. Show this clearly in the UI.
- Password change for OAuth-only users (Google) doesn't make sense. Check `user.app_metadata.provider` — if it's `google`, hide the password section and show "Signed in with Google."
- In DEV_MODE, these operations won't work. Show a notice.

**Verification:**
1. Shelter: "Account" tab shows password change and email change forms
2. Foster: profile page shows account settings section
3. Password change works (test with real Supabase)
4. OAuth users see "Signed in with Google" instead of password form
5. Type check passes

**Commit:** `feat: account settings — password and email change (§21)`

---

### Step 19: Account Deletion
**TODO ref:** [§21 — Account Settings](./TODO.md#21-account-settings) (third item)
**Estimated time:** 1.5–2 hours

**What this adds:** Users can delete their account (GDPR/CCPA compliance).

**Files to create:**
- `src/app/api/account/delete/route.ts` — server-side account deletion

**Files to modify:**
- `src/components/account-settings-form.tsx` — add "Delete Account" danger zone section

**Deletion flow:**
1. User clicks "Delete Account" → confirmation dialog with text input ("type DELETE to confirm")
2. Client calls `POST /api/account/delete`
3. Server:
   a. Get authenticated user
   b. Cancel active applications (set status to `declined` or delete)
   c. Anonymize profile data (set name to "Deleted User", clear personal fields)
   d. Delete the auth user via Supabase Admin API: `supabase.auth.admin.deleteUser(userId)` (requires `SUPABASE_SERVICE_ROLE_KEY`)
   e. Return success
4. Client redirects to `/` with hard navigation

**Pitfalls:**
- `supabase.auth.admin.deleteUser()` requires the **service role key**, NOT the anon key. Create a server-side Supabase client with the service role key for this endpoint only.
- Cascade behavior: deleting the user's auth row doesn't automatically delete their `shelters` or `foster_parents` rows (those are linked by `user_id` which is a UUID reference, not a foreign key to `auth.users`). The API route must clean up profile data explicitly.
- If the user is a shelter with active dogs and applications, account deletion has broad impact. Show a warning: "This will cancel all active applications and remove your shelter listing."
- `SUPABASE_SERVICE_ROLE_KEY` is in `.env.example` but may not be set. Guard against this.

**Verification:**
1. "Delete Account" section appears with red warning styling
2. Typing "DELETE" enables the confirmation button
3. Account deletion removes user, anonymizes data, cancels active applications
4. User is redirected to landing page
5. Attempting to log in with deleted credentials fails
6. Type check passes

**Commit:** `feat: account deletion with data anonymization (§21)`

---

### Step 20: Two-Way Trust — Foster-to-Shelter Ratings
**TODO ref:** [§22 — Two-Way Trust & Ratings](./TODO.md#22-two-way-trust--ratings) (first item)
**Estimated time:** 2–2.5 hours

**What this adds:** Fosters can rate shelters after a completed placement (reverse of existing shelter → foster ratings).

**Files to create:**
- `src/app/api/shelter-ratings/route.ts` — POST handler for foster → shelter rating
- `src/components/foster/shelter-rating-dialog.tsx` — rating dialog for foster side
- `supabase/migrations/20240107000000_shelter_ratings.sql` — new table + RLS

**Migration:**
```sql
CREATE TABLE IF NOT EXISTS public.shelter_ratings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  application_id  UUID NOT NULL REFERENCES public.applications(id),
  shelter_id      UUID NOT NULL REFERENCES public.shelters(id),
  foster_id       UUID NOT NULL REFERENCES public.foster_parents(id),
  score           INT NOT NULL CHECK (score >= 1 AND score <= 5),
  comment         TEXT
);

-- Only one rating per application per direction
ALTER TABLE public.shelter_ratings ADD CONSTRAINT shelter_ratings_app_unique UNIQUE (application_id);

-- RLS
ALTER TABLE public.shelter_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "foster can insert rating for their completed placements"
  ON public.shelter_ratings FOR INSERT
  WITH CHECK (foster_id IN (SELECT public.get_my_foster_ids()));

CREATE POLICY "shelter can read their ratings"
  ON public.shelter_ratings FOR SELECT
  USING (shelter_id IN (SELECT public.get_my_shelter_ids()) OR foster_id IN (SELECT public.get_my_foster_ids()));
```

**API route — same pattern as `/api/ratings`** but checks foster ownership instead of shelter ownership.

**UI — foster side:**
On completed applications in the foster applications list, show "Rate Shelter" button (same pattern as shelter's "Rate Foster" button in `accept-decline-buttons.tsx`). Open `ShelterRatingDialog` with `StarRating` component.

**Also show shelter's average rating on:**
- Public shelter profile page (Step 16)
- Dog detail page (near shelter name)
- Browse dog cards (small star + number next to shelter name)

**Pitfalls:**
- Need to add `ShelterRating` interface to `src/types/database.ts`
- The `calculateAverageRating` helper in `src/lib/helpers.ts` works generically — reuse it for shelter ratings
- Don't confuse the two rating tables: `ratings` (shelter → foster) and `shelter_ratings` (foster → shelter)

**Verification:**
1. Foster sees "Rate Shelter" on completed application
2. Rating dialog submits successfully
3. Duplicate rating returns idempotent response
4. Shelter ratings visible on public profile
5. Type check passes

**Commit:** `feat: foster-to-shelter ratings with new table (§22)`

---

### Step 21: Legal Pages + Terms Acceptance
**TODO ref:** [§24 — Legal & Compliance](./TODO.md#24-legal--compliance)
**Estimated time:** 1–1.5 hours

**What this adds:** Terms of Service page, Privacy Policy page, terms acceptance checkbox on signup.

**Files to create:**
- `src/app/terms/page.tsx` — static Terms of Service page
- `src/app/privacy/page.tsx` — static Privacy Policy page

**Files to modify:**
- `src/app/signup/page.tsx` — add required terms acceptance checkbox
- `src/app/page.tsx` (landing) — add Terms/Privacy links to footer
- `src/components/navbar.tsx` — add footer links if applicable

**Implementation:**
- Terms and Privacy pages are static content (placeholder text for now — legal team provides real content later)
- Signup checkbox: "I agree to the [Terms of Service](/terms) and [Privacy Policy](/privacy)" — required, form won't submit without it
- Store acceptance: add `terms_accepted_at` field to both `shelters` and `foster_parents` tables, or create a separate `user_consents` table. Simpler: just ensure the checkbox is checked — the act of creating an account implies acceptance. Store a timestamp if needed later.

**Pitfalls:**
- Don't block existing users who signed up before terms existed. The checkbox is only on the signup form.
- The terms/privacy pages should be accessible without authentication (public routes).
- Use `metadata` exports for SEO on both pages.

**Verification:**
1. `/terms` and `/privacy` pages render
2. Signup form has checkbox — cannot submit without checking
3. Footer links work from landing page
4. Type check passes

**Commit:** `feat: terms of service, privacy policy, signup acceptance (§24)`

---

### Step 22: Distance-Based Search
**TODO ref:** [§3 item 3](./TODO.md#3-browse--search-foster-side), [§20](./TODO.md#20-browse--discovery-gaps)
**Estimated time:** 2–2.5 hours

**What this adds:** Filter dogs by distance from foster's location using haversine calculation.

**Current state:** `foster_parents` has `latitude`, `longitude`, `max_distance` columns. `shelters` has `latitude`, `longitude`. Dogs don't have coordinates — distance is calculated from shelter location.

**Files to create:**
- `supabase/migrations/20240108000000_haversine_function.sql` — Postgres function for distance calculation

**Files to modify:**
- `src/app/(foster)/foster/browse/page.tsx` — add distance filter, calculate distances
- `src/components/foster/filter-sidebar.tsx` — add distance slider/input
- `src/components/foster/browse-dog-card.tsx` — show distance on card

**Postgres function:**
```sql
CREATE OR REPLACE FUNCTION haversine_distance(lat1 float, lon1 float, lat2 float, lon2 float)
RETURNS float AS $$
  SELECT 3959 * acos(
    cos(radians(lat1)) * cos(radians(lat2)) * cos(radians(lon2) - radians(lon1)) +
    sin(radians(lat1)) * sin(radians(lat2))
  )
$$ LANGUAGE sql IMMUTABLE;
```
Returns distance in miles.

**Approach:** Since the browse page already fetches dogs client-side with nested shelter data, calculate distance client-side using the foster's coordinates and the shelter's coordinates on each dog. Add a distance slider (0-100 miles) to the filter sidebar.

**Pitfalls:**
- Many fosters and shelters won't have coordinates set (null). If either is null, skip distance filtering for those dogs (show them regardless).
- The haversine function in SQL is useful for future server-side filtering but not needed for the current client-side approach. Create it anyway as infrastructure.
- Distance calculation in JavaScript:
  ```ts
  function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 3959 // miles
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
  }
  ```
  Add to `src/lib/helpers.ts`.

**Verification:**
1. Distance slider appears in filter sidebar
2. Dogs from shelters beyond the distance are hidden
3. Dogs without coordinates always show (not filtered out)
4. Distance shown on dog cards
5. Type check passes

**Commit:** `feat: distance-based dog search with haversine calculation (§3, §20)`

---

## Phase 3: Hardening

> Fix data integrity, security, and reliability issues before production.

---

### Step 23: Database Indexes
**TODO ref:** [§26 RED — Database indexes](./TODO.md#26-pre-launch-hardening)
**Estimated time:** 30–45 minutes

**Files to create:**
- `supabase/migrations/20240109000000_add_indexes.sql`

**Migration content:**
```sql
-- Dogs
CREATE INDEX IF NOT EXISTS idx_dogs_status ON public.dogs(status);
CREATE INDEX IF NOT EXISTS idx_dogs_shelter_id ON public.dogs(shelter_id);

-- Applications
CREATE INDEX IF NOT EXISTS idx_applications_foster_id ON public.applications(foster_id);
CREATE INDEX IF NOT EXISTS idx_applications_shelter_id ON public.applications(shelter_id);
CREATE INDEX IF NOT EXISTS idx_applications_dog_id ON public.applications(dog_id);
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications(status);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_application_id_read ON public.messages(application_id, read);

-- Auth lookups
CREATE INDEX IF NOT EXISTS idx_shelters_user_id ON public.shelters(user_id);
CREATE INDEX IF NOT EXISTS idx_foster_parents_user_id ON public.foster_parents(user_id);

-- Shelter slug (for public profile)
CREATE UNIQUE INDEX IF NOT EXISTS idx_shelters_slug ON public.shelters(slug);
```

**Pitfalls:**
- `CREATE INDEX IF NOT EXISTS` is safe to run multiple times.
- The `shelters(slug)` unique index may fail if there are duplicate slugs. Check existing data first.
- Apply via `supabase db push` or SQL editor — committing the file alone does NOT apply it.

**Verification:**
- Query `pg_indexes` to confirm indexes exist after applying migration
- Type check passes (no code changes)

**Commit:** `perf: add database indexes on frequently queried columns (§26)`

---

### Step 24: Atomic Status Transitions
**TODO ref:** [§26 RED — Atomic status transitions](./TODO.md#26-pre-launch-hardening)
**Estimated time:** 1.5–2 hours

**What this fixes:** Accept and complete routes currently do two separate UPDATEs. If the second fails, data is inconsistent.

**Files to create:**
- `supabase/migrations/20240110000000_atomic_transitions.sql` — Postgres functions for atomic updates

**Files to modify:**
- `src/app/api/applications/[id]/accept/route.ts` — call RPC instead of two updates
- `src/app/api/applications/[id]/complete/route.ts` — call RPC instead of two updates

**Migration — Postgres functions:**
```sql
CREATE OR REPLACE FUNCTION accept_application(app_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE applications SET status = 'accepted', updated_at = now() WHERE id = app_id;
  UPDATE dogs SET status = 'pending', updated_at = now()
    WHERE id = (SELECT dog_id FROM applications WHERE id = app_id);
END;
$$;

CREATE OR REPLACE FUNCTION complete_application(app_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE applications SET status = 'completed', updated_at = now() WHERE id = app_id;
  UPDATE dogs SET status = 'placed', updated_at = now()
    WHERE id = (SELECT dog_id FROM applications WHERE id = app_id);
END;
$$;
```

**Route changes:**
```ts
// Replace two separate updates with:
const { error } = await supabase.rpc('accept_application', { app_id: params.id })
```

**Pitfalls:**
- `SECURITY DEFINER` functions run with the definer's permissions (postgres role), bypassing RLS. The auth + ownership checks in the API route MUST remain — the function just handles the atomic update.
- Keep the idempotency guard in the API route (check status before calling RPC).
- The decline route doesn't need a function — it only updates the application status, no dog status change.

**Verification:**
1. Accept an application → both application status and dog status update atomically
2. Complete an application → both update atomically
3. If function fails, neither update persists (transactional)
4. Idempotency still works (accepting an already-accepted app returns 409)
5. Type check passes

**Commit:** `fix: atomic status transitions via Postgres functions (§26)`

---

### Step 25: Unique Constraints + Application RLS
**TODO ref:** [§26 RED — Unique constraints, RLS](./TODO.md#26-pre-launch-hardening)
**Estimated time:** 1 hour

**Files to create:**
- `supabase/migrations/20240111000000_unique_constraints.sql`

**Migration:**
```sql
-- Prevent duplicate applications (same foster + same dog)
ALTER TABLE public.applications
  ADD CONSTRAINT applications_dog_foster_unique UNIQUE (dog_id, foster_id);

-- Prevent duplicate ratings (one per application)
ALTER TABLE public.ratings
  ADD CONSTRAINT ratings_application_unique UNIQUE (application_id);

-- Prevent applying to non-available dogs
CREATE POLICY "can only apply to available dogs"
  ON public.applications FOR INSERT
  WITH CHECK (
    dog_id IN (SELECT id FROM public.dogs WHERE status = 'available')
  );
```

**Pitfalls:**
- If there are existing duplicate applications or ratings in the database, the UNIQUE constraint will fail. Run a cleanup query first:
  ```sql
  -- Check for duplicates before adding constraint:
  SELECT dog_id, foster_id, COUNT(*) FROM applications GROUP BY dog_id, foster_id HAVING COUNT(*) > 1;
  ```
- The "can only apply to available dogs" policy is an ADDITIONAL INSERT policy. Supabase uses OR for multiple policies of the same type — make sure the existing INSERT policy and this one work together. Actually, Supabase uses OR between policies, so this new policy would need to be combined with the existing one using AND. The safer approach: modify the existing INSERT policy to include the dog status check.

**Verification:**
1. Attempting to insert a duplicate application returns a unique violation error
2. Attempting to apply to a non-available dog returns a policy violation
3. Existing single applications still work fine
4. Type check passes

**Commit:** `fix: add unique constraints and application RLS hardening (§26)`

---

### Step 26: getUser() Error Handling Audit
**TODO ref:** [§26 RED — getUser() error handling](./TODO.md#26-pre-launch-hardening)
**Estimated time:** 1.5–2 hours

**What this fixes:** ~20 files call `supabase.auth.getUser()` without checking the `error` field.

**Files to modify:** Every file that calls `getUser()`. Find them:
```bash
grep -rn "getUser()" src/ --include="*.tsx" --include="*.ts"
```

**Pattern to apply everywhere:**
```ts
// BEFORE:
const { data: { user } } = await supabase.auth.getUser()
if (!user) redirect('/login')

// AFTER:
const { data: { user }, error: authError } = await supabase.auth.getUser()
if (authError) throw authError  // Let error.tsx handle it
if (!user) redirect('/login')
```

**Special cases:**
- `src/lib/portal-layout-data.ts` — already has try-catch, but the catch is too broad. Differentiate between auth errors (throw) and profile-not-found (return default).
- `src/lib/auth-routing.ts` — wrap in try-catch, return `/login` as fallback on error (not `/onboarding`).
- Client components (login, signup, dog detail page) — show toast on error instead of throwing.

**Pitfalls:**
- Don't change the behavior for DEV_MODE — in DEV_MODE, `getUser()` returns `{ user: null, error: null }` because there's no real Supabase. The `!user` check handles this correctly.
- Some files destructure deeply: `const { data: { user } } = ...`. When adding error check, change to: `const { data: { user }, error } = ...`.
- This is a tedious but critical change. Don't skip any call site.

**Verification:**
```bash
# Confirm all getUser() calls now check error:
grep -rn "getUser()" src/ --include="*.tsx" --include="*.ts" | grep -v "error"
# Should return very few or zero results
```
- Type check passes
- Dev server loads all pages without errors

**Commit:** `fix: add error handling to all getUser() call sites (§26)`

---

### Step 27: Server Page Error Handling
**TODO ref:** [§26 RED — Server page error handling](./TODO.md#26-pre-launch-hardening)
**Estimated time:** 1.5–2 hours

**What this fixes:** Server-rendered pages crash with generic error when Supabase queries fail.

**Files to modify:**
- `src/app/(shelter)/shelter/dashboard/page.tsx`
- `src/app/(foster)/foster/dashboard/page.tsx` (created in Step 2)
- `src/app/(shelter)/shelter/applications/page.tsx`
- `src/app/(foster)/foster/applications/page.tsx`
- `src/app/(shelter)/shelter/applications/[id]/page.tsx`
- `src/app/(shelter)/shelter/messages/page.tsx`
- `src/app/(foster)/foster/messages/page.tsx`
- `src/app/(shelter)/shelter/messages/[applicationId]/page.tsx`
- `src/app/(foster)/foster/messages/[applicationId]/page.tsx`
- `src/app/(shelter)/shelter/dogs/page.tsx`
- `src/app/(foster)/foster/history/page.tsx`

**Pattern:**
```tsx
// Wrap data fetching in try-catch:
let applications: ApplicationWithDetails[] = []
let fetchError = false

try {
  const { data, error } = await supabase.from('applications').select('...')
  if (error) throw error
  applications = data ?? []
} catch (e) {
  console.error('Failed to fetch applications:', e)
  fetchError = true
}

// In render:
if (fetchError) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <p className="text-destructive">Failed to load data. Please try refreshing the page.</p>
      <Button onClick={() => window.location.reload()} variant="outline" className="mt-4">
        Refresh
      </Button>
    </div>
  )
}
```

**Note:** Server components can't use `onClick`. For the refresh button, either use a client component wrapper or simply show the error text with instructions to refresh manually.

**Pitfalls:**
- Don't catch errors too broadly — auth errors (from Step 26) should still throw and be caught by `error.tsx`.
- Some pages use `Promise.all` for parallel queries (e.g., dashboard). Wrap the entire `Promise.all` in try-catch, not individual queries.
- The error UI should match the app's design system (use `text-destructive`, warm styling, not ugly red text).

**Verification:**
1. All listed pages render normally when Supabase is available
2. Type check passes
3. Error UI is consistent across pages

**Commit:** `fix: add error handling to all server-rendered pages (§26)`

---

### Step 28: Message Thread Auth + Profile Form Validation
**TODO ref:** [§26 ORANGE — Message thread auth, Profile form validation](./TODO.md#26-pre-launch-hardening)
**Estimated time:** 1.5–2 hours

**Two changes in one session:**

**1. Message thread query-level auth:**

Modify both thread pages to filter by ownership in the query:
```ts
// Foster thread page — add filter:
.eq('foster_id', fosterRow.id)

// Shelter thread page — add filter:
.eq('shelter_id', shelterRow.id)
```

**2. Profile form Zod validation:**

Add Zod schemas to:
- `src/components/foster/foster-profile-form.tsx` — validate name, email, phone, location, bio lengths
- `src/components/shelter/shelter-settings-form.tsx` — validate name, email, phone, EIN format, website URL

**Pattern (follow `dog-form.tsx`):**
```ts
const fosterProfileSchema = z.object({
  first_name: z.string().min(1, 'First name is required').max(100),
  last_name: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().max(20).optional().or(z.literal('')),
  location: z.string().max(200).optional().or(z.literal('')),
  bio: z.string().max(2000).optional().or(z.literal('')),
  // ... other fields
})
```

Wire with `react-hook-form` + `zodResolver` (already used in `dog-form.tsx`).

**Pitfalls:**
- The profile forms currently use uncontrolled state (direct `useState` per field). Converting to `react-hook-form` requires refactoring the form structure. Follow the `dog-form.tsx` pattern exactly.
- Don't break existing save functionality — the Supabase upsert/update calls stay the same, just validate before calling them.

**Verification:**
1. Foster thread page → cannot access another foster's thread (returns 404)
2. Profile form → empty required fields show validation errors
3. Long text input is truncated to max length
4. Valid form data saves successfully (same as before)
5. Type check passes

**Commit:** `fix: message thread auth + profile form validation (§26)`

---

### Step 29: Error Message Sanitization + Image Domain Config
**TODO ref:** [§26 ORANGE — Sanitize error messages, Image domain config](./TODO.md#26-pre-launch-hardening)
**Estimated time:** 45 minutes–1 hour

**1. Error sanitization:**

Find all places where `error.message` from Supabase is displayed to users:
```bash
grep -rn "error\.message" src/ --include="*.tsx" --include="*.ts"
```

Replace with generic messages:
```ts
// BEFORE:
toast.error(error.message)

// AFTER:
console.error('Operation failed:', error.message)
toast.error('Something went wrong. Please try again.')
```

**2. Image domain config** (already done in Step 8 if followed in order — verify):

Confirm `next.config.mjs` has `images.remotePatterns` for Supabase Storage.

**Verification:**
1. Trigger a Supabase error (e.g., invalid data) → UI shows generic message, console shows real error
2. No RLS policy names visible in the UI
3. Type check passes

**Commit:** `fix: sanitize error messages, confirm image domain config (§26)`

---

### Step 30: Rate Limiting + Input Sanitization
**TODO ref:** [§13 — Security](./TODO.md#13-security--edge-cases) (items 1-2)
**Estimated time:** 1.5–2 hours

**Files to create:**
- `src/lib/rate-limit.ts` — simple in-memory rate limiter for API routes

**Files to modify:**
- All API routes under `src/app/api/` — add rate limiting
- Forms that submit user text — add sanitization

**Rate limiter (simple approach for MVP):**
```ts
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(identifier: string, limit: number = 10, windowMs: number = 60000) {
  const now = Date.now()
  const record = rateLimitMap.get(identifier)

  if (!record || now > record.resetTime) {
    rateLimitMap.set(identifier, { count: 1, resetTime: now + windowMs })
    return { success: true }
  }

  if (record.count >= limit) {
    return { success: false, retryAfter: Math.ceil((record.resetTime - now) / 1000) }
  }

  record.count++
  return { success: true }
}
```

Use in API routes:
```ts
const { success } = rateLimit(user.id, 10, 60000) // 10 requests per minute
if (!success) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
```

**Input sanitization:** For user-submitted text (notes, messages, bios), strip HTML tags before storing:
```ts
function sanitizeText(input: string): string {
  return input.replace(/<[^>]*>/g, '').trim()
}
```

Add to `src/lib/helpers.ts` and use in all INSERT/UPDATE operations.

**Pitfalls:**
- In-memory rate limiting resets on server restart and doesn't work across multiple serverless function instances. For MVP this is acceptable. Document as a future improvement (Redis-based rate limiting).
- Don't sanitize text that's displayed with React's default escaping — React already prevents XSS. Sanitization is defense-in-depth for the database layer.
- The `sanitizeText` function is intentionally simple. Don't use a full HTML parser — just strip tags.

**Verification:**
1. Rapid API calls (>10/minute) return 429
2. HTML in text fields is stripped on save
3. Normal usage is not affected
4. Type check passes

**Commit:** `fix: add rate limiting to API routes and input sanitization (§13)`

---

## Phase 4: Infrastructure

> Testing, CI/CD, error tracking, and developer experience.

---

### Step 31: Environment Variable Validation
**TODO ref:** [§15 — Infrastructure](./TODO.md#15-infrastructure) (first item)
**Estimated time:** 30–45 minutes

**Files to create:**
- `src/lib/env.ts` — runtime validation of environment variables

**Implementation:**
```ts
function validateEnv() {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
  const missing = required.filter(key => !process.env[key])

  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  if (missing.length > 0) {
    console.warn(`[env] Missing env vars (dev mode active): ${missing.join(', ')}`)
  }
}
```

Call from root layout (`src/app/layout.tsx`) at module scope.

**Commit:** `chore: add environment variable validation on startup (§15)`

---

### Step 32: Seed Script
**TODO ref:** [§15 — Infrastructure](./TODO.md#15-infrastructure) (eighth item)
**Estimated time:** 1.5–2 hours

**Files to create:**
- `scripts/seed.ts` — development seed data
- Add `"seed"` script to `package.json`

**Seed data:** Create realistic test data for all 6 tables — 3 shelters, 10 dogs, 5 foster parents, 15 applications (various statuses), 30 messages, 5 ratings. Use Supabase service role client to bypass RLS.

**Commit:** `chore: add development seed script (§15)`

---

### Step 33: Test Setup + Helper Tests
**TODO ref:** [§15 — Infrastructure](./TODO.md#15-infrastructure) (ninth item)
**Estimated time:** 1.5–2 hours

**Files to create:**
- `vitest.config.ts` — test configuration
- `src/lib/__tests__/helpers.test.ts` — tests for `formatDate`, `formatRelativeTime`, `getInitials`, `slugify`, `calculateAverageRating`
- `src/lib/__tests__/auth-routing.test.ts` — tests for `getPostAuthDestination`

**Files to modify:**
- `package.json` — add `vitest` + `@testing-library/react` to devDependencies, add `"test"` script

**Why Vitest:** Faster than Jest for Next.js projects, native ESM support, compatible with the existing TypeScript setup.

**Commit:** `chore: add Vitest setup and helper unit tests (§15)`

---

### Step 34: API Route Tests
**TODO ref:** [§15 — Infrastructure](./TODO.md#15-infrastructure) (ninth item continued)
**Estimated time:** 2–2.5 hours

**Files to create:**
- `src/app/api/__tests__/accept.test.ts`
- `src/app/api/__tests__/decline.test.ts`
- `src/app/api/__tests__/complete.test.ts`
- `src/app/api/__tests__/ratings.test.ts`
- `src/app/api/__tests__/dogs-delete.test.ts`

**Test approach:** Mock Supabase client, test auth checks, ownership verification, idempotency guards, and error handling.

**Commit:** `test: add API route tests for critical endpoints (§15)`

---

### Step 35: Page Metadata / SEO
**TODO ref:** [§26 YELLOW — Page metadata](./TODO.md#26-pre-launch-hardening)
**Estimated time:** 45 minutes–1 hour

**Files to modify:**
- `src/app/(foster)/layout.tsx` — add base metadata
- `src/app/(shelter)/layout.tsx` — add base metadata
- Key pages: browse, dashboard(s), applications, messages, profile, settings

**Pattern:**
```ts
export const metadata: Metadata = {
  title: 'Browse Dogs | Fostr Fix',
  description: 'Find your perfect foster dog from local shelters',
}
```

**Commit:** `chore: add page metadata for SEO (§26)`

---

### Step 36: Error Boundary Improvements
**TODO ref:** [§15 — Infrastructure](./TODO.md#15-infrastructure) (second item)
**Estimated time:** 45 minutes

**Files to modify:**
- `src/app/error.tsx` — improve with retry button, error context, support link
- Create `src/app/(foster)/error.tsx` and `src/app/(shelter)/error.tsx` — portal-specific error boundaries

**Commit:** `fix: improve error boundaries with retry and context (§15)`

---

## Phase 5: UI/UX Polish

> Aesthetic improvements and remaining UI TODO items.

---

### Step 37: Landing Page — Hero Redesign
**TODO ref:** [§25b — Landing Page](./TODO.md#25b-landing-page) (first 3 items)
**Estimated time:** 2–2.5 hours

**Files to modify:** `src/app/page.tsx`
- Replace centered icon with full-bleed asymmetric layout
- Add warm gradient background
- Add social proof stats bar below CTAs

**Commit:** `feat: landing page hero redesign with social proof (§25b)`

---

### Step 38: Landing Page — How It Works + Footer
**TODO ref:** [§25b — Landing Page](./TODO.md#25b-landing-page) (items 4-6)
**Estimated time:** 1.5–2 hours

**Files to modify:** `src/app/page.tsx`, `src/components/navbar.tsx` (footer)
- Redesign "How It Works" step cards with illustrations and tints
- Add two-column footer with nav links, social icons, brand lockup

**Commit:** `feat: landing page how-it-works cards and footer redesign (§25b)`

---

### Step 39: Filter Pill Selectors
**TODO ref:** [§25e — Browse Page Layout](./TODO.md#25e-browse-page-layout) (third item)
**Estimated time:** 1.5 hours

**Files to modify:** `src/components/foster/filter-sidebar.tsx`
- Replace checkbox lists for Size and Age with horizontal pill/chip toggles
- Keep checkbox for medical toggle

**Commit:** `feat: filter pill selectors replacing checkboxes on browse (§25e)`

---

### Step 40: Illustrated Empty States
**TODO ref:** [§25g — Empty States](./TODO.md#25g-empty-states)
**Estimated time:** 1.5–2 hours

**Files to modify:** `src/components/empty-state.tsx` and all call sites
- Add unique SVG illustrations per context (sleepy dog, magnifying glass with paw, speech bubble)
- Can use simple inline SVGs or lucide icon compositions

**Commit:** `feat: illustrated empty states across all views (§25g)`

---

### Step 41: Form Polish
**TODO ref:** [§25h — Forms & Inputs](./TODO.md#25h-forms--inputs) (items 2-6)
**Estimated time:** 2 hours

**Files to modify:** Profile forms, onboarding form, dog form
- Section headers with colored left-border accent
- Required field asterisks + green checkmarks on valid fields
- Profile completeness progress bar with warm amber styling
- Floating save button on long forms (sticky bottom bar)

**Commit:** `feat: form polish — section headers, validation indicators, floating save (§25h)`

---

### Step 42: Incoming Message Avatars
**TODO ref:** [§25j — Messaging](./TODO.md#25j-messaging) (second item)
**Estimated time:** 1 hour

**Files to modify:** `src/components/messages/message-thread.tsx`
- Show sender avatar next to incoming message bubbles
- Thread page already has application data with foster/shelter profiles — pass avatar URL to MessageThread

**Commit:** `feat: incoming sender avatars in message thread (§25j)`

---

### Step 43: Onboarding Redesign
**TODO ref:** [§25k — Onboarding Flow](./TODO.md#25k-onboarding-flow)
**Estimated time:** 2 hours

**Files to modify:** `src/app/onboarding/page.tsx`
- Role selection cards with illustrated headers, bullet lists, hover scale
- Shelter form visual grouping (Basic Info, Contact, Online Presence sections)

**Commit:** `feat: onboarding redesign — role cards and form grouping (§25k)`

---

### Step 44: Micro-interactions + Animations
**TODO ref:** [§25l — Micro-interactions & Motion](./TODO.md#25l-micro-interactions--motion) (items 1, 3)
**Estimated time:** 1.5 hours

**Files to modify:** Root layout, browse page, dashboard, applications
- Page transition fade wrapper
- Card entrance animations with staggered delays

**Commit:** `feat: page transitions and card entrance animations (§25l)`

---

### Step 45: Responsive Polish + Content Centering
**TODO ref:** [§25m](./TODO.md#25m-accessibility--responsive-polish) (items 2, 4), [§25n](./TODO.md#25n-main-content-width--alignment-portal-pages)
**Estimated time:** 1.5–2 hours

**Files to modify:** Browse page, portal layouts, profile pages, empty states
- Responsive browse layout with collapsible sidebar at `md`
- Print stylesheet for application detail and foster profile
- Center and constrain main content on wide screens
- Profile forms widened or two-column on `lg+`

**Commit:** `feat: responsive polish, print styles, content centering (§25m, §25n)`

---

## Remaining Items (Not Yet Scheduled)

These are larger features that can be tackled after the above phases, in any order:

| Item | TODO ref | Notes |
|------|----------|-------|
| Shelter verification workflow | [§22](./TODO.md#22-two-way-trust--ratings) | Needs admin interface — significant scope |
| Multi-staff shelter access | [§23](./TODO.md#23-collaboration--scale) | New table, invitation flow, permission system |
| In-app notification center | [§23](./TODO.md#23-collaboration--scale) | New table, bell UI, event triggers |
| CI/CD pipeline | [§15](./TODO.md#15-infrastructure) | GitHub Actions, Vercel deploy |
| Error tracking (Sentry) | [§15](./TODO.md#15-infrastructure) | Package install + config |
| Analytics | [§15](./TODO.md#15-infrastructure) | PostHog/Mixpanel integration |
| Session expiry handling | [§13](./TODO.md#13-security--edge-cases) | Graceful refresh/redirect |
| CSRF protection | [§13](./TODO.md#13-security--edge-cases) | Evaluate necessity with Supabase auth |

---

## Progress Tracker

| Phase | Steps | Status |
|-------|-------|--------|
| **Phase 1: Core Features** | Steps 1–12 | In progress (4/12) |
| **Phase 2: Extended Features** | Steps 13–22 | Not started |
| **Phase 3: Hardening** | Steps 23–30 | Not started |
| **Phase 4: Infrastructure** | Steps 31–36 | Not started |
| **Phase 5: Polish** | Steps 37–45 | Not started |

**Last updated:** 2026-04-17
