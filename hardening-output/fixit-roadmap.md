# Fix It Roadmap
> Generated from Product Hardening Audit — 2026-05-05
> Total fixes: 12 | Critical: 1 | High: 4 | Medium: 6 | Low: 1 | Info: 0
> Estimated total effort: 8-13 engineering days

## How to Use This Roadmap

Work top to bottom. Do not skip Tier 0: those items close direct authorization, abuse, and known-CVE exposure. After each fix, run its Definition of Done and Verification Protocol before moving to the next item.

## Progress Tracker

| # | Fix | Severity | Tier | Effort | Status |
|---|-----|----------|------|--------|--------|
| 1 | Lock down transition RPCs | CRITICAL | 0 | 1 day | ☐ |
| 2 | Remove arbitrary notification email send | HIGH | 0 | 1 day | ☐ |
| 3 | Tighten Supabase Storage insert policy | HIGH | 0 | 1 day | ☐ |
| 4 | Upgrade vulnerable Next.js/tooling dependencies | HIGH | 0 | 1 day | ☐ |
| 5 | Fail production when `DEV_MODE` would activate | MEDIUM | 0 | < 1 hr | ☐ |
| 6 | Add production security headers | HIGH | 1 | 1 day | ☐ |
| 7 | Replace in-memory rate limiting | MEDIUM | 1 | 1 day | ☐ |
| 8 | Add mutation origin/content-type checks | MEDIUM | 1 | 1 day | ☐ |
| 9 | Add private no-store response helper | MEDIUM | 1 | < 1 hr | ☐ |
| 10 | Harden image validation | MEDIUM | 2 | 1 day | ☐ |
| 11 | Transactional account deletion cleanup | MEDIUM | 2 | 1 day | ☐ |
| 12 | Ignore all local env files except `.env.example` | LOW | 2 | < 1 hr | ☐ |

---

## Tier 0 — Fix Before You Ship

### Fix 1: Lock Down Transition RPCs

**Severity:** CRITICAL  
**Tier:** 0  
**Effort:** Moderate (1 day)  
**Audit Reference:** Section 1.1 — Exposed `SECURITY DEFINER` transition RPCs bypass API authorization  
**File(s):** `supabase/migrations/20240110000000_atomic_transitions.sql:52`, new migration under `supabase/migrations/`

---

#### Why This Must Change

The app correctly checks shelter ownership in the Next.js route before calling `accept_application`, `complete_application`, and `relist_dog`, but those SQL functions are also callable through Supabase RPC. Because they are `SECURITY DEFINER`, the function body bypasses RLS and currently trusts the caller. Any authenticated user who knows an application or dog UUID can mutate lifecycle state outside the API route.

#### Current Code (Vulnerable)

```sql
-- File: supabase/migrations/20240110000000_atomic_transitions.sql (lines 52-70)
-- VULNERABLE — no auth.uid() ownership or status check inside the RPC.

CREATE FUNCTION public.accept_application(app_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH updated_app AS (
    UPDATE public.applications
       SET status = 'accepted',
           updated_at = now()
     WHERE id = app_id
    RETURNING dog_id
  )
  UPDATE public.dogs
     SET status = 'pending',
         updated_at = now()
    FROM updated_app
   WHERE public.dogs.id = updated_app.dog_id;
$$;

GRANT EXECUTE ON FUNCTION public.accept_application(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.relist_dog(uuid)           TO authenticated;
```

#### Replacement Code (Hardened)

Create a new migration, for example `supabase/migrations/20240120000000_harden_transition_rpcs.sql`:

```sql
-- File: supabase/migrations/20240120000000_harden_transition_rpcs.sql
-- HARDENED — execution is revoked from PUBLIC and each RPC scopes updates to auth.uid().

REVOKE EXECUTE ON FUNCTION public.accept_application(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_application(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.relist_dog(uuid) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.accept_application(app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_count integer;
BEGIN
  WITH authorized_app AS (
    UPDATE public.applications a
       SET status = 'accepted',
           updated_at = now()
      FROM public.shelters s
     WHERE a.id = app_id
       AND a.shelter_id = s.id
       AND s.user_id = auth.uid()
       AND a.status IN ('submitted', 'reviewing')
     RETURNING a.dog_id
  ),
  updated_dog AS (
    UPDATE public.dogs d
       SET status = 'pending',
           updated_at = now()
      FROM authorized_app aa
     WHERE d.id = aa.dog_id
       AND d.status IN ('available', 'pending')
     RETURNING d.id
  )
  SELECT count(*) INTO changed_count FROM updated_dog;

  IF changed_count <> 1 THEN
    RAISE EXCEPTION 'not authorized or invalid transition'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_application(app_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_count integer;
BEGIN
  WITH authorized_app AS (
    UPDATE public.applications a
       SET status = 'completed',
           updated_at = now()
      FROM public.shelters s
     WHERE a.id = app_id
       AND a.shelter_id = s.id
       AND s.user_id = auth.uid()
       AND a.status = 'accepted'
     RETURNING a.dog_id
  ),
  updated_dog AS (
    UPDATE public.dogs d
       SET status = 'placed',
           updated_at = now()
      FROM authorized_app aa
     WHERE d.id = aa.dog_id
       AND d.status = 'pending'
     RETURNING d.id
  )
  SELECT count(*) INTO changed_count FROM updated_dog;

  IF changed_count <> 1 THEN
    RAISE EXCEPTION 'not authorized or invalid transition'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.relist_dog(p_dog_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_count integer;
BEGIN
  WITH authorized_dog AS (
    UPDATE public.dogs d
       SET status = 'available',
           updated_at = now()
      FROM public.shelters s
     WHERE d.id = p_dog_id
       AND d.shelter_id = s.id
       AND s.user_id = auth.uid()
       AND d.status = 'pending'
     RETURNING d.id
  ),
  declined_apps AS (
    UPDATE public.applications a
       SET status = 'declined',
           updated_at = now()
      FROM authorized_dog ad
     WHERE a.dog_id = ad.id
       AND a.status = 'accepted'
     RETURNING a.id
  )
  SELECT count(*) INTO changed_count FROM authorized_dog;

  IF changed_count <> 1 THEN
    RAISE EXCEPTION 'not authorized or invalid transition'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.relist_dog(uuid) TO authenticated;
```

