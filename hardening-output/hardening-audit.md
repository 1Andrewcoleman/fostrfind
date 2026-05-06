# Product Hardening Audit Report

Generated: 2026-05-05

## System Architecture Summary

Fostr Find is a Next.js 14 App Router application with separate shelter and foster portal route groups. Authentication is Supabase Auth via `@supabase/ssr`; portal access is enforced by server components (`src/components/auth-guard.tsx`, `src/components/role-guard.tsx`) and most mutations are implemented as Next.js route handlers under `src/app/api`.

The data layer is Supabase Postgres with Row Level Security enabled in SQL migrations. Core tables include `shelters`, `dogs`, `foster_parents`, `applications`, `ratings`, `messages`, roster/invite tables, reports, dog saves, and notifications. Several `SECURITY DEFINER` SQL functions exist to break RLS recursion and to perform atomic application/dog status transitions. Public media is stored in Supabase Storage buckets (`dog-photos`, `shelter-logos`, `foster-avatars`). Email delivery uses Resend, wrapped by `src/lib/email.ts`, with Sentry configured for error capture in production.

Security controls already present: server-side Supabase `getUser()` checks on most API routes, Zod validation on newer mutation routes, RLS on application tables, unique constraints for duplicate applications/ratings/profile rows, column-level update grants for messages/notifications, environment validation at boot, and a project-wide TypeScript strict mode.

Primary risk posture: the app has solid intent and many good controls, but several controls live only in the Next.js API layer while the Supabase API remains directly callable by any holder of the anon key and a user JWT. The most urgent fixes belong in database function authorization, storage policies, public email-trigger authorization, security headers, dependency updates, and production-grade rate limiting.

## Audit Findings

### 1. Authentication & Access Control

#### Finding 1.1 — Exposed `SECURITY DEFINER` transition RPCs bypass API authorization

**Severity:** CRITICAL

**Where:** `supabase/migrations/20240110000000_atomic_transitions.sql:52-145`; API callers at `src/app/api/applications/[id]/accept/route.ts:76-84`, `src/app/api/applications/[id]/complete/route.ts:69-75`, `src/app/api/dogs/[id]/status/route.ts:95-103`.

**What is wrong:** `accept_application`, `complete_application`, and `relist_dog` run as `SECURITY DEFINER` and update `applications`/`dogs` without checking the caller. The API routes do ownership and state checks before calling them, but Supabase RPCs are public API surfaces. The migration grants execute to `authenticated`, and it does not revoke default `PUBLIC` execution.

**Exploit scenario:**

```bash
curl "$SUPABASE_URL/rest/v1/rpc/accept_application" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANY_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"app_id":"TARGET_APPLICATION_UUID"}'
```

If the UUID is known or leaked through normal portal usage, a foster or unrelated account can accept, complete, or re-list another shelter's records without passing the Next.js route checks. If `PUBLIC` execute remains in place, anonymous execution may also be possible depending on exposed schema permissions.

**Business impact:** Unauthorized dog placement status changes, falsified application history, foster/shelter notification cascades, operational confusion, and loss of trust in the platform's matching workflow.

**Fix:** Revoke function execution from `PUBLIC`, grant only the intended role, and move ownership/state checks into the SQL functions themselves using `auth.uid()`. Prefer command-specific functions such as `accept_application(app_id uuid)` that update only when the caller owns the shelter and the current status is valid; return an affected row count or raise an exception when no authorized transition exists.

**Effort estimate:** Moderate (1 day).

#### Finding 1.2 — `DEV_MODE` disables auth if production Supabase URL is missing or malformed

**Severity:** MEDIUM

**Where:** `src/lib/constants.ts:84`, `src/components/auth-guard.tsx:28-30`, `src/components/role-guard.tsx:16-18`, `src/lib/supabase/middleware.ts:8-11`.

**What is wrong:** `DEV_MODE` is determined solely by `!process.env.NEXT_PUBLIC_SUPABASE_URL?.startsWith('http')`. In that mode, portal auth guards and middleware session refresh are bypassed. `validateEnv()` currently returns early in `DEV_MODE` even when `NODE_ENV === 'production'`.

