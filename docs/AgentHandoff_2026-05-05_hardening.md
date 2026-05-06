# Agent Handoff · 2026-05-05 — Product Hardening Audit & Full Remediation

Full-stack security and production-readiness audit followed by complete implementation of every finding. All work is on `main` (commit `68a9150`).

**Repo state at handoff:** working tree clean on `main`. 79 files changed, 8 new Supabase migrations, all 206 tests pass, `next build` and `tsc --noEmit` both exit 0, `npm audit --audit-level=high` exits 0.

---

## 1. Things that MUST stay true going forward

These are security invariants introduced in this session. Do not undo them.

### 1.1 Transition RPCs now enforce ownership inside SQL

[`20240120_harden_transition_rpcs.sql`](../supabase/migrations/20240120000000_harden_transition_rpcs.sql) rewrote `accept_application`, `complete_application`, and `relist_dog` in plpgsql. Each function now joins to `shelters` and requires `s.user_id = auth.uid()` plus valid source-state checks before executing any UPDATE. A SQL exception is raised on unauthorized or invalid-state calls.

**Do not simplify these back to plain SQL functions** — the ownership check inside the function body is the only thing preventing direct PostgREST RPC calls from bypassing the Next.js API route authorization checks. The API route checks are defense-in-depth, not the only line.

PUBLIC execute was also revoked from all three functions. The `authenticated` grant remains — the Next.js routes call them as the signed-in shelter user's client.

### 1.2 All SECURITY DEFINER helpers have explicit PUBLIC revokes

[`20240121_harden_function_grants.sql`](../supabase/migrations/20240121000000_harden_function_grants.sql) explicitly revokes PUBLIC/anon execute from `get_my_foster_ids`, `get_my_shelter_ids`, `get_my_applied_dog_ids`, `get_save_counts_for_my_dogs`, `distance_miles`, and `handle_updated_at`. This was verified in the live database.

When adding new SECURITY DEFINER functions, always follow this pattern:
```sql
REVOKE ALL ON FUNCTION public.your_func(...) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.your_func(...) TO authenticated; -- or anon if truly public
```

### 1.3 `prepare_account_deletion` is service-role only

[`20240125_account_deletion_cleanup.sql`](../supabase/migrations/20240125000000_account_deletion_cleanup.sql) creates a transactional cleanup RPC. The [`/api/account/delete`](../src/app/api/account/delete/route.ts) route calls it via the service-role client before deleting the auth user. If the RPC fails, auth deletion is aborted.

Both `anon` and `authenticated` execute were revoked and verified at 0 rows in the live database. **Never grant execute on this function to `anon` or `authenticated`** — it anonymizes any user's data given a UUID.

### 1.4 `/api/notifications/send` is permanently disabled

[`src/app/api/notifications/send/route.ts`](../src/app/api/notifications/send/route.ts) now returns 410 Gone. The original route let any authenticated user send transactional email to arbitrary addresses. All email sending now lives in domain-specific server routes that derive recipients from authorized DB records. Do not re-open a generic dispatcher.

### 1.5 All mutation routes have origin/content-type guards and private cache headers

[`src/lib/api-security.ts`](../src/lib/api-security.ts) exports `validateMutationRequest(request, allowedContentTypes?)`. It rejects requests with an explicitly wrong `Origin` (when `NEXT_PUBLIC_APP_URL` is set) and rejects explicit wrong Content-Type. Absence of Content-Type is allowed (bodyless action routes).

[`src/lib/api-response.ts`](../src/lib/api-response.ts) exports `privateJson(body, init?)` which sets `Cache-Control: no-store, private`. Every authenticated mutation and read API uses `privateJson` for success responses.

Every new API route must call `validateMutationRequest` and use `privateJson`.

### 1.6 Storage INSERT policy now enforces path shape

[`20240124_restrict_public_columns.sql`](../supabase/migrations/20240124000000_restrict_public_columns.sql) replaced the permissive storage INSERT policy. Direct Supabase Storage uploads are now rejected unless the object name matches `{auth.uid()}/{uuid}.(jpg|png|webp)`. The Next.js upload route already generates this path — the policy closes the direct-bypass gap.

### 1.7 Shelter EIN is blocked from the anon role

[`20240127_post_verification_fixes.sql`](../supabase/migrations/20240127000000_post_verification_fixes.sql) revokes table-level SELECT on `shelters` from `anon` and re-grants only the public-safe columns (excludes `ein` and `user_id`). This was necessary because column-level `REVOKE SELECT (col)` does not work against a table-level `GRANT SELECT`. Verified in the live database: `SELECT ein FROM public.shelters` as `anon` returns `ERROR: 42501: permission denied`.

**Do not add a blanket `GRANT SELECT ON public.shelters TO anon`** — that would undo this protection. If new columns are added to `shelters` that should be publicly readable, add them to the column-level grant in a new migration.

### 1.8 Production fails closed if DEV_MODE would activate