#### Configuration Changes

Apply the migration to every Supabase environment:

```bash
supabase db push
```

#### Dependencies Required

No new dependencies required.

#### Migration Notes

This changes behavior for direct RPC callers. Legitimate Next.js API routes continue to work because they call as the shelter user's authenticated Supabase client. Unauthorized direct RPC calls now fail.

---

#### Definition of Done

- [ ] **MIGRATION CREATED**: A new migration revokes `PUBLIC` execute and replaces all three transition RPCs.
- [ ] **OWNERSHIP IN SQL**: Each RPC checks `auth.uid()` against the owning shelter row inside the function.
- [ ] **STATE IN SQL**: Each RPC checks valid source status inside the function.
- [ ] **ROUTE STILL WORKS**: Shelter accept, complete, and re-list flows still succeed through the UI/API.
- [ ] **TESTS PASS**: `node node_modules/typescript/bin/tsc --noEmit` exits 0 and relevant API tests pass.

---

#### Verification Protocol — Prove It's Fixed

**Test 1: Unauthorized direct accept RPC**

```bash
curl "$SUPABASE_URL/rest/v1/rpc/accept_application" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $UNRELATED_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"app_id":"TARGET_APPLICATION_UUID"}'
```

**Expected result:** 401/403 or SQL permission error; target application remains unchanged.  
**Failure indicator:** Application status changes to `accepted`.

**Test 2: Valid shelter accept through app route**

```bash
curl "$APP_URL/api/applications/$APPLICATION_ID/accept" \
  -X POST \
  -H "Cookie: <valid shelter session cookie>"
```

**Expected result:** 200 with `{ "success": true }`; application becomes `accepted`, dog becomes `pending`.  
**Failure indicator:** Valid owner receives 500/403.

**Test 3: Invalid state transition**

```bash
curl "$SUPABASE_URL/rest/v1/rpc/complete_application" \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $SHELTER_OWNER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"app_id":"SUBMITTED_NOT_ACCEPTED_APPLICATION_UUID"}'
```

**Expected result:** Permission/transition error; row remains `submitted`.  
**Failure indicator:** Row becomes `completed`.

### Fix 2: Remove Arbitrary Notification Email Send

**Severity:** HIGH  
**Tier:** 0  
**Effort:** Moderate (1 day)  
**Audit Reference:** Section 3.1 — Authenticated users can send arbitrary transactional emails  
**File(s):** `src/app/api/notifications/send/route.ts:172`

---

#### Why This Must Change

The route accepts `to` and template data from any authenticated user. That lets a malicious user send trusted transactional-looking email to arbitrary addresses using Fostr Find's sender reputation. Newer server routes already send emails after domain-specific ownership checks, so this generic endpoint should not remain exposed.

#### Current Code (Vulnerable)

```typescript
// File: src/app/api/notifications/send/route.ts (lines 172-226)
// VULNERABLE — caller controls recipient and template fields.

export async function POST(request: Request): Promise<NextResponse> {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  // ...
  if (typeof body.to !== 'string' || body.to.length === 0) {
    return NextResponse.json({ error: 'Missing recipient (to)' }, { status: 400 })
  }
  // ...
  const result = await sendEmail({ to: body.to, subject, react })
  // ...
}
```

#### Replacement Code (Hardened)

Preferred: delete the route and migrate any remaining client callers to server-side trigger routes. If deletion would break unresolved callers, make the route fail closed while you migrate.

```typescript
// File: src/app/api/notifications/send/route.ts
// HARDENED — generic client-triggered transactional email is disabled.

import { NextResponse } from 'next/server'

export async function POST(): Promise<NextResponse> {
  return NextResponse.json(
    { error: 'Notification sending must be triggered by an authorized server action.' },
    { status: 410 },
  )
}
```

Then search and remove any callers:

```bash
rg "api/notifications/send|notifications/send" src
```

#### Configuration Changes

None.

#### Dependencies Required

No new dependencies required.

#### Migration Notes