**Exploit scenario:** A production deployment with a missing, empty, or typoed Supabase URL ships with the portal browsable and server component guards skipped. API writes mostly fail because Supabase is unavailable, but private portal pages and placeholder/dev data can still be exposed.

**Business impact:** Misconfiguration turns into an access-control bypass rather than a failed deployment.

**Fix:** Make `DEV_MODE` impossible in production. In `src/lib/env.ts`, if `process.env.NODE_ENV === 'production'` and the Supabase URL is missing or invalid, throw before rendering. Keep the zero-config dev UX only for non-production builds.

**Effort estimate:** Quick fix (< 1 hour).

#### Finding 1.3 — OAuth callback does not explicitly validate `state`

**Severity:** LOW

**Where:** `src/app/auth/callback/route.ts:6-43`.

**What is wrong:** The route exchanges any `code` query parameter with Supabase and redirects based on resulting profile. Supabase's SDK/provider flow may validate PKCE/state internally, but the app does not document or assert callback state validation.

**Exploit scenario:** If provider or Supabase settings are loosened later, an attacker could attempt login CSRF or session swapping by making a victim visit a callback URL containing an attacker's code.

**Business impact:** Account confusion or wrong-account session establishment.

**Fix:** Verify Supabase Auth settings use PKCE/state and restrict redirect URLs to known domains. Add an audit note/test for OAuth callback state and redirect allowlisting.

**Effort estimate:** Quick fix (< 1 hour).

### 2. Input Validation & Injection Defense

#### Finding 2.1 — Public storage upload policies allow direct bypass of server validation

**Severity:** HIGH

**Where:** `supabase/migrations/20240112000000_storage_buckets.sql:37-58`; server route at `src/app/api/upload/photo/route.ts:70-96`; helper at `src/lib/storage.ts:29-35`.

**What is wrong:** The Next.js upload route validates bucket name, MIME type, size, and forces `{userId}/{uuid}.{ext}`. But the Supabase Storage policy allows any authenticated user to insert into any of the three public buckets without enforcing user-folder ownership, file size, MIME type, or path structure.

**Exploit scenario:**

```bash
curl "$SUPABASE_URL/storage/v1/object/dog-photos/victim-folder/payload.svg" \
  -X POST \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $ANY_USER_JWT" \
  -H "Content-Type: image/svg+xml" \
  --data-binary @payload.svg
```

The object is stored in a public bucket even though the app route would have rejected it.

**Business impact:** Storage quota abuse, public hosting of arbitrary content under your Supabase domain, possible SVG/script content distribution, brand abuse, and cleanup burden.

**Fix:** Tighten storage `INSERT` policy so `auth.uid()::text = (storage.foldername(name))[1]`; add `WITH CHECK` constraints for bucket, top-level folder, and allowed extension/path pattern. If Supabase policy cannot enforce file size/content type sufficiently, route uploads through a signed-upload flow or private bucket with server-mediated promotion.

**Effort estimate:** Moderate (1 day).

#### Finding 2.2 — Image validation trusts browser-provided MIME type and client-side processing

**Severity:** MEDIUM

**Where:** `src/lib/storage.ts:13-16`, `src/lib/storage.ts:29-35`, `src/app/api/upload/photo/route.ts:78-96`.

**What is wrong:** Server-side validation checks `file.type`, which is client-controlled. Comments state image resize/EXIF stripping happens client-side. Attackers can bypass client code and submit mislabeled or malformed files.

**Exploit scenario:** An attacker posts a polyglot file or renamed payload with `Content-Type: image/jpeg`. The server accepts it based on metadata and stores it publicly.

**Business impact:** Malicious content hosting, privacy leakage through EXIF if client-side stripping fails, and image parser risk if future server-side processing is added.

**Fix:** Validate magic bytes server-side with a library such as `file-type`, decode/re-encode images server-side with `sharp` where practical, strip EXIF, and reject SVG entirely unless sanitized.

**Effort estimate:** Moderate (1 day).

#### Finding 2.3 — Regex text sanitization is not safe for future HTML rendering

**Severity:** LOW

