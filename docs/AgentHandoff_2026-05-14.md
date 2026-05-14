# Agent Handoff — 2026-05-14

## What Was Done This Session

Three security fixes identified in the previous session's auth-layer review were implemented, each on its own branch targeting `claude/security-review-7LD4k`.

### PR 1 — DEV_MODE Fail-Open Fix
**Branch:** `claude/auth-fix-1-devmode`  
**Commit:** `fix(security): make DEV_MODE an explicit opt-in flag`  
**Status:** Pushed to origin

`DEV_MODE` in `src/lib/constants.ts:84` was derived from the absence of `NEXT_PUBLIC_SUPABASE_URL`, causing it to evaluate `true` on any deploy with a missing or rotated env var. This silently bypassed all auth guards (AuthGuard, RoleGuard, middleware) and ~42 other files that check `DEV_MODE` before gating content.

**Files changed:**
- `src/lib/constants.ts:84` — `DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true'`
- `src/lib/env.ts` — updated comment; tightened prod guard to also throw when `NEXT_PUBLIC_SUPABASE_URL` starts with `http` and `NEXT_PUBLIC_DEV_MODE=true` (catches preview/staging where `NODE_ENV` may not be `'production'`)
- `.env.example` — added `NEXT_PUBLIC_DEV_MODE=true` with "local dev only" comment

**Breaking change for developers:** Anyone running locally without `NEXT_PUBLIC_DEV_MODE=true` in `.env.local` will now get auth errors rather than silently entering DEV_MODE. They must add `NEXT_PUBLIC_DEV_MODE=true` to `.env.local`.

---

### PR 2 — Dual-Role Privilege Escalation Fix
**Branch:** `claude/auth-fix-2-dual-role`  
**Commit:** `fix(security): enforce single-role-per-user at DB and API layers`  
**Status:** Pushed to origin

No DB constraint prevented a user from holding both a `shelters` row and a `foster_parents` row. `RoleGuard` granted both-portal access if both rows existed, enabling a user to submit applications to their own shelter and see other fosters' data.

**Files changed:**
- `supabase/migrations/20240128000000_prevent_dual_role.sql` — new; BEFORE INSERT trigger on both tables via `prevent_dual_role()` SECURITY DEFINER function
- `src/app/api/onboarding/shelter/route.ts` — cross-role check against `foster_parents` after same-role check (→ 409)
- `src/app/api/onboarding/foster/route.ts` — cross-role check against `shelters` after same-role check (→ 409)
- `src/components/role-guard.tsx` — dual-role detection: `if (isShelter && isFoster) redirect('/')`
- `src/app/api/onboarding/shelter/__tests__/route.test.ts` — new test case for cross-role 409
- `src/app/api/onboarding/foster/__tests__/route.test.ts` — new test case for cross-role 409

**Note:** The migration must be applied to the Supabase project (`supabase db push` or SQL editor). Committing to the repo does not change a remote database.

---

### PR 3 — Callback Redirect Origin Hardening
**Branch:** `claude/auth-fix-3-callback-redirect`  
**Commit:** `fix(security): derive auth callback redirect base from trusted env var`  
**Status:** Pushed to origin

`src/app/auth/callback/route.ts` derived all redirect targets from `new URL(request.url).origin`. Behind a misconfigured proxy forwarding an attacker-controlled `Host` header, this could redirect a victim's post-auth session to an attacker domain.

**Files changed:**
- `src/app/auth/callback/route.ts` — `origin` replaced with `base` derived from `process.env.NEXT_PUBLIC_APP_URL`; fallback to `new URL(request.url).origin` only when `NEXT_PUBLIC_APP_URL` is unset (local dev). Added `safeDest` validation to ensure `getPostAuthDestination()` always returns a relative path.

---

## Environment Notes (Persistent)

- **No `node_modules`** at session start — run `npm install` before any type-check or test commands.
- **`node_modules/.bin/` is broken** — use full paths:
  - TypeScript: `node node_modules/typescript/bin/tsc --noEmit`
  - Tests: `npm test`
  - Lint: `npm run lint` (Next.js lint) — **currently broken in this environment**; `next lint` errors with "Invalid project directory provided". Pre-existing issue, not introduced by these changes.
- **Pre-existing TS errors** in `src/app/api/account/delete/__tests__/route.test.ts` (4 `TS2352` errors on lines 83, 95, 170, 183). These existed before this session's work and are unrelated.
- **`tsconfig.json` and `package-lock.json`** are auto-modified by `npm install`. Do not commit these changes — restore them with `git restore tsconfig.json package-lock.json` if they appear in `git status`.

## Current Branch State

| Branch | Status |
|--------|--------|
| `claude/security-review-7LD4k` | Base; no changes from `main` beyond previous hardening migrations |
| `claude/auth-fix-1-devmode` | Pushed; ready for PR |
| `claude/auth-fix-2-dual-role` | Pushed; ready for PR |
| `claude/auth-fix-3-callback-redirect` | Pushed; ready for PR |

Each branch diverges from `claude/security-review-7LD4k`, not from each other. When merging, merge in order (PR 1 first since it changes `constants.ts` which everything imports, then PRs 2 and 3 in any order).

## What's Next

1. **Create PRs on GitHub** targeting `claude/security-review-7LD4k` for each of the three fix branches.
2. **Apply the migration** `20240128000000_prevent_dual_role.sql` to the Supabase project.
3. **Test `NEXT_PUBLIC_DEV_MODE`** — verify developers know to add it to `.env.local` to run locally.
4. **Merge PR 1 before PR 2 or PR 3** to avoid merge conflicts on `constants.ts`.
5. **Remaining auth hardening** (from the security review, not part of this session):
   - MFA enforcement for shelter staff
   - Breach detection / compromised password detection
   - RLS policy audit for `shelter_foster_invites` cross-table reads