If any client component still depends on this route, replace it with a domain route that accepts a record ID and derives recipient/data server-side.

---

#### Definition of Done

- [ ] **GENERIC ROUTE DISABLED**: `/api/notifications/send` no longer sends emails from arbitrary request bodies.
- [ ] **NO CLIENT CALLERS**: `rg "notifications/send" src` finds no active client trigger paths, or all callers hit authorized record-ID endpoints.
- [ ] **DOMAIN EMAILS WORK**: Application submit/accept/decline/complete and invite flows still send from server-side routes where expected.

---

#### Verification Protocol — Prove It's Fixed

**Test 1: Arbitrary email attempt**

```bash
curl "$APP_URL/api/notifications/send" \
  -X POST \
  -H "Cookie: <valid user session>" \
  -H "Content-Type: application/json" \
  -d '{"type":"new-message","to":"victim@example.com","data":{"recipientName":"x","senderName":"x","dogName":"x","messagePreview":"x","threadUrl":"https://evil.example"}}'
```

**Expected result:** 410 or 403; no email sent.  
**Failure indicator:** 200 response or email delivered.

**Test 2: Legitimate accepted-application email**

```bash
curl "$APP_URL/api/applications/$APPLICATION_ID/accept" \
  -X POST \
  -H "Cookie: <valid shelter session>"
```

**Expected result:** Route succeeds and server-side email/notification side effect still fires.  
**Failure indicator:** Legitimate route fails because it depended on the removed endpoint.

### Fix 3: Tighten Supabase Storage Insert Policy

**Severity:** HIGH  
**Tier:** 0  
**Effort:** Moderate (1 day)  
**Audit Reference:** Section 2.1 — Public storage upload policies allow direct bypass of server validation  
**File(s):** `supabase/migrations/20240112000000_storage_buckets.sql:43`, new migration under `supabase/migrations/`

---

#### Why This Must Change

The API route forces uploads into `{userId}/{uuid}.{ext}`, but direct Supabase Storage requests bypass the route. The storage policy must enforce the same ownership path invariant because the anon key and Supabase Storage endpoint are public by design.

#### Current Code (Vulnerable)

```sql
-- File: supabase/migrations/20240112000000_storage_buckets.sql (lines 43-47)
-- VULNERABLE — any authenticated user can upload any object name to public buckets.

CREATE POLICY "storage.objects: authenticated users can upload to public buckets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('dog-photos', 'shelter-logos', 'foster-avatars')
  );
```

#### Replacement Code (Hardened)

Create a new migration:

```sql
-- File: supabase/migrations/20240121000000_harden_storage_uploads.sql
-- HARDENED — direct Storage inserts must use the caller's own top-level folder.

DROP POLICY IF EXISTS "storage.objects: authenticated users can upload to public buckets"
  ON storage.objects;

CREATE POLICY "storage.objects: authenticated users upload own folder only"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id IN ('dog-photos', 'shelter-logos', 'foster-avatars')
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND name ~ ('^' || auth.uid()::text || '/[0-9a-fA-F-]{36}\\.(jpg|png|webp)$')
  );
```

#### Configuration Changes

Apply migration to Supabase. Review bucket public/private settings in Supabase Dashboard → Storage.

#### Dependencies Required

No new dependencies required.

#### Migration Notes

Existing files outside the new pattern remain readable if buckets are public, but future direct uploads outside the user's folder fail. Add a cleanup script for legacy objects if needed.

---

#### Definition of Done

- [ ] **POLICY UPDATED**: Direct insert policy enforces bucket, caller folder, UUID filename, and allowed extension.
- [ ] **ROUTE UPLOAD WORKS**: `/api/upload/photo` still succeeds for valid JPG/PNG/WebP uploads.
- [ ] **DIRECT BYPASS FAILS**: Direct Storage upload to another folder or `.svg` path is rejected.

---

#### Verification Protocol — Prove It's Fixed

**Test 1: Direct upload to another folder**

```bash
curl "$SUPABASE_URL/storage/v1/object/dog-photos/not-my-user-id/payload.jpg" \
  -X POST \
  -H "apikey: $ANON_KEY" \
  -H "Authorization: Bearer $USER_JWT" \
  -H "Content-Type: image/jpeg" \
  --data-binary @test.jpg
```

**Expected result:** 403.  
**Failure indicator:** Object is created.

**Test 2: Valid route upload**

```bash
curl "$APP_URL/api/upload/photo" \
  -X POST \
  -H "Cookie: <valid user session>" \
  -F "bucket=dog-photos" \
  -F "file=@test.jpg;type=image/jpeg"
```

**Expected result:** 200 with `url` and `path`.  
**Failure indicator:** Valid route upload is blocked.

### Fix 4: Upgrade Vulnerable Next.js/Tooling Dependencies

**Severity:** HIGH  
**Tier:** 0  
**Effort:** Moderate (1 day)  
**Audit Reference:** Section 6.1 — `npm audit` reports high-severity vulnerabilities  
**File(s):** `package.json:35`, `package.json:51`, `package-lock.json`

---

#### Why This Must Change