**Where:** `src/lib/sanitize.ts:9-12`, `src/lib/sanitize.ts:24-55`.

**What is wrong:** The sanitizer strips tag-shaped substrings with regex. Current React rendering escapes user content, so this is mostly defense-in-depth today, but the helper's name can invite future use as an HTML sanitizer.

**Exploit scenario:** A future feature renders sanitized report or message bodies with `dangerouslySetInnerHTML`. Regex stripping is bypassable with malformed HTML/entities and would become stored XSS.

**Business impact:** XSS risk if future rendering assumptions change.

**Fix:** Rename helpers to make their limited purpose explicit or add a real sanitizer (`sanitize-html` server-side, DOMPurify client-side) before any raw HTML/markdown rendering.

**Effort estimate:** Quick fix (< 1 hour).

### 3. API Security

#### Finding 3.1 — Authenticated users can send arbitrary transactional emails

**Severity:** HIGH

**Where:** `src/app/api/notifications/send/route.ts:13-30`, `src/app/api/notifications/send/route.ts:172-226`.

**What is wrong:** `/api/notifications/send` authenticates the caller and validates the template shape, but it does not verify that the caller is authorized to notify the requested recipient or that the template data matches real application/invite/message records. The body includes arbitrary `to` and `data`.

**Exploit scenario:**

```bash
curl https://app.example.com/api/notifications/send \
  -X POST \
  -H "Cookie: sb-access-token=..." \
  -H "Content-Type: application/json" \
  -d '{
    "type":"application-accepted",
    "to":"victim@example.com",
    "data":{
      "fosterName":"Victim",
      "dogName":"Bait",
      "shelterName":"Fake Shelter",
      "threadUrl":"https://evil.example/phish"
    }
  }'
```

**Business impact:** Phishing from the trusted Fostr Find sender, Resend quota exhaustion, spam reputation damage, and user confusion.

**Fix:** Remove the generic client-triggered email endpoint. Send emails only from server-side domain events after ownership checks, as newer routes already do. If a public endpoint must remain, accept only record IDs, derive recipient/template data server-side, verify ownership, and restrict links to `NEXT_PUBLIC_APP_URL`.

**Effort estimate:** Moderate (1 day).

#### Finding 3.2 — Cookie-authenticated mutations lack explicit CSRF/origin enforcement

**Severity:** MEDIUM

**Where:** Most `src/app/api/**/route.ts` mutation handlers, for example `src/app/api/account/delete/route.ts:34-76` and `src/app/api/applications/route.ts:41-60`.

**What is wrong:** State-changing route handlers rely on Supabase session cookies and JSON/form parsing. There is no central origin check, CSRF token, or required custom header across API mutations. SameSite cookies help, but they are not a complete app-level policy and are easy to regress with auth/client configuration changes.

**Exploit scenario:** If cookies are sent on a cross-site POST in a compatible browser/configuration, an attacker can submit a hidden form or fetch request to mutation endpoints. JSON endpoints are harder to hit with simple forms, but `multipart/form-data` upload and `text/plain` edge cases should be explicitly rejected.

**Business impact:** Unauthorized state changes from a victim browser if cookie policy or browser behavior permits.

**Fix:** Add middleware/helper for mutation routes that validates `Origin`/`Referer` against `NEXT_PUBLIC_APP_URL` and rejects unsafe methods without `Content-Type: application/json` or expected multipart type. For high-risk routes, add a CSRF token or same-origin custom header.

**Effort estimate:** Moderate (1 day).

#### Finding 3.3 — Sensitive API responses do not set `Cache-Control: no-store`

**Severity:** MEDIUM

**Where:** API routes generally return `NextResponse.json(...)` without cache headers, for example `src/app/api/messages/route.ts:141`, `src/app/api/notifications/read/route.ts:68`, `src/app/api/account/delete/route.ts:156`.

**What is wrong:** User-specific API responses do not consistently include `Cache-Control: no-store, private`.

**Exploit scenario:** A proxy, browser cache, or CDN misconfiguration caches a personalized JSON response.

**Business impact:** Accidental disclosure of messages, notifications, or account operation responses on shared machines or intermediary caches.

