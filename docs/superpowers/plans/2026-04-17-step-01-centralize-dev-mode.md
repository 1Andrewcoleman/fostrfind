# Step 1 — Centralize DEV_MODE + Remove `pg` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate 25 duplicate inline `DEV_MODE` definitions by exporting a single canonical `DEV_MODE` constant from `src/lib/constants.ts`, refactor `src/lib/supabase/middleware.ts` to use it, and remove the unused `pg` runtime dependency.

**Architecture:** Pure refactor — no behavior change. `DEV_MODE` becomes a single named export from `@/lib/constants`. All 25 inline declarations are replaced with an import; the 2 files that already import from `@/lib/constants` get `DEV_MODE` merged into the existing import; middleware's inline `url.startsWith('http')` check is replaced with `DEV_MODE`. No new tests (zero behavior change) — validation is tsc + eslint + grep-proof of removal + dev-server smoke test.

**Tech Stack:** TypeScript, Next.js 14, existing `@/lib/constants` module.

**Roadmap step:** [Phase 1 Step 1](../../roadmap.md#step-1-quick-wins--centralize-dev_mode--remove-dead-dependency)
**Estimated time:** 30–45 minutes
**TODO ref:** [§26 YELLOW](../../TODO.md#26-pre-launch-hardening)

---

## File Inventory

### Create
- None.

### Modify — single source of truth
- `src/lib/constants.ts` — add `export const DEV_MODE = ...`

### Modify — refactor to in-function DEV_MODE use
- `src/lib/supabase/middleware.ts` — replace inline `url.startsWith('http')` check with `DEV_MODE` import

### Modify — add new `import { DEV_MODE } from '@/lib/constants'` line (23 files, no existing constants import)
1. `src/lib/portal-identity.ts`
2. `src/lib/portal-layout-data.ts`
3. `src/app/login/page.tsx`
4. `src/app/signup/page.tsx`
5. `src/app/(foster)/layout.tsx`
6. `src/app/(shelter)/layout.tsx`
7. `src/app/(foster)/foster/browse/page.tsx`
8. `src/app/(foster)/foster/dog/[id]/page.tsx`
9. `src/app/(foster)/foster/applications/page.tsx`
10. `src/app/(foster)/foster/history/page.tsx`
11. `src/app/(foster)/foster/messages/page.tsx`
12. `src/app/(foster)/foster/messages/[applicationId]/page.tsx`
13. `src/app/(foster)/foster/profile/page.tsx`
14. `src/app/(shelter)/shelter/dashboard/page.tsx`
15. `src/app/(shelter)/shelter/applications/page.tsx`
16. `src/app/(shelter)/shelter/applications/[id]/page.tsx`
17. `src/app/(shelter)/shelter/dogs/page.tsx`
18. `src/app/(shelter)/shelter/dogs/[id]/page.tsx`
19. `src/app/(shelter)/shelter/messages/page.tsx`
20. `src/app/(shelter)/shelter/messages/[applicationId]/page.tsx`
21. `src/app/(shelter)/shelter/settings/page.tsx`
22. `src/components/auth-guard.tsx`
23. `src/components/role-guard.tsx`

### Modify — merge `DEV_MODE` into existing `@/lib/constants` import (2 files)
24. `src/components/shelter/dog-form.tsx` — already imports `DOG_AGES, DOG_SIZES, DOG_GENDERS`
25. `src/app/onboarding/page.tsx` — already imports `HOUSING_TYPES, EXPERIENCE_LEVELS`

### Modify — dependency hygiene
- `package.json` — remove `"pg": "^8.20.0"` from `dependencies`
- `package-lock.json` — regenerate via `npm install`

---

## Task 1: Export `DEV_MODE` from `src/lib/constants.ts`

**Files:**
- Modify: `src/lib/constants.ts` (append at bottom, after existing exports)

- [ ] **Step 1: Add `DEV_MODE` export**

Append to the end of `src/lib/constants.ts` (after line 44):

```ts

export const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')
```

Rationale: placing at end avoids disturbing the existing grouping (statuses → sizes → labels). `NEXT_PUBLIC_*` env vars are inlined at build time by Next.js, so evaluating at module scope is safe.

- [ ] **Step 2: Verify type check passes**

Run:
```bash
node node_modules/typescript/bin/tsc --noEmit
```
Expected: no new errors. (A couple of pre-existing errors may be present; note them but do not fix in this step.)

- [ ] **Step 3: Do not commit yet** — commit happens at end of step, after all replacements.

---

## Task 2: Refactor `src/lib/supabase/middleware.ts` to use `DEV_MODE`

**Files:**
- Modify: `src/lib/supabase/middleware.ts:1-13`

**Context:** Middleware does not declare `const DEV_MODE` at module scope — it pulls `url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''` inside `updateSession()` and checks `!url.startsWith('http')`. The roadmap's pitfall guidance: refactor to import `DEV_MODE` too.

- [ ] **Step 1: Add import and replace the inline check**

Replace the file's top of `updateSession` so it uses `DEV_MODE`. New file contents:

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { DEV_MODE } from '@/lib/constants'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Skip Supabase session refresh if credentials are not yet configured
  if (DEV_MODE) {
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session — do not remove this line
  await supabase.auth.getUser()

  return supabaseResponse
}
```

Changes from previous version:
- Added `import { DEV_MODE } from '@/lib/constants'`
- Removed `const url = ...` and `const key = ...` locals; use `process.env.*!` directly at the `createServerClient` call (matches style of `src/lib/supabase/server.ts` and `src/lib/supabase/client.ts`)
- Replaced `!url.startsWith('http')` with `DEV_MODE`
- Kept the "do not remove this line" comment

---

## Task 3: Replace inline `DEV_MODE` in 23 files with new import

**Files (23):** See the "Modify — add new import" list in File Inventory.

**Pattern for EVERY file in this task:**

Each file currently contains a single line like:
```ts
const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')
```
at module scope (between imports and the component/function).

**Replacement rule:**
1. Delete that line entirely.
2. Add `import { DEV_MODE } from '@/lib/constants'` to the import block at the top of the file. Place it grouped with other `@/lib/*` imports if present; otherwise place it last in the imports block.

- [ ] **Step 1: `src/lib/portal-identity.ts`**

Current line 5:
```ts
const DEV_MODE = !process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')
```
Delete line 5. Add to the imports block at top:
```ts
import { DEV_MODE } from '@/lib/constants'
```

- [ ] **Step 2: `src/lib/portal-layout-data.ts`** — same treatment (current line 7).

- [ ] **Step 3: `src/app/login/page.tsx`** — same treatment (current line 14).

- [ ] **Step 4: `src/app/signup/page.tsx`** — same treatment (current line 15).

- [ ] **Step 5: `src/app/(foster)/layout.tsx`** — same treatment (current line 8).

- [ ] **Step 6: `src/app/(shelter)/layout.tsx`** — same treatment (current line 8).

- [ ] **Step 7: `src/app/(foster)/foster/browse/page.tsx`** — same treatment (current line 27).

- [ ] **Step 8: `src/app/(foster)/foster/dog/[id]/page.tsx`** — same treatment (current line 23).

- [ ] **Step 9: `src/app/(foster)/foster/applications/page.tsx`** — same treatment (current line 6).

- [ ] **Step 10: `src/app/(foster)/foster/history/page.tsx`** — same treatment (current line 8).

- [ ] **Step 11: `src/app/(foster)/foster/messages/page.tsx`** — same treatment (current line 11).

- [ ] **Step 12: `src/app/(foster)/foster/messages/[applicationId]/page.tsx`** — same treatment (current line 8).

- [ ] **Step 13: `src/app/(foster)/foster/profile/page.tsx`** — same treatment (current line 6).

- [ ] **Step 14: `src/app/(shelter)/shelter/dashboard/page.tsx`** — same treatment (current line 11).

- [ ] **Step 15: `src/app/(shelter)/shelter/applications/page.tsx`** — same treatment (current line 6).

- [ ] **Step 16: `src/app/(shelter)/shelter/applications/[id]/page.tsx`** — same treatment (current line 13).

- [ ] **Step 17: `src/app/(shelter)/shelter/dogs/page.tsx`** — same treatment (current line 10).

- [ ] **Step 18: `src/app/(shelter)/shelter/dogs/[id]/page.tsx`** — same treatment (current line 9).

- [ ] **Step 19: `src/app/(shelter)/shelter/messages/page.tsx`** — same treatment (current line 11).

- [ ] **Step 20: `src/app/(shelter)/shelter/messages/[applicationId]/page.tsx`** — same treatment (current line 8).

- [ ] **Step 21: `src/app/(shelter)/shelter/settings/page.tsx`** — same treatment (current line 6).

- [ ] **Step 22: `src/components/auth-guard.tsx`** — same treatment (current line 8).

- [ ] **Step 23: `src/components/role-guard.tsx`** — same treatment (current line 9).

---

## Task 4: Merge `DEV_MODE` into existing `@/lib/constants` imports (2 files)

**Files (2):**
- `src/components/shelter/dog-form.tsx:29` already imports `DOG_AGES, DOG_SIZES, DOG_GENDERS` from `@/lib/constants`
- `src/app/onboarding/page.tsx:19` already imports `HOUSING_TYPES, EXPERIENCE_LEVELS` from `@/lib/constants`

**Pattern:** Delete the inline `const DEV_MODE = ...` line and **add `DEV_MODE`** to the existing import destructure — do NOT add a duplicate import statement.

- [ ] **Step 1: `src/components/shelter/dog-form.tsx`**

Change line 29 from:
```ts
import { DOG_AGES, DOG_SIZES, DOG_GENDERS } from '@/lib/constants'
```
To:
```ts
import { DEV_MODE, DOG_AGES, DOG_SIZES, DOG_GENDERS } from '@/lib/constants'
```
Delete the inline `const DEV_MODE = ...` line (current line 52).

- [ ] **Step 2: `src/app/onboarding/page.tsx`**

Change line 19 from:
```ts
import { HOUSING_TYPES, EXPERIENCE_LEVELS } from '@/lib/constants'
```
To:
```ts
import { DEV_MODE, HOUSING_TYPES, EXPERIENCE_LEVELS } from '@/lib/constants'
```
Delete the inline `const DEV_MODE = ...` line (current line 23).

---

## Task 5: Remove `pg` dependency

**Files:**
- Modify: `package.json:32`
- Modify: `package-lock.json` (regenerated)

- [ ] **Step 1: Remove `pg` from `package.json`**

Delete line 32 of `package.json`:
```
    "pg": "^8.20.0",
```
Leave the surrounding lines and the trailing comma on the preceding line correct (no dangling commas; JSON must remain valid).

- [ ] **Step 2: Regenerate lockfile**

Run:
```bash
npm install
```
Expected: `pg` entries removed from `package-lock.json`; no errors. `npm` may warn about peer deps — warnings unrelated to `pg` are acceptable.

- [ ] **Step 3: Verify `pg` is truly unused**

Run:
```bash
grep -rn "from 'pg'" src/
grep -rn "require('pg')" src/
grep -rn '"pg"' package-lock.json | head
```
Expected:
- Both `grep -rn "... 'pg'" src/` commands return 0 hits (confirms no imports).
- `package-lock.json` no longer references `"pg":` as a top-level package key (only possibly as a transitive sub-dep, which is fine).

---

## Task 6: End-of-Step Validation

All checks must pass before commit.

- [ ] **Step 1: Verify no inline DEV_MODE remains**

Run:
```bash
grep -rn "const DEV_MODE" src/
```
Expected: **0 results**.

Also run:
```bash
grep -rn "NEXT_PUBLIC_SUPABASE_URL?.startsWith" src/
```
Expected: **only `src/lib/constants.ts`** appears (the one canonical definition).

- [ ] **Step 2: Type check**

Run:
```bash
node node_modules/typescript/bin/tsc --noEmit
```
Expected: No new errors introduced. (Record any pre-existing errors so they can be distinguished from regressions — they are not fixed in this step.)

- [ ] **Step 3: Lint**

Run:
```bash
node node_modules/eslint/bin/eslint.js src/
```
Expected: No new warnings/errors. Pre-existing warnings acceptable.

- [ ] **Step 4: Dev server smoke test**

Run:
```bash
node node_modules/next/dist/bin/next dev
```
Expected: Compiles successfully, serves on `http://localhost:3000` without runtime errors. Manually verify at least one route loads (e.g., `/` landing page). Stop with Ctrl+C.

- [ ] **Step 5: Staged diff review**

Run:
```bash
git status
git diff --stat
git diff -- package.json src/lib/constants.ts src/lib/supabase/middleware.ts
```
Expected:
- 27 files changed (25 replacement sites + `constants.ts` + `middleware.ts` + `package.json` + `package-lock.json` = 29; delta-count may vary).
- `constants.ts` adds exactly one new export line.
- `middleware.ts` adds one import line and collapses the env-var locals.
- `package.json` removes exactly the `pg` line.
- No stray edits outside the listed files.

- [ ] **Step 6: Write-Review-Fix 7-question sweep**

Mentally walk the diff against the roadmap's 7 questions:
1. Does this break anything? — Refactor only; behavior preserved. Middleware still returns early in DEV_MODE; all `if (DEV_MODE)` branches still function identically.
2. Implicit assumptions? — `DEV_MODE` is evaluated at module load, same as before. Still Next.js inlines `NEXT_PUBLIC_*`.
3. Error path? — No error paths touched. Middleware still falls through to `createServerClient` when not in DEV_MODE.
4. Consistent with codebase? — Uses same `@/lib/constants` import style as `dog-form.tsx`, `browse-dog-card.tsx`, etc.
5. Code-review worthy? — One canonical source; no dead code; no stray `console.log` / debug.
6. Race conditions? — None; module-scope constant.
7. DEV_MODE path handled? — This IS the DEV_MODE path. Every call site preserves its existing DEV_MODE branch.

If any answer is "no," fix before proceeding.

---

## Task 7: Check roadmap box + commit

- [ ] **Step 1: Check Step 1 box on the roadmap**

In `docs/roadmap.md`, locate the Step 1 section header (`### Step 1: Quick Wins — Centralize DEV_MODE + Remove Dead Dependency`). The roadmap currently tracks phase-level completion only (not per-step `[ ]`), so: update the "Progress Tracker" table at the end of the file to mark Phase 1 as "In progress (1/12)".

Specifically, change the row:
```
| **Phase 1: Core Features** | Steps 1–12 | Not started |
```
To:
```
| **Phase 1: Core Features** | Steps 1–12 | In progress (1/12) |
```
And update the "Last updated" date at the bottom to today.

- [ ] **Step 2: Stage changes**

Run:
```bash
git add -- src/ package.json package-lock.json docs/roadmap.md
git status
```
Expected: All 27+ modified files staged; no untracked files staged.

- [ ] **Step 3: Commit**

Run:
```bash
git commit -m "$(cat <<'EOF'
refactor: centralize DEV_MODE constant, remove unused pg dep

Exports DEV_MODE from src/lib/constants.ts as the single source of
truth. Replaces 25 inline duplicate declarations with an import; also
refactors src/lib/supabase/middleware.ts to use the shared constant.
Removes the unused pg runtime dependency. Pure refactor — no behavior
change. (Roadmap Phase 1 Step 1, §26 YELLOW)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```
Expected: commit succeeds; no pre-commit hook failures.

- [ ] **Step 4: Final sanity**

Run:
```bash
git log --oneline -1
grep -rn "const DEV_MODE" src/
```
Expected:
- HEAD shows the new refactor commit.
- Zero inline `const DEV_MODE` remain.

---

## Self-Review Checklist (post-plan)

1. **Spec coverage:** Roadmap Step 1 has three deliverables — centralize DEV_MODE, refactor middleware, remove pg. All three are covered (Tasks 1–2, 3–4, 5).
2. **Placeholder scan:** No "TBD" / "TODO" / "implement later" / "similar to X" text anywhere in the plan.
3. **Type consistency:** `DEV_MODE` is a single boolean exported from `@/lib/constants`; type is `boolean` (inferred). Consumers destructure identically at every site.
4. **Ambiguity:** Two merged-import cases (Task 4) are called out explicitly so the engineer doesn't accidentally create duplicate import statements.