`npm audit --audit-level=high --json` reports high-severity Next.js advisories affecting the current version. Availability vulnerabilities are public playbooks once advisories ship.

#### Current Code (Vulnerable)

```json
// File: package.json
{
  "dependencies": {
    "next": "14.2.35"
  },
  "devDependencies": {
    "eslint-config-next": "14.2.35"
  }
}
```

#### Replacement Code (Hardened)

Use the package manager to install patched versions after confirming the lowest compatible patched Next.js release:

```bash
npm install next@latest eslint-config-next@latest
```

If a major upgrade is too disruptive, consult the Next.js advisory and install the lowest patched release that fixes GHSA-h25m-26qc-wcjf and GHSA-q4gf-8mx6-v5v3.

#### Configuration Changes

None.

#### Dependencies Required

No new dependency category; upgrades existing packages.

#### Migration Notes

Major Next.js upgrades can require App Router, ESLint, or build config changes. Run the full verification suite before deploying.

---

#### Definition of Done

- [ ] **AUDIT CLEAN FOR HIGH**: `npm audit --audit-level=high` exits 0 or only reports accepted documented exceptions.
- [ ] **LOCKFILE UPDATED**: `package-lock.json` reflects patched versions.
- [ ] **BUILD PASSES**: `node node_modules/next/dist/bin/next build` exits 0.
- [ ] **TYPES PASS**: `node node_modules/typescript/bin/tsc --noEmit` exits 0.

---

#### Verification Protocol — Prove It's Fixed

**Test 1: Dependency audit**

```bash
npm audit --audit-level=high
```

**Expected result:** Exit 0.  
**Failure indicator:** High vulnerabilities remain for `next` or `eslint-config-next`.

**Test 2: Application build**

```bash
node node_modules/next/dist/bin/next build
```

**Expected result:** Build succeeds.  
**Failure indicator:** Build errors from the upgrade.

### Fix 5: Fail Production When `DEV_MODE` Would Activate

**Severity:** MEDIUM  
**Tier:** 0  
**Effort:** Quick fix (< 1 hour)  
**Audit Reference:** Section 1.2 — `DEV_MODE` disables auth if production Supabase URL is missing or malformed  
**File(s):** `src/lib/env.ts:71`

---

#### Why This Must Change

Developer convenience should not be a production fallback. If production is missing Supabase configuration, the app should fail closed instead of bypassing portal guards.

#### Current Code (Vulnerable)

```typescript
// File: src/lib/env.ts (lines 71-82)
// VULNERABLE — production can return early in DEV_MODE.

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === 'production'

  if (DEV_MODE) {
    const missingBackend = missing(BACKEND_VARS)
    if (missingBackend.length > 0) {
      console.warn(
        `[env] DEV_MODE active — backend env vars missing (${missingBackend.join(', ')}). The app will run with placeholder data; sign-in and data writes are disabled.`,
      )
    }
    return
  }
}
```

#### Replacement Code (Hardened)

```typescript
// File: src/lib/env.ts
// HARDENED — production cannot enter DEV_MODE.

export function validateEnv(): void {
  const isProd = process.env.NODE_ENV === 'production'

  if (DEV_MODE) {
    const missingBackend = missing(BACKEND_VARS)
    const detail =
      missingBackend.length > 0
        ? ` Missing backend env vars: ${missingBackend.join(', ')}.`
        : ''

    if (isProd) {
      throw new Error(
        `[env] Refusing to boot production in DEV_MODE.${detail} Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.`,
      )
    }

    if (missingBackend.length > 0) {
      console.warn(
        `[env] DEV_MODE active — backend env vars missing (${missingBackend.join(', ')}). The app will run with placeholder data; sign-in and data writes are disabled.`,
      )
    }
    return
  }

  // existing non-DEV_MODE checks continue here
}
```

#### Configuration Changes

Ensure Vercel/hosting production has valid `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

#### Dependencies Required

No new dependencies required.

#### Migration Notes

Production builds/deploys with missing Supabase env now fail, which is intended.

---

#### Definition of Done

- [ ] **PROD FAILS CLOSED**: `NODE_ENV=production` with missing Supabase URL throws.
- [ ] **DEV STILL WORKS**: Local missing-env development still shows placeholder/dev behavior.
- [ ] **ENV DOCS UPDATED**: Deployment docs mention production Supabase envs are hard-required.

---

#### Verification Protocol — Prove It's Fixed

**Test 1: Production missing env**

```bash
NODE_ENV=production NEXT_PUBLIC_SUPABASE_URL= node node_modules/next/dist/bin/next build
```

**Expected result:** Build fails with the explicit DEV_MODE refusal.  
**Failure indicator:** Build succeeds and app boots in DEV_MODE.

**Test 2: Local dev missing env**

```bash
NEXT_PUBLIC_SUPABASE_URL= node node_modules/next/dist/bin/next dev
```

**Expected result:** Dev server starts with warning.  
**Failure indicator:** Local zero-config dev is broken.

## Tier 1 — Fix Within First Week

### Fix 6: Add Production Security Headers

**Severity:** HIGH  
**Tier:** 1  
**Effort:** Moderate (1 day)  
**Audit Reference:** Section 5.1 — No application security headers are configured  
**File(s):** `next.config.mjs:3`

---

#### Why This Must Change

Security headers reduce the blast radius of XSS, clickjacking, MIME sniffing, and referrer leakage. The current config has no global headers.

#### Current Code (Vulnerable)

```javascript
// File: next.config.mjs (lines 3-15)
// MISSING — no headers() function.

