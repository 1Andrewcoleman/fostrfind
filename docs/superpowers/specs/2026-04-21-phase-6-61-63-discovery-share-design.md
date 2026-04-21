# Phase 6 · 6.1 + 6.3 — Shelter-aware discovery & Share on dog detail (design)

**Date:** 2026-04-21
**Status:** Design approved — pending implementation plan
**Source:** Brainstorming session 2026-04-21 (see agent transcript)
**Roadmap anchors:** `docs/roadmap.md` → "Phase 6: Discovery, Trust & Safety (Backlog)" §6.1 and §6.3
**TODO anchor:** `docs/TODO.md` §27 (Phase 6 backlog mirror)

This spec covers a single design slice: **shelter-aware discovery** (browse + `/shelters` index) plus **share on the dog detail page**. Other Phase 6 items (6.2, 6.4, 6.5, 6.6, 6.7) are deliberately out of scope and will be specced separately.

---

## 1. Scope

### In scope

- **6.1 — Shelter-aware discovery**
  - **Browse:** extend the existing foster browse search/filters so a foster can narrow results by shelter. Concretely, add a new filter dimension keyed off **shelter slug** (derived from the nested `shelters` relation on each dog). The dimension participates in URL state via a new search param alongside the existing `q` / filter params.
  - **`/shelters` index:** new public server-rendered page listing all shelters the foster-facing product considers public. Each row links to the existing public profile at `/shelters/[slug]`. Each row also exposes a **"See their dogs"** CTA that deep-links into `/foster/browse` with the new shelter param pre-populated.
  - **Search on `/shelters`:** one text box filtering on shelter name (case-insensitive `ilike` on `shelters.name`). Empty results render an `EmptyState` with a clear reset CTA.

- **6.3 — Share on dog detail**
  - One **Share** control on `/foster/dog/[id]` (primary button or icon next to the existing apply CTA — exact placement is an implementation-plan detail, not a design decision).
  - Canonical share URL is the **absolute** form of `/foster/dog/[id]` built via `getAppUrl()` (already used by email templates — see `src/lib/email.ts`).
  - Behavior: call `navigator.share({ title, text, url })` when available; otherwise copy the URL to clipboard and fire a single Sonner success toast. On `navigator.share` rejection (user cancelled, not an error), **do nothing** — no fallback toast, no copy. On `navigator.clipboard` failure, show an error toast with static copy.
  - **Public teaser** behavior on `/foster/dog/[id]`:
    - Logged out **or** logged-in non-foster user → **teaser** (defined in §3).
    - Logged-in foster with a complete profile → **full detail** (current behavior preserved).
  - **Metadata / OG:** `generateMetadata` returns title + description sourced from teaser-safe fields only (dog name, species inference, one-line summary, shelter name). `og:image` remains deferred per roadmap; this spec does not block on a brand asset.

### Out of scope (deferred to later Phase 6 specs)

- 6.2 shelter-side foster directory / history.
- 6.4 mutual reporting.
- 6.5 saved dogs + save counts.
- 6.6 map view of shelters in radius.
- 6.7 verification playbook synthesis.
- Share affordances on browse cards or on `/shelters`. Detail-only for v1.
- A public non-`/foster/...` URL for a dog (canonical stays `/foster/dog/[id]`).
- `og:image` generation, `sitemap.xml` entries for shelters, `robots.txt` updates beyond what's already shipped.

---

## 2. Architecture

### 2.1 Dog detail route — single entry, role-aware branching

**Decision:** keep the canonical URL `/foster/dog/[id]`. Remove the blanket `RoleGuard allowedRole="foster"` effect from this specific route so that anonymous users can load it, but preserve role-correct rendering inside the page itself.

There are two acceptable ways to achieve this in Next.js App Router; implementation plan will pick one. Both are compatible with this design.

- **Option A — pull `/foster/dog/[id]` out of the `(foster)` route group:** create a sibling non-grouped route (e.g. `src/app/dog/[id]/page.tsx`) at the public URL `/dog/[id]` and make `/foster/dog/[id]` a permanent redirect to it. This is the cleanest structurally but breaks our pre-approved canonical URL decision, so it is **not used**.
- **Option B (chosen) — nest the page such that `(foster)/layout.tsx`'s `RoleGuard` does not cover it:** move the page file under a sibling segment inside the `(foster)` group that uses a local `layout.tsx` without `RoleGuard` (or equivalent mechanism — e.g. a dedicated `(foster)/dog/[id]/layout.tsx` that renders `{children}` with the portal chrome suppressed for non-foster viewers). The URL stays `/foster/dog/[id]`.