[`src/lib/env.ts`](../src/lib/env.ts) `validateEnv()` now throws if `NODE_ENV === 'production'` and `NEXT_PUBLIC_SUPABASE_URL` is missing or not http-prefixed. This prevents a misconfigured production deployment from silently bypassing `AuthGuard` and `RoleGuard`.

### 1.9 Image uploads use magic-byte validation on the server

[`src/lib/storage.ts`](../src/lib/storage.ts) exports two validation functions:
- `validateImageFileFast(file)` — synchronous, trusts `file.type`, for client-side UX only
- `validateImageFile(file)` — async, reads actual JPEG/PNG/WebP magic bytes, for server routes

The `/api/upload/photo` route uses the async version. Client components (`avatar-logo-field.tsx`, `dog-form.tsx`) use the fast sync version. **Do not use `validateImageFileFast` in server routes** — it trusts the client-supplied MIME type.

---

## 2. What was shipped

### 2.1 Audit artifacts (read-only reference)

| File | Contents |
|---|---|
| [`hardening-output/hardening-audit.md`](../hardening-output/hardening-audit.md) | Full audit report — 23 findings across 10 domains |
| [`hardening-output/hardening-dashboard.html`](../hardening-output/hardening-dashboard.html) | Severity distribution dashboard |
| [`hardening-output/fixit-roadmap.md`](../hardening-output/fixit-roadmap.md) | Per-finding fix plan with before/after code and verification protocols |

### 2.2 New Supabase migrations (apply in order if re-bootstrapping)

| Migration | What it does |
|---|---|
| `20240120` | Harden lifecycle transition RPCs with auth.uid() ownership checks |
| `20240121` | Revoke PUBLIC execute from all SECURITY DEFINER helper functions |
| `20240122` | Strengthen ratings/shelter_ratings INSERT RLS; narrow ratings SELECT to participants |
| `20240123` | Invite immutability trigger; fix author_user NOT NULL contradiction |
| `20240124` | Revoke EIN/user_id from anon; enforce storage path shape |
| `20240125` | Transactional account deletion RPC |
| `20240126` | Report triage columns and summary view |
| `20240127` | Post-verification fixes: table-level anon SELECT revoke + function execute revoke |

### 2.3 New source files

| File | Purpose |
|---|---|
| `src/lib/api-security.ts` | `validateMutationRequest` — origin + content-type guard |
| `src/lib/api-response.ts` | `privateJson` — no-store/private cache header wrapper |
| `.github/dependabot.yml` | Weekly npm security dependency updates |
| `docs/data-privacy-policy.md` | PII inventory, retention windows, deletion flow |
| `docs/incident-runbook.md` | Backup/restore, Realtime checks, rollback, failure playbooks |
| `docs/launch-capacity-plan.md` | Service limits, breaking points, pre-launch checklist |

### 2.4 Dependency upgrade

`next` was upgraded from `14.2.35` to `15`. All dynamic page components and API route handlers updated from `params: { id: string }` to `params: Promise<{ id: string }>` with `await`. The upgrade cleared all high-severity npm advisories (`npm audit --audit-level=high` now exits 0 with 2 moderate remaining).

---

## 3. What is NOT done yet (deferred)

These are deliberate deferrals — not missed work.

| Item | Status | Tracking |
|---|---|---|
| Distributed rate limiting (Upstash Redis) | Deferred | `src/lib/rate-limit.ts` has full migration instructions inline |
| Report triage admin UI | Deferred | DB foundation in place (`20240126`); UI blocked on admin role model decision |
| User data export (`GET /api/account/export`) | Deferred | Documented in `docs/data-privacy-policy.md` |
| Notification invite/expiry batch cleanup jobs | Deferred | Documented in `docs/data-privacy-policy.md` |
| Backup restore drill | Deferred | Documented in `docs/incident-runbook.md` |
| `DELETE /api/shelter/[id]` shelter removal | Deferred | Not in audit scope; existed before this session |
| `user_id` column still visible to authenticated (not anon) | Accepted | Shelter owners need user_id for their own row; non-owners get RLS-filtered empty results |

---

## 4. Things to do next

Before the first real user is onboarded:

1. **Set up Upstash Redis** — follow the migration instructions in `src/lib/rate-limit.ts` and replace the in-memory limiter before enabling multi-instance/serverless deployment.
2. **Run the backup restore drill** — `docs/incident-runbook.md` has the step-by-step procedure. Apply to a staging project.
3. **Verify Realtime RLS** — in Supabase Dashboard → Database → Replication → supabase_realtime, confirm `messages` is listed and that "Realtime RLS" is enabled.
4. **Upgrade Supabase and Resend plans** — the free tiers will break under moderate load. See `docs/launch-capacity-plan.md`.
5. **Ship the report triage admin UI** — safety reports are being filed to a DB table but no one can see them without a superuser SQL query. This is a blocker before public launch if safety issues arise.