const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },
}
```

#### Replacement Code (Hardened)

```javascript
// File: next.config.mjs
// HARDENED — adds global browser security headers.

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co https://*.supabase.in",
      "font-src 'self' data:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      "connect-src 'self' https://*.supabase.co https://*.supabase.in https://*.sentry.io",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: '*.supabase.in' },
    ],
  },
}
```

Start with this baseline and tighten `script-src` after testing Sentry/Next runtime requirements.

#### Configuration Changes

If deploying behind Vercel/Cloudflare, confirm HSTS and CSP are not overwritten upstream.

#### Dependencies Required

No new dependencies required.

#### Migration Notes

CSP may initially break inline scripts/styles used by Next or third-party integrations. Test in preview before production.

---

#### Definition of Done

- [ ] **HEADERS PRESENT**: Production responses include CSP, HSTS, frame, content-type, referrer, and permissions headers.
- [ ] **APP FUNCTIONAL**: Login, portals, image rendering, Sentry, and Supabase requests still work.
- [ ] **NO UNEXPECTED CSP VIOLATIONS**: Browser console has no blocking CSP errors on core flows.

---

#### Verification Protocol — Prove It's Fixed

**Test 1: Header inspection**

```bash
curl -I "$APP_URL/"
```

**Expected result:** Headers include `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, and `X-Content-Type-Options`.  
**Failure indicator:** Headers absent.

**Test 2: Frame denial**

```html
<iframe src="https://your-app.example"></iframe>
```

**Expected result:** Browser refuses to frame the app.  
**Failure indicator:** App renders inside the frame.

### Fix 7: Replace In-Memory Rate Limiting

**Severity:** MEDIUM  
**Tier:** 1  
**Effort:** Moderate (1 day)  
**Audit Reference:** Section 8.1 — In-memory rate limiting is not reliable on serverless or multi-instance deployments  
**File(s):** `src/lib/rate-limit.ts:49`

---

#### Why This Must Change

Process-local `Map` limits do not coordinate across serverless instances. Abuse against email, upload, reports, messages, invites, and application endpoints can slip through by spreading requests.

#### Current Code (Vulnerable)

```typescript
// File: src/lib/rate-limit.ts (lines 49-50)
// VULNERABLE IN SERVERLESS — state is local to one process.

const buckets = new Map<string, Bucket>()
```

#### Replacement Code (Hardened)

Use a shared store. Example with Upstash Redis:

```bash
npm install @upstash/redis @upstash/ratelimit
```

```typescript
// File: src/lib/rate-limit.ts
// HARDENED — shared fixed-window limiter for serverless deployments.

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { NextResponse } from 'next/server'

const redis = Redis.fromEnv()

export async function rateLimit(route: string, identifier: string, options: RateLimitOptions): Promise<RateLimitResult> {
  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(options.limit, `${Math.ceil(options.windowMs / 1000)} s`),
    analytics: true,
    prefix: `fostr:${route}`,
  })

  const result = await limiter.limit(identifier)
  return {
    success: result.success,
    remaining: result.remaining,
    resetAt: result.reset,
    retryAfter: Math.max(0, Math.ceil((result.reset - Date.now()) / 1000)),
  }
}
```

Then update callers from `const rl = rateLimit(...)` to `const rl = await rateLimit(...)`.

#### Configuration Changes

Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to production and preview environments.

#### Dependencies Required

| Package | Version | Purpose | Install Command |
|---------|---------|---------|-----------------|
| `@upstash/redis` | latest | Redis client | `npm install @upstash/redis @upstash/ratelimit` |
| `@upstash/ratelimit` | latest | Distributed limiter | `npm install @upstash/redis @upstash/ratelimit` |

#### Migration Notes

This touches many route handlers because the limiter becomes async. Keep the response helper shape unchanged.

---

#### Definition of Done

- [ ] **SHARED STORE USED**: No production route uses process-local buckets for abuse limits.
- [ ] **CALLERS UPDATED**: Every `rateLimit(...)` call awaits the result.
- [ ] **HEADERS PRESERVED**: 429 responses still include `Retry-After` and reset/remaining headers.

---

#### Verification Protocol — Prove It's Fixed

**Test 1: Repeated message sends**

```bash
for i in $(seq 1 35); do
  curl -s -o /dev/null -w "%{http_code}\n" "$APP_URL/api/messages" \
    -X POST \
    -H "Cookie: <valid session>" \
    -H "Content-Type: application/json" \
    -d '{"applicationId":"APPLICATION_UUID","body":"test"}'
done
```

**Expected result:** Requests past the configured threshold return 429.  
**Failure indicator:** All requests are accepted.

**Test 2: Multi-instance smoke**

Deploy to preview and repeat the test from two terminals concurrently.

**Expected result:** Shared limit is enforced across both clients.  
**Failure indicator:** Each terminal receives a separate full quota.