Either way, the **page component** is a single server component that:

1. Calls `createClient()` and `auth.getUser()` (following the existing audit pattern — 503 on auth service error, fall through on null user).
2. Fetches the dog by id (joined with shelter summary) using the existing public-read policies (`20240105000000_shelters_public_read.sql`). If the dog is not `available`, render a **"no longer available"** fallback with a link to `/foster/browse` (logged-in fosters) or `/shelters` (anyone else). No leak of status-specific internals.
3. Decides the view mode:
   - `full` if the user is a foster with a `foster_parents` row.
   - `teaser` otherwise (anonymous **or** non-foster authenticated — shelter staff, fosters mid-onboarding, etc.).
4. Renders the chosen variant. Share control is present in **both** variants; apply CTA behavior differs (see §3).

### 2.2 Browse — shelter dimension

**Decision:** shelter filter is keyed off **slug**, not UUID. Slugs are human-readable in URLs and are already guaranteed unique by the existing migration trail. URL param: `shelter`.

- `src/components/foster/filter-sidebar.tsx` gains a shelter pill/chip row or a simple read-only chip describing the active shelter (implementation detail for the plan). There is **no** shelter name autocomplete in v1 — the filter is populated primarily by deep-linking from `/shelters`, not by typing.
- Browse page reads `shelter` from `useSearchParams`, applies client-side filter on `dog.shelter.slug`, and shows a removable chip above the grid (matches the existing removable-chip pattern for `q`, `size`, `age`, `maxDist`).
- If `shelter` is set but no dogs match, the empty state adopts the existing "no dogs match your filters" illustration with a reset CTA that clears the chip.
- **Server-side filter push-down** is deferred — same reasoning as the existing text search / distance filter (2026-04-19 Follow-ups Log). Logged as a §27 deferral.

### 2.3 `/shelters` index — new public page

- New file: `src/app/shelters/page.tsx` (sibling to the existing `src/app/shelters/[slug]/page.tsx`). Server component. No auth required; no portal chrome — uses the same minimal public header + `PublicFooter` pattern used by `/terms` and `/privacy`.
- Fetch: `select id, slug, name, logo_url, location, short_bio, is_verified from shelters order by name asc` with a `limit` appropriate for the current fleet (see §4). Public read policy already exists.
- Search: single `<input name="q">` text field. On submit (or debounced change — plan decision) it updates the URL param `q` and re-renders. Server component reads `q` from `searchParams` and applies `ilike` server-side (no client-side filtering, consistent with public surfaces).
- Each row links to `/shelters/[slug]` for full profile; a secondary inline link/button labeled **"See their dogs"** deep-links to `/foster/browse?shelter=<slug>`.
- Empty state (no shelters match) uses the existing `EmptyState` component with the `search` illustration.
- **Pagination:** not in v1 — use a reasonable cap and display a "showing N shelters" footer line. Server-side pagination is a §27 carry-over when the fleet justifies it.

### 2.4 Share control on dog detail

- New component: `src/components/foster/share-button.tsx` (client component). Receives `{ url: string, title: string, text: string }` props; renders a single button (labeled "Share" on wide screens, icon-only on narrow — handled by existing Tailwind patterns).
- Handler:
  1. If `typeof navigator !== 'undefined' && 'share' in navigator`, `await navigator.share({ url, title, text })`.
      - If it resolves → no UI change (the share sheet closed after the user chose or cancelled).
      - If it rejects with `AbortError` (user cancelled the OS sheet) → silently swallow.
      - If it rejects with any other error → fall through to copy path.
  2. Else call `navigator.clipboard.writeText(url)`:
      - On success → Sonner success toast: **"Link copied — share it anywhere."**
      - On failure (e.g. insecure context, permissions denied) → Sonner error toast: **"Couldn't copy the link. Try long-pressing the URL in your browser."**
- Analytics hook is a no-op stub today — leave a single comment pointing at the future event name (`share_dog_clicked`) so the eventual analytics integration has an obvious insertion point without adding a library now.
- **No `navigator.share` feature detection via user-agent strings** — only the presence check above. Browsers that ship `navigator.share` but throw on non-HTTPS fall through to the clipboard branch cleanly.