**Fix:** Create a `privateJson()` response helper that always adds `Cache-Control: no-store, private` for authenticated APIs and use it across route handlers.

**Effort estimate:** Quick fix (< 1 hour).

### 4. Data Protection & Privacy

#### Finding 4.1 — Account deletion ignores intermediate service-role cleanup errors

**Severity:** MEDIUM

**Where:** `src/app/api/account/delete/route.ts:82-144`.

**What is wrong:** The route performs multiple service-role updates to decline applications and anonymize profile rows, but does not inspect those update errors before deleting the auth user.

**Exploit scenario:** A transient DB failure or schema change causes anonymization to fail, but `auth.admin.deleteUser()` still runs. Cascades may delete much of the profile data, but the route cannot prove every intended privacy cleanup succeeded.

**Business impact:** Privacy obligations become best-effort rather than verifiable, and failed deletion/anonymization steps are not surfaced.

**Fix:** Check every service-role update result. Wrap database cleanup in a Postgres RPC transaction that either completes all anonymization/status updates or aborts before deleting the auth user. Log a deletion audit event without PII.

**Effort estimate:** Moderate (1 day).

#### Finding 4.2 — No implemented data export, retention, or deletion audit policy

**Severity:** MEDIUM

**Where:** Architectural gap; account deletion route exists at `src/app/api/account/delete/route.ts`, but no export/retention implementation was found.

**What is wrong:** The app collects contact details, bios, messages, emergency contacts, reports, ratings, and invite emails. There is no code-level data retention policy, user data export path, or deletion audit trail.

**Exploit scenario:** A user requests a copy/deletion record, or a breach investigation needs to determine what PII existed and when it was removed. The system cannot answer mechanically.

**Business impact:** Compliance and incident-response exposure, especially as the app moves beyond pilot usage.

**Fix:** Define retention windows for messages/reports/invites, add user export tooling, record privacy-safe deletion events, and document subprocessors (Supabase, Resend, Sentry, hosting).

**Effort estimate:** Significant (multi-day).

### 5. Infrastructure & Configuration

#### Finding 5.1 — No application security headers are configured

**Severity:** HIGH

**Where:** `next.config.mjs:3-15`; no `vercel.json` present.

**What is wrong:** The Next.js config contains image settings and Sentry wrapping but no `headers()` configuration for CSP, HSTS, frame protection, MIME sniffing protection, referrer policy, or permissions policy.

**Exploit scenario:** A stored or reflected XSS bug has fewer browser guardrails; the app can be framed for clickjacking; mixed or overly permissive resource loading is not constrained.

**Business impact:** Larger blast radius for any client-side injection or UI redress vulnerability.