### Fix 8: Add Mutation Origin and Content-Type Checks

**Severity:** MEDIUM  
**Tier:** 1  
**Effort:** Moderate (1 day)  
**Audit Reference:** Section 3.2 — Cookie-authenticated mutations lack explicit CSRF/origin enforcement  
**File(s):** new `src/lib/api-security.ts`, mutation route handlers under `src/app/api`

---

#### Why This Must Change

Supabase auth uses cookies, so state-changing routes should reject cross-origin mutation attempts and unexpected content types. This provides a consistent app-level CSRF boundary independent of provider cookie details.

#### Current Code (Vulnerable)

```typescript
// File: src/app/api/account/delete/route.ts (lines 34-38)
// MISSING — no origin/content-type check before parsing mutation body.

export async function POST(request: Request): Promise<NextResponse> {
  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
```

#### Replacement Code (Hardened)

```typescript
// File: src/lib/api-security.ts
// HARDENED — shared guard for cookie-authenticated mutation routes.

import { NextResponse } from 'next/server'

export function validateMutationRequest(
  request: Request,
  allowedContentTypes: readonly string[] = ['application/json'],
): NextResponse | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL
  const allowedOrigin = appUrl && appUrl.startsWith('http') ? new URL(appUrl).origin : null
  const origin = request.headers.get('origin')

  if (allowedOrigin && origin && origin !== allowedOrigin) {
    return NextResponse.json({ error: 'Forbidden origin' }, { status: 403 })
  }

  const contentType = request.headers.get('content-type')?.toLowerCase() ?? ''
  const matches = allowedContentTypes.some((type) => contentType.startsWith(type))
  if (!matches) {
    return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
  }

  return null
}
```

Use it at the start of JSON mutation handlers:

```typescript
const mutationError = validateMutationRequest(request)
if (mutationError) return mutationError
```

Use `['multipart/form-data']` for `/api/upload/photo`.

#### Configuration Changes

Set `NEXT_PUBLIC_APP_URL` correctly in production.

#### Dependencies Required

No new dependencies required.

#### Migration Notes

Some local/dev requests without `Origin` should still work. Cross-origin API consumers, if any, must be explicitly supported or rejected.

---

#### Definition of Done

- [ ] **HELPER ADDED**: Shared mutation request helper exists.
- [ ] **MUTATIONS COVERED**: Every POST/PATCH/DELETE route under `src/app/api` calls it or documents why it is public/special.
- [ ] **UPLOAD COVERED**: Multipart upload route validates `multipart/form-data`.

---

#### Verification Protocol — Prove It's Fixed

**Test 1: Cross-origin mutation**

```bash
curl "$APP_URL/api/account/delete" \
  -X POST \
  -H "Origin: https://evil.example" \
  -H "Cookie: <valid session>" \
  -H "Content-Type: application/json" \
  -d '{"confirm":"DELETE"}'
```

**Expected result:** 403.  
**Failure indicator:** Route processes the request.

**Test 2: Wrong content type**

```bash
curl "$APP_URL/api/applications" \
  -X POST \
  -H "Cookie: <valid session>" \
  -H "Content-Type: text/plain" \
  -d '{"dog_id":"..."}'
```

**Expected result:** 415.  
**Failure indicator:** Route attempts JSON parsing.

### Fix 9: Add Private No-Store Response Helper

**Severity:** MEDIUM  
**Tier:** 1  
**Effort:** Quick fix (< 1 hour)  
**Audit Reference:** Section 3.3 — Sensitive API responses do not set `Cache-Control: no-store`  
**File(s):** new `src/lib/api-response.ts`, route handlers under `src/app/api`

---

#### Why This Must Change

Authenticated JSON should not be cached by browsers, proxies, or accidental CDN rules.

#### Current Code (Vulnerable)

```typescript
// File: src/app/api/messages/route.ts (line 141)
// MISSING — no private/no-store cache header.

return NextResponse.json(message, { status: 201 })
```

#### Replacement Code (Hardened)

```typescript
// File: src/lib/api-response.ts
// HARDENED — default response for authenticated API JSON.

import { NextResponse } from 'next/server'

export function privateJson(body: unknown, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', 'no-store, private')
  return NextResponse.json(body, { ...init, headers })
}
```

Then replace authenticated route responses:

```typescript
return privateJson(message, { status: 201 })
```

#### Configuration Changes

None.

#### Dependencies Required

No new dependencies required.

#### Migration Notes

Public marketing endpoints can continue to use cacheable responses where intentional.

---

#### Definition of Done

- [ ] **HELPER ADDED**: `privateJson()` exists.
- [ ] **AUTH ROUTES UPDATED**: Authenticated mutation/read APIs return no-store/private.
- [ ] **PUBLIC ROUTES REVIEWED**: Cacheable public routes are documented.

---

#### Verification Protocol — Prove It's Fixed

**Test 1: Header inspection**

```bash
curl -i "$APP_URL/api/messages" \
  -X POST \
  -H "Cookie: <valid session>" \
  -H "Content-Type: application/json" \
  -d '{"applicationId":"APPLICATION_UUID","body":"test"}'
```