### 2.5 URL / metadata plumbing

- The absolute URL is built once at the top of the dog detail page via the existing `getAppUrl()` helper (`src/lib/email.ts`), or — if that helper's coupling to the Resend SDK still matters post Phase 5-b — a new leaf helper `src/lib/app-url.ts` (resend-free) called from both places. The implementation plan picks one.
- `generateMetadata` for `/foster/dog/[id]`:
  - `title`: `<Dog Name> — Fostr Fix` (uses existing root `title.template`).
  - `description`: one sentence composed from name + shelter name + one headline attribute (age or size). Truncated to ~160 chars for OG compliance.
  - `openGraph`: title/description only, no image. `twitter.card: 'summary'` (not `summary_large_image`) until a real og:image exists.
  - Function must `try/catch` the Supabase fetch and return a fallback (`{ title: 'Dog — Fostr Fix' }`) on failure (existing Phase 4 pattern).

---

## 3. Views: teaser vs full

### 3.1 Teaser (logged out, or any signed-in non-foster)

Visible content:

- Dog name, primary photo (if any), size / age / gender badges, medical-needs badge if set.
- Shelter block: logo, name, location, link to `/shelters/[slug]`.
- Short description (first ~240 chars, truncated with ellipsis if longer).
- **Share** button (same component, same canonical URL).
- **Primary CTA:** "Sign up to apply" → `/signup` (preserve any `returnTo` query param convention already used by `AuthGuard`). Secondary link: "Already have an account? Log in" → `/login`.
- **No** internal notes, no application-flow state, no other-applicant counts, no messaging affordances.

Chrome:

- Minimal public header (same pattern as `/`, `/terms`, `/privacy`) and `PublicFooter`.
- No portal sidebar, no foster nav, no DEV_MODE banner. This is a public-looking page.

### 3.2 Full (logged-in foster with profile)

- Existing `/foster/dog/[id]` experience, unchanged: full description, apply button (with duplicate-application guard already in place), shelter profile link, photos, etc.
- **Share** button is added (same component). Sits near the apply CTA.
- Portal chrome (foster sidebar, nav) remains.

### 3.3 Dog not available

- Regardless of auth state, if the dog's status is not `available` (e.g. `pending`, `placed`, or deleted), the page renders a small card: headline "This dog isn't available right now.", one-sentence body, and two buttons — **"Browse available dogs"** (→ `/foster/browse` if logged-in foster, else `/shelters`) and **"About Fostr Fix"** (→ `/`).
- No share control on this state.
- 404 is reserved for genuinely-missing rows (bad id).

---

## 4. Data, privacy, and security

- **No new tables** for this slice. Existing `dogs` + `shelters` + public RLS policies cover both views.
- **Teaser data:** only columns already readable by the public `shelters_public_read` policy chain plus `dogs` fields rendered on browse cards. Concretely: do not select `shelter_note`, `applications`, or `foster_parents` anything in the teaser query. Write a **narrow** select list in the page, not `select *`.
- **Non-foster authenticated users receive the teaser** (per brainstorming answer C). This means a shelter staff user who opens a shared link does not see anything beyond what a logged-out public viewer would see, and the URL does not become a hidden backdoor into foster-only internals.
- **DEV_MODE:** the public teaser must render in DEV_MODE using the existing placeholder-data fallback pattern. Shelter staff browsing without Supabase credentials still see a coherent teaser.
- **`/shelters` index query:** bounded by a `limit` constant (design value: 200 — if fleet exceeds this, pagination ships in a follow-up). No PII risk — all fields are already public on `/shelters/[slug]`.
- **Rate limit:** `/shelters` is read-only and server-rendered; no per-request API. Share is entirely client-side. **No new rate-limit entries** needed for this slice.

---

## 5. Errors and edge cases