**Fix:** Add `async headers()` in `next.config.mjs` with `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`/`frame-ancestors`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`. Start in report-only if needed, then enforce.

**Effort estimate:** Moderate (1 day).

#### Finding 5.2 — `.env` is not ignored, only `.env*.local`

**Severity:** LOW

**Where:** `.gitignore:32-33`.

**What is wrong:** Local secret files matching `.env.local` are ignored, but a developer-created `.env`, `.env.production`, or `.env.development` would not be ignored by this pattern. `git ls-files` found no tracked env files during this audit, which is good.

**Exploit scenario:** A developer follows common tooling guidance, creates `.env`, and accidentally commits production keys.

**Business impact:** Secret leakage through git history.

**Fix:** Add `.env`, `.env.*`, and `!.env.example` patterns to `.gitignore`.

**Effort estimate:** Quick fix (< 1 hour).

### 6. Dependency & Vendor Risk

#### Finding 6.1 — `npm audit` reports high-severity Next.js and tooling vulnerabilities

**Severity:** HIGH

**Where:** `package.json:35`, `package.json:51`; verified with `npm audit --audit-level=high --json`.

**What is wrong:** `next@14.2.35` is affected by advisories including HTTP request deserialization DoS for Server Components and additional image/cache/request issues. `eslint-config-next` also pulls a vulnerable `glob` version. `npm audit` reported 4 high vulnerabilities and 1 moderate.

**Exploit scenario:** An unauthenticated attacker sends crafted requests that trigger known Next.js DoS behavior, degrading or taking down the app.

**Business impact:** Availability risk during launch or abuse spikes.

**Fix:** Upgrade Next.js to a patched 14.x/15.x/16.x version supported by the project, then re-run typecheck/build/tests. If a major upgrade is required by npm audit, evaluate the lowest patched version from Next.js advisories rather than blindly jumping to latest.

**Effort estimate:** Moderate (1 day).

#### Finding 6.2 — No automated dependency update configuration found

**Severity:** MEDIUM

**Where:** No Dependabot/Renovate config was found in the repository.

**What is wrong:** Security dependency updates depend on manual audits.

**Exploit scenario:** A known vulnerability lands after release and remains unpatched because no automated PR is opened.

**Business impact:** Longer exposure window for supply-chain and framework CVEs.

**Fix:** Add Dependabot or Renovate for npm weekly security PRs, with CI running typecheck, tests, lint, and build.

**Effort estimate:** Quick fix (< 1 hour).

### 7. Error Handling & Observability

#### Finding 7.1 — Security logging is console-only and lacks request correlation/audit trails

**Severity:** MEDIUM

**Where:** Examples include `src/lib/notifications.ts:39-51`, `src/lib/email.ts:61-76`, route-level `console.error(...)` calls throughout `src/app/api`.

**What is wrong:** Errors are logged with plain `console.error`/`console.warn`. There is no request ID, actor ID, IP, route, structured severity, immutable audit log, or alerting on suspicious events like repeated forbidden transitions.

**Exploit scenario:** An attacker probes UUIDs or abuses RPC/storage APIs. The app logs may not capture enough structured context to detect, investigate, or prove impact.

**Business impact:** Slow incident response and weak forensic trail.

**Fix:** Add structured server logging with request IDs and security event types; send critical server errors to Sentry with PII scrubbing; add alerts for spikes in 401/403/429, RPC failures, and storage abuse.

**Effort estimate:** Moderate (1 day).

### 8. Scalability & Load Resilience

#### Finding 8.1 — In-memory rate limiting is not reliable on serverless or multi-instance deployments

**Severity:** MEDIUM

**Where:** `src/lib/rate-limit.ts:1-8`, `src/lib/rate-limit.ts:49-120`.

**What is wrong:** Rate limits are stored in a process-local `Map`. This is explicitly documented as MVP-only, but production Next.js/Vercel/Supabase deployments may run multiple instances and cold starts. Attackers can bypass limits by spreading requests across instances or waiting for function isolation to reset state.

**Exploit scenario:** A bot sends invites, emails, messages, uploads, or application submissions across many connections. Each serverless instance sees only a fraction of the traffic, so per-process limits never trigger consistently.

**Business impact:** Email quota exhaustion, storage bandwidth costs, database load, and degraded user experience.

**Fix:** Replace with a shared limiter such as Upstash Redis, Vercel KV, Supabase-backed counters with RPC atomic increments, or an edge/WAF limiter. Keep per-route limits and include `X-RateLimit-Limit` headers.

**Effort estimate:** Moderate (1 day).

#### Finding 8.2 — 10,000-user burst would stress public reads, image optimization, email, and Supabase quotas

**Severity:** MEDIUM

**Where:** Architecture-wide; public dog/shelter pages, Supabase Storage public buckets, Resend emails, and Supabase Postgres/RLS.

**What is wrong:** The app has no documented load budgets, queueing, cache strategy, or graceful degradation modes. Public media is remote-optimized through Next image patterns, and email sends are performed inline or fire-and-forget from requests without a queue.

**Exploit scenario:** A viral shelter link drives 10,000 users in an hour. Public pages and image optimization spike; many users sign up/apply/message; email sends hit Resend limits; Supabase connection pool and RLS queries become the bottleneck.

**Business impact:** Slow pages, failed applications/messages, email delivery loss, and possible cloud cost spikes.

**Fix:** Define launch-tier limits, cache public pages where safe, pre-size Supabase plan, move emails/notifications to a queue, and add uptime/latency alerts.

**Effort estimate:** Significant (multi-day).

### 9. Business Continuity & Organizational Risk

#### Finding 9.1 — Report triage/admin workflow is deferred

**Severity:** MEDIUM

**Where:** `supabase/migrations/20240114000000_reports.sql:8-12`, `src/app/api/reports/route.ts:28-31`.

**What is wrong:** Users can file safety/harassment/misrepresentation reports, but triage is explicitly deferred and status changes are service-role/admin-only without a shipped admin queue.

**Exploit scenario:** A serious safety report is filed and remains unseen, or support staff must query production manually with service credentials.

**Business impact:** Safety, trust, and liability risk.

**Fix:** Ship an admin triage view protected by an explicit admin role, notifications to support for new reports, status history, and escalation procedures before public launch.

**Effort estimate:** Significant (multi-day).

#### Finding 9.2 — Backups, restore tests, and incident runbooks are not represented in code/docs

**Severity:** MEDIUM

**Where:** Architectural/ops gap; no backup/runbook artifacts found in repo.

**What is wrong:** Supabase managed backups may exist depending on plan, but there is no project evidence of backup settings, restore testing, incident ownership, or rollback runbooks.

**Exploit scenario:** A migration, compromised service-role key, or operator error corrupts data. The team cannot quickly identify last-good backup, restore steps, or communication owner.

**Business impact:** Extended downtime and possible permanent data loss.

**Fix:** Document Supabase backup/PITR plan, run a restore drill to a staging project, define incident roles, and add release rollback steps.

**Effort estimate:** Moderate (1 day).

### 10. Client-Side Security

#### Finding 10.1 — User-controlled media URLs are rendered across portals without CSP backstop

**Severity:** MEDIUM

**Where:** Examples include `src/components/foster/browse-dog-card.tsx`, `src/components/shelter/dog-form.tsx`, `src/components/avatar-logo-field.tsx`, and `next.config.mjs:5-13`.

**What is wrong:** Public storage URLs and remote images are rendered in many places. React/Next image handling helps, but the absence of CSP and permissive direct storage upload policies increase the blast radius if malicious content is hosted or a URL field is polluted.

**Exploit scenario:** An attacker uploads unexpected content to a public bucket or stores a crafted remote URL in a profile/image field. Without CSP and stricter storage policies, the browser has fewer restrictions on what can load.

**Business impact:** Brand abuse, mixed content/security warnings, tracking pixels, or XSS-adjacent browser behavior if future rendering changes.

**Fix:** Pair the storage policy fix with CSP `img-src` allowlisting for self, Supabase storage, and known demo image hosts; validate stored URLs server-side and prefer storing storage paths over arbitrary public URLs.

**Effort estimate:** Moderate (1 day).

#### Finding 10.2 — Good: no `dangerouslySetInnerHTML` usage found

**Severity:** INFO

**Where:** Repository search found no `dangerouslySetInnerHTML` usage in `src`.

**What is good:** User-generated messages, bios, reports, and feedback appear to be rendered through React text nodes/components rather than raw HTML.

**Recommendation:** Keep this invariant documented. If markdown/rich text is added, add a sanitizer and CSP before shipping.

#### Finding 10.3 — Good: service-role key is not exposed to client code

**Severity:** INFO

**Where:** `src/lib/supabase/service.ts:31-47`; `.env.example:1-11`; repository search found server-only service-role usage.

**What is good:** The service-role helper is server-only and uses `SUPABASE_SERVICE_ROLE_KEY`, not a `NEXT_PUBLIC_` variable. No tracked `.env` files were found.

**Recommendation:** Add `.env` ignore hardening and secret scanning to CI to preserve this state.

## Adversarial Scenario: 24 Hours to Break This App

First target: Supabase RPCs. With a normal account, extract the public anon key from the browser bundle and use the session JWT to call `/rest/v1/rpc/accept_application`, `/complete_application`, and `/relist_dog` directly. Enumerate candidate UUIDs from my own portal data, messages, links, or leaked logs. Change application and dog lifecycle state without using the Next.js API routes.

Second target: storage. Use the same anon key and JWT to upload arbitrary files directly to public Supabase Storage buckets, bypassing `/api/upload/photo` checks. Fill quota, host unwanted content, or place files under misleading paths.

Third target: email. Use `/api/notifications/send` to send trusted transactional-looking emails to arbitrary recipients with arbitrary links and content. Burn sender reputation or phish fosters/shelters from the real domain.

Fourth target: availability. Use known Next.js DoS advisories against the current `next` version and amplify with upload, invite, message, and notification traffic. The in-memory rate limiter will not hold in a multi-instance/serverless environment.

Persistence/cover tracks: avoid the app routes that log route-specific authorization failures. Prefer direct Supabase RPC/storage calls, which the app's route logs do not see. If production logging is console-only, detection depends on cloud/provider logs rather than structured application audit events.

Worst realistic blast radius: unauthorized application/dog lifecycle manipulation across shelters, public content abuse through storage, phishing from trusted email flows, and a service degradation event during launch traffic.

## Load Scenario: 10,000 Users in an Hour

What breaks first: Next.js image optimization and Supabase Storage bandwidth for public dog/shelter media, followed by Supabase Postgres/RLS hot paths for browse/apply/message flows and Resend email quotas for notification-heavy events.

Database: indexes exist for several hot paths (`dogs.status`, `applications.*`, `messages.application_id/read`, role lookups), which is good. RLS policies and nested joins still add overhead under burst traffic. Supabase plan limits and connection pool size are not documented in the repo.

API/application: route handlers are stateless enough to scale horizontally, but rate limiting is process-local and email side effects are not queued. Serverless cold starts and multiple instances weaken both abuse control and operational predictability.

Frontend/CDN: public pages can likely benefit from caching, but user-specific portal content must stay dynamic and private. Security headers and cache-control helpers are missing.

Email/notifications: a sudden spike of applications, messages, invites, and feedback can exceed Resend rate/volume limits. Fire-and-forget calls can silently fail or lag without retry/queue visibility.

Cascading failure: traffic spike causes image/storage load and DB pressure; email failures are logged but not retried; users retry mutations; process-local rate limits do not coordinate; support receives reports without triage tooling.

## Prioritized Fix Plan

### Tier 0 — Fix Before You Ship

1. Lock down `SECURITY DEFINER` transition RPCs: revoke public/default execution and add `auth.uid()` ownership plus state checks inside the functions.
2. Remove or harden `/api/notifications/send`: derive all recipients/template data server-side from authorized record IDs.
3. Tighten Supabase Storage policies so direct authenticated uploads must use the caller's own folder and allowed path shape.
4. Upgrade Next.js to a patched version or the lowest safe supported version and rerun build/typecheck/tests.
5. Make `DEV_MODE` impossible when `NODE_ENV=production`.

### Tier 1 — Fix Within First Week

1. Add production security headers in `next.config.mjs`.
2. Replace in-memory API rate limiting with a shared store or edge/WAF limiter.
3. Add origin/CSRF enforcement and content-type checks for mutation routes.
4. Add private/no-store response helper for authenticated API JSON.
5. Validate upload magic bytes and strip EXIF server-side where practical.

### Tier 2 — Fix Within First Month

1. Add structured security logging, request IDs, and alerting.
2. Add report triage/admin tooling before broad public launch.
3. Check and transactionally enforce account deletion cleanup.
4. Add dependency automation with Dependabot/Renovate.
5. Define data retention, export, and deletion audit procedures.

### Tier 3 — Ongoing Hardening

1. Run backup restore drills and document incident/rollback runbooks.
2. Add launch load tests around browse/apply/message/upload/email flows.
3. Maintain CSP as new third-party integrations are added.
4. Keep `dangerouslySetInnerHTML` prohibited unless paired with sanitizer and review.

## Appendix: Tools & Libraries Referenced

- Supabase RLS and Storage policies
- Supabase `SECURITY DEFINER` function hardening
- Next.js `headers()` security headers
- `file-type` for server-side magic-byte detection
- `sharp` for image re-encoding/EXIF stripping
- Upstash Redis, Vercel KV, or Supabase RPC counters for distributed rate limiting
- Dependabot or Renovate for dependency security updates
- Sentry for structured error monitoring with PII scrubbing
- `npm audit --audit-level=high --json`