**Expected result:** Response includes `Cache-Control: no-store, private`.  
**Failure indicator:** Cache-Control absent.

## Tier 2 — Fix Within First Month

### Fix 10: Harden Image Validation

**Severity:** MEDIUM  
**Tier:** 2  
**Effort:** Moderate (1 day)  
**Audit Reference:** Section 2.2 — Image validation trusts browser-provided MIME type and client-side processing  
**File(s):** `src/lib/storage.ts:29`, `src/app/api/upload/photo/route.ts:78`

---

#### Why This Must Change

`File.type` is client-controlled. Server validation should inspect bytes and, where possible, re-encode images so uploaded public content is actually an image and does not retain EXIF metadata.

#### Current Code (Vulnerable)

```typescript
// File: src/lib/storage.ts (lines 29-35)
// VULNERABLE — trusts file.type supplied by the client.

export function validateImageFile(file: File): ValidationError | null {
  if (!file || file.size === 0) return { kind: 'empty' }
  if (file.size > MAX_FILE_SIZE_BYTES) return { kind: 'too-large', bytes: file.size }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { kind: 'invalid-type', received: file.type ?? null }
  }
  return null
}
```

#### Replacement Code (Hardened)

```bash
npm install file-type sharp
```

```typescript
// File: src/lib/storage.ts
// HARDENED — inspect magic bytes before accepting the upload.

import { fileTypeFromBuffer } from 'file-type'

export async function validateImageFile(file: File): Promise<ValidationError | null> {
  if (!file || file.size === 0) return { kind: 'empty' }
  if (file.size > MAX_FILE_SIZE_BYTES) return { kind: 'too-large', bytes: file.size }

  const buffer = Buffer.from(await file.arrayBuffer())
  const detected = await fileTypeFromBuffer(buffer)
  if (!detected || !ALLOWED_IMAGE_TYPES.includes(detected.mime as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { kind: 'invalid-type', received: detected?.mime ?? file.type ?? null }
  }

  return null
}
```

Update callers to `await validateImageFile(file)`. Add `sharp` re-encoding as a follow-up if upload latency is acceptable, or move re-encoding to a background job.

#### Configuration Changes

None.

#### Dependencies Required

| Package | Version | Purpose | Install Command |
|---------|---------|---------|-----------------|
| `file-type` | latest | Magic-byte detection | `npm install file-type sharp` |
| `sharp` | latest | Image re-encoding/EXIF strip | `npm install file-type sharp` |

#### Migration Notes

`sharp` can increase deployment bundle size. Test on Vercel/hosting runtime.

---

#### Definition of Done

- [ ] **MAGIC BYTES CHECKED**: Upload validation rejects mislabeled non-images.
- [ ] **CALLERS AWAIT**: Upload route awaits async validation.
- [ ] **SVG REJECTED**: SVG upload attempts fail.

---

#### Verification Protocol — Prove It's Fixed

**Test 1: Mislabeled text file**

```bash
printf 'not an image' > fake.jpg
curl "$APP_URL/api/upload/photo" \
  -X POST \
  -H "Cookie: <valid session>" \
  -F "bucket=dog-photos" \
  -F "file=@fake.jpg;type=image/jpeg"
```

**Expected result:** 415 unsupported file type.  
**Failure indicator:** Upload succeeds.

### Fix 11: Transactional Account Deletion Cleanup

**Severity:** MEDIUM  
**Tier:** 2  
**Effort:** Moderate (1 day)  
**Audit Reference:** Section 4.1 — Account deletion ignores intermediate service-role cleanup errors  
**File(s):** `src/app/api/account/delete/route.ts:82`, new Supabase migration

---

#### Why This Must Change

Account deletion performs several privacy-sensitive updates but ignores their errors. The cleanup should either complete or fail before the auth user is deleted.

#### Current Code (Vulnerable)

```typescript
// File: src/app/api/account/delete/route.ts (lines 91-110)
// VULNERABLE — update errors are ignored.

await admin
  .from('applications')
  .update({ status: 'declined' })
  .in('shelter_id', shelterIds)
  .in('status', ['submitted', 'reviewing', 'accepted'])

await admin
  .from('shelters')
  .update({
    name: 'Deleted Shelter',
    email: 'deleted@fostrfind.invalid',
    // ...
  })
  .in('id', shelterIds)
```

#### Replacement Code (Hardened)

Prefer a transactional RPC:

```sql
-- File: supabase/migrations/20240122000000_account_deletion_cleanup.sql
-- HARDENED — database cleanup runs atomically before auth user deletion.

CREATE OR REPLACE FUNCTION public.prepare_account_deletion(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.applications
     SET status = 'declined'
   WHERE status IN ('submitted', 'reviewing', 'accepted')
     AND (
       shelter_id IN (SELECT id FROM public.shelters WHERE user_id = p_user_id)
       OR foster_id IN (SELECT id FROM public.foster_parents WHERE user_id = p_user_id)
     );

  UPDATE public.shelters
     SET name = 'Deleted Shelter',
         email = 'deleted@fostrfind.invalid',
         phone = null,
         location = 'Unknown',
         bio = null,
         website = null,
         instagram = null,
         ein = null,
         logo_url = null
   WHERE user_id = p_user_id;

  UPDATE public.foster_parents
     SET first_name = 'Deleted',
         last_name = 'User',
         email = 'deleted@fostrfind.invalid',
         phone = null,
         bio = null,
         avatar_url = null,
         other_pets_info = null,
         children_info = null
   WHERE user_id = p_user_id;
END;
$$;
```