| Case | Behavior |
|---|---|
| `shelter` param on browse is unknown/malformed | Apply filter; result is empty; chip reads the slug verbatim; clear-chip resets |
| Multiple `shelter` values in URL | Use the first; ignore the rest |
| `navigator.share` not available | Fall through to clipboard |
| Clipboard blocked (insecure context, permissions) | Error toast with actionable copy; no console trace beyond `[share] clipboard failed` |
| Dog `status != 'available'` | "Not available right now" card (see §3.3) |
| Anonymous user on full-detail page (race: auth just expired) | Next render is teaser; no crash |
| `getAppUrl()` returns a dev URL in prod build | Accepted — that's a Phase 4 env follow-up, not a new regression |
| `/shelters` search query contains SQL-special chars | Supabase `ilike` escapes safely; no new sanitization required |
| `generateMetadata` Supabase fetch fails | Return static fallback `{ title: 'Dog — Fostr Fix' }` |

---

## 6. Files touched (expected)

New:

- `src/app/shelters/page.tsx` — public shelter index.
- `src/components/foster/share-button.tsx` — share control.
- *(Optional)* `src/lib/app-url.ts` if extracted from `src/lib/email.ts`.

Modified:

- `src/app/(foster)/foster/dog/[id]/page.tsx` — branch on view mode; wire teaser.
- `src/app/(foster)/foster/dog/[id]/layout.tsx` — existed only for metadata previously; now adjusted to either drop `RoleGuard` effect for this subtree or nest a non-guarded wrapper.
- `src/components/foster/filter-sidebar.tsx` — read/render `shelter` param; removable chip.
- `src/app/(foster)/foster/browse/page.tsx` — thread `shelter` through to filter state; include chip in results header.
- `src/components/foster/browse-dog-card.tsx` — only if the teaser shares rendering with the card; probably unchanged.
- `docs/roadmap.md` — flip §6.1 and §6.3 to a Step-numbered entry when implementation lands; add to Deferred Follow-ups Log for any deferrals this slice introduces.

Not touched in this slice:

- Any RLS, storage, or email infrastructure.
- Any shelter portal code.
- Any authentication flow code beyond reading the current user inside the dog page.

---

## 7. Testing / verification

Manual (gated on real Supabase project with seeded data):

1. **Anonymous** visitor → `/foster/dog/<seeded-available-dog-id>` → teaser loads, share button works, signup CTA routes to `/signup`.
2. **Foster** visitor on same URL → full detail, share button works.
3. **Shelter** staff on same URL → teaser (identical to anonymous — confirm no internal fields leak in the HTML).
4. **Unavailable dog** on that URL → "not available right now" card; no 500.
5. `/shelters` page loads; search narrows by name; "See their dogs" deep-links correctly; chip on browse matches the shelter.
6. Browse with `?shelter=<slug>` pre-filters; clearing the chip restores default results.
7. Share in iOS Safari (real device) → OS share sheet opens.
8. Share in Chrome desktop (no `navigator.share`) → clipboard toast.

Automated:

- If any pure URL/filter helpers are extracted (e.g. `buildShelterBrowseUrl(slug)`), add Vitest unit tests under `src/lib/__tests__/`. No component tests required for this slice — consistent with the existing Phase 4 jsdom deferral.
- `node node_modules/typescript/bin/tsc --noEmit` clean.
- `node node_modules/eslint/bin/eslint.js src/` clean.
- `node node_modules/next/dist/bin/next build` green.

---

## 8. Deferrals introduced by this slice (to be logged on implementation)

- **Server-side `shelter` filter on browse** — client-side for v1, same shape as existing `q` and `maxDist` filters. Push-down belongs with §27's browse query refactor.
- **Shelter index pagination** — capped at 200 rows initially; revisit when fleet requires.
- **Share analytics event** — insertion point stubbed; real wiring lands with the broader analytics integration (Remaining Items).
- **`og:image`** — continues to wait on the brand hero asset; teaser pages ship with copy-only OG.

Each of these will be appended to `docs/roadmap.md`'s "Deferred Follow-ups Log" at implementation time, per the Agent Code Quality Protocol.

---

## 9. Success criteria

- A foster or a curious friend-of-a-shelter can open a shared `/foster/dog/[id]` link in any browser, see the dog, see which shelter is listing them, and either sign up to apply or navigate to `/shelters` for more context — **without hitting a login wall**.
- A foster browsing `/foster/browse?shelter=<slug>` sees only that shelter's dogs, can clear the filter in one click, and understands via the chip why results are scoped.
- A signed-in shelter staffer clicking a teammate's shared dog link sees a predictable preview, not a route-guard redirect and not foster-only internals.
- No regressions on the existing apply flow, duplicate-application guard, or `/shelters/[slug]` profile page.
