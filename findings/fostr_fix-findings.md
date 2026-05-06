# Security Audit — fostr_fix

**Scanned**: 2026-05-05 (UTC)  
**Target**: `/Users/andrewlovellecoleman/Downloads/fostr_fix`  
**Scope**: Next.js 14 App Router application — API routes, guards, middleware, Supabase usage, security headers, and selected libraries (static review; no live penetration test).  
**Out of scope**: Remote Supabase RLS verification against a running project; CVE listing without reachability proof; testing a deployed host; contents of gitignored `.env.local`.

## Executive Summary

This pass applied the zero-day-finder workflow (recon, trust boundaries, tiered review, cross-file checks, verification). The codebase shows deliberate hardening patterns: `validateMutationRequest` on nearly all mutations, Zod on JSON bodies, retired client-triggered email (`/api/notifications/send` returns 410 with explanation), service-role use confined and documented, and `validateEnv()` refusing **production** boots when `DEV_MODE` would otherwise disable `AuthGuard` / `RoleGuard` (see `src/lib/env.ts` and `src/app/layout.tsx`).

The standout gap is **consistency**: **`POST /api/account/delete` never calls `validateMutationRequest`**, unlike every other authenticated mutation under `src/app/api`. That weakens the optional Origin / Content-Type CSRF layer on the most destructive user action. Severity is **medium**, not critical, because browsers often omit `SameSite=None` cookies on cross-site POSTs and the app’s own comment documents that behaviour as policy-dependent — but the route should still match the rest of the API surface.

Secondary: **rate limits are in-process only** (`src/lib/rate-limit.ts`), so limits are shard-bypassable on serverless/multi-instance hosts. The file already documents this and sketches Upstash; treating it as **low** impact (abuse / cost) rather than confidentiality loss.

## Severity at a Glance

| Severity | Count | Tier 1 | Tier 2 | Tier 3 |
|----------|-------|--------|--------|--------|
| Critical | 0 | 0 | 0 | 0 |
| High     | 0 | 0 | 0 | 0 |
| Medium   | 1 | 1 | 0 | 0 |
| Low      | 1 | 0 | 1 | 0 |
| Info     | 0 | 0 | 0 | 0 |

## Medium Findings

### ZDF-001 — POST /api/account/delete omits validateMutationRequest (CSRF gap vs other mutations)

**Severity**: Medium · **Tier**: 1 · **Confidence**: Confirmed · **Category**: csrf · **CWE**: CWE-352

**Summary**: `src/lib/api-security.ts` defines `validateMutationRequest` for authenticated mutation handlers. Grep shows use across ratings, reports, applications, messages, uploads, etc. `src/app/api/account/delete/route.ts` authenticates and validates the body but **does not** invoke this guard.

**Trace**:

1. `src/lib/api-security.ts:23` — `validateMutationRequest` contract for mutation routes.  
2. `src/app/api/account/delete/route.ts:34` — `POST` begins with JSON parse; no guard call.  
3. `src/app/api/applications/route.ts:44` — representative sibling calls the guard first.

**Exploit Scenario**: A victim who is logged in visits or is redirected to attacker-controlled content that issues a `POST` to `/api/account/delete` with `{"confirm":"DELETE"}`. If the session cookie is attached, the server runs `prepare_account_deletion` and `auth.admin.deleteUser` for that user.

**PoC Sketch**: From another origin, with the victim session present, `fetch(appOrigin + '/api/account/delete', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'DELETE' }) })`. Compare results with production cookie attributes.

**Preconditions**: Active session; cookie sent on the forged request; victim loads attacker context.

**Impact**: Irreversible account deletion and related cleanup.

**Constraints**: `SameSite=Lax` (common) often prevents cookie attachment on cross-site `POST` from third-party pages; explicit CSRF defence should not rely on this alone.

**Fix**: Call `validateMutationRequest(request)` at the top of `POST` (same as other routes), or implement a first-class CSRF token for JSON APIs.

```diff
+import { validateMutationRequest } from '@/lib/api-security'
+
 export async function POST(request: Request): Promise<NextResponse> {
+  const guardErr = validateMutationRequest(request)
+  if (guardErr) return guardErr
   let body: z.infer<typeof bodySchema>
```

---

## Low Findings

### ZDF-002 — Process-local API rate limiting bypassable across serverless instances

**Severity**: Low · **Tier**: 2 · **Confidence**: Confirmed · **Category**: rate-limit-bypass · **CWE**: CWE-770

**Summary**: `rateLimit()` uses a module-level `Map`. Each isolate/replica has its own counters, so aggregate abuse limits are not global.

**Trace**:

1. `src/lib/rate-limit.ts:81` — `const buckets = new Map<string, Bucket>()`.  
2. `src/lib/rate-limit.ts:4–10` — documented production hardening note and migration path.

**Exploit Scenario**: Parallel traffic spread across instances stays under per-instance thresholds while exceeding the intended global cap.

**Impact**: Abuse of notifications, uploads, invites, etc., not direct cross-tenant data read.

**Fix**: Adopt distributed rate limiting (commented Upstash sketch in-file).

---

## Hardening Recommendations

- **HR-001**: Revisit `script-src 'unsafe-eval'` for production-only CSP in `next.config.mjs` once Next/Sentry nonce workflow allows.  
- **HR-002**: Add CI Semgrep rule: new handler under `src/app/api/**/route.ts` with `POST` / `PATCH` / `DELETE` should reference `validateMutationRequest` (with explicit exceptions list).  
- **HR-003**: Redact or hash user ids in structured logs for `/api/reports` if compliance requires it.

## Uncertainties / Recommended Follow-up

- Confirm **Supabase cookie** `SameSite` / `Secure` in the hosted project to calibrate ZDF-001.  
- Run **Semgrep** (OWASP / custom), **CodeQL**, and **`npm audit`** / **OSV-Scanner** on CI; this review did not exhaust dependency reachability.  
- **Dynamic test** with Burp or browser devtools against a staging host for CSRF repro on real cookies.  
- **`gitleaks` / `trufflehog`** on full git history for leaked service role keys.

## Appendix: Methodology

Phases: recon (`zero-day-finder/scripts/recon.sh`), trust boundary mapping (HTTP APIs, OAuth callback, uploads, service role), Tier 1–3-style review, grep-backed variant check for `validateMutationRequest` and `createServiceClient`, verification against `validateEnv` production guard. No automated SAST tools were executed in this session beyond recon script output.