Call it from the route before `admin.auth.admin.deleteUser(user.id)` and stop on RPC error.

#### Configuration Changes

Apply migration to Supabase.

#### Dependencies Required

No new dependencies required.

#### Migration Notes

Coordinate with privacy policy language. Decide whether completed history should remain pseudonymized or fully deleted.

---

#### Definition of Done

- [ ] **RPC EXISTS**: Cleanup is transactional in Postgres.
- [ ] **ERROR CHECKED**: Route stops and returns 500 if cleanup RPC fails.
- [ ] **AUTH DELETE LAST**: Auth user deletion happens only after successful cleanup.

---

#### Verification Protocol — Prove It's Fixed

**Test 1: Forced cleanup failure**

Temporarily make the RPC raise in a staging database, then call account deletion.

**Expected result:** API returns 500 and auth user still exists.  
**Failure indicator:** Auth user is deleted after cleanup failure.

**Test 2: Successful deletion**

Call account deletion for a staging user with shelter/foster data.

**Expected result:** Cleanup succeeds, auth user is deleted, remaining history is pseudonymized according to policy.  
**Failure indicator:** PII remains or route reports success after partial failure.

### Fix 12: Ignore All Local Env Files Except `.env.example`

**Severity:** LOW  
**Tier:** 2  
**Effort:** Quick fix (< 1 hour)  
**Audit Reference:** Section 5.2 — `.env` is not ignored, only `.env*.local`  
**File(s):** `.gitignore:32`

---

#### Why This Must Change

The repo currently ignores `.env*.local`, but common secret files such as `.env` and `.env.production` are still trackable. No env files are tracked right now; this fix preserves that good state.

#### Current Code (Vulnerable)

```gitignore
# File: .gitignore (lines 32-33)
# VULNERABLE — .env and .env.production are not ignored.

# local env files
.env*.local
```

#### Replacement Code (Hardened)

```gitignore
# File: .gitignore
# HARDENED — ignore all real env files, keep the template.

# local env files
.env
.env.*
!.env.example
```

#### Configuration Changes

None.

#### Dependencies Required

No new dependencies required.

#### Migration Notes

If a real env file is already tracked in another branch, remove it from git and rotate any exposed secrets.

---

#### Definition of Done

- [ ] **IGNORE UPDATED**: `.gitignore` ignores `.env` and `.env.*`.
- [ ] **TEMPLATE TRACKED**: `.env.example` remains trackable.
- [ ] **NO SECRETS TRACKED**: `git ls-files .env .env.local .env.production .env.development` returns no files.

---

#### Verification Protocol — Prove It's Fixed

**Test 1: Ignore check**

```bash
git check-ignore .env .env.production .env.local
```

**Expected result:** All files are ignored.  
**Failure indicator:** Any path is not ignored.

**Test 2: Template check**

```bash
git check-ignore .env.example
```

**Expected result:** Non-zero exit because `.env.example` is not ignored.  
**Failure indicator:** `.env.example` is ignored.

---

## Tier 3 — Ongoing Hardening

After Tier 0-2 are complete, add structured security logging, report triage/admin workflows, data export/retention tooling, dependency automation, backup restore drills, and launch load tests.

---

## Final Hardening Validation

Before considering the application hardened, execute every check below. All must pass.

### Automated Scans

- [ ] `npm audit --audit-level=high` exits 0.
- [ ] `node node_modules/typescript/bin/tsc --noEmit` exits 0.
- [ ] `node node_modules/next/dist/bin/next build` exits 0.
- [ ] `node node_modules/eslint/bin/eslint.js src/` exits 0 or only reports pre-existing accepted warnings.

### Supabase Security Checks

- [ ] Direct RPC calls to transition functions fail for unrelated users.
- [ ] Direct Storage upload outside caller folder fails.
- [ ] RLS remains enabled on all public tables.
- [ ] No `SECURITY DEFINER` function can mutate data without checking `auth.uid()` or being service-role-only by design.

### API Abuse Checks

- [ ] `/api/notifications/send` cannot send arbitrary user-controlled emails.
- [ ] Mutation routes reject cross-origin requests.
- [ ] Authenticated API responses include `Cache-Control: no-store, private`.
- [ ] Rate limits work across deployed instances.

### Browser Security Checks

- [ ] Production responses include CSP, HSTS, frame, content-type, referrer, and permissions headers.
- [ ] Core flows have no unexpected CSP violations.
- [ ] Public images still render from allowed hosts.

### Operational Checks

- [ ] Sentry receives production server and client errors without PII leakage.
- [ ] New safety reports alert support/admin staff.
- [ ] Backup restore drill has been completed against staging.
- [ ] Incident owner and rollback procedure are documented.
