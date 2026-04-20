# Agent Handoff · 2026-04-20 (3rd Session)

Written for the next agent picking up this project. **Read this before doing anything else.** Prior handoffs (especially `AgentHandoff_2026-04-20_session-2.md`) still describe the environment, tooling, and codebase patterns — this file only covers what changed in **session 3**.

**Session covered:** Phase 5 Steps 37–38 complete (2/9). Work lives on `main` as two standalone commits. No branch dance this time — the landing-only scope is low enough risk that each step shipped directly.
**Repo state at handoff:** working tree clean on `main` (2 commits ahead of `origin/main`), `.serena/` still untracked (intentional).

---

## What shipped

| Step | Commit | Ship |
|------|--------|------|
| 37 | `5818cec` | `src/app/page.tsx` — asymmetric 7/5 hero, curated Unsplash portrait (`photo-1583337130417-3346a1be7dee`, already proven stable in `scripts/seed.ts`) wired through `next/image` with `priority` + explicit width/height + 4:5 aspect ratio. Layered warm-honey radial washes + SVG `feTurbulence` grain overlay at opacity 0.035. Pulsing-dot eyebrow chip ("Open for new fosters"), display-italic primary accent on the second headline line, floating 4.9-rating trust card over the photo frame, offset warm panel behind the frame (editorial magazine motif). Full-width social-proof strip with a 3-stat grid (`STATS` array top-of-file) and a pilot-network caveat line. Tailwind ambiguity warning on `delay-[350ms]` resolved by using the named `delay-300` scale. |
| 38 | `b994b96` | How It Works rebuilt as 3 editorial cards (colored top strip, oversized watermark step number, layered icon tile with accent dot, hover lift, staggered entrance via inline `animationDelay`). New shared `src/components/public-footer.tsx` — 4-column Brand / Platform / Company / Legal + bottom strip — and swapped in on `/`, `/terms`, `/privacy`. Root-layout metadata extended: `description`, `metadataBase`, `title.template`, `openGraph`, `twitter` (copy-only — no `og:image` yet). |

Plus: `docs/roadmap.md` updated with **Status: ✅ Shipped 2026-04-20 (session 3)** markers on Steps 37 + 38 and four new Deferred Follow-ups Log rows (pilot-network stats, Unsplash hero, missing social icons, missing `og:image`/`sitemap.xml`/`robots.txt`).

---

## Environment

No new env vars, no new deps, no new scripts. The full session ran against the same `node_modules` that Phase 4 left us. The Node 25 `npx` quirk from session 2 still applies — keep using `node node_modules/<bin>/...` for `next`, `tsc`, `eslint`.

---

## Codebase patterns introduced in Phase 5 (landing only)

- **Public-surface footer is one component, reused.** `src/components/public-footer.tsx` is the single source of truth for the footer shown on `/`, `/terms`, and `/privacy`. Authenticated portals deliberately do not import it — they live inside the `(foster)/` and `(shelter)/` layouts and have their own sidebar chrome. If a new public page lands (pricing, about, etc.), import `PublicFooter` rather than re-inlining a footer.
- **Placeholder links are refused, not styled.** Roadmap Step 38 called for Instagram + Twitter icons; the Agent Code Quality Protocol says "no placeholder values," so the footer ships with `Mail` only (pointing at the real `SUPPORT_EMAIL` constant) and social is logged as deferred. When real handles land, add them to the brand column with the same circular-border styling and `aria-label` pattern used by the existing Mail icon. Do **not** use `href="#"` to ghost-wire them.
- **`metadataBase` avoids pulling the Resend SDK into every page bundle.** Session 1 added `getAppUrl()` to `src/lib/email.ts`. That module also imports `Resend`, so using it from `src/app/layout.tsx` would bloat the root bundle. Step 38 inlines the tiny app-URL fallback logic at the top of `layout.tsx` rather than importing the helper. If another layout-level surface ever needs the same value, extract it to `src/lib/app-url.ts` (resend-free) instead of importing from `lib/email`.
- **Social-proof numbers are explicitly flagged as placeholder.** `STATS` is top-of-file in `src/app/page.tsx` and a single caveat line ("Based on our pilot network of early partner shelters.") sits below the grid. When Analytics lands (Remaining Items), replace the hardcoded strings and delete the caveat in the same PR — the existing markup doesn't need to change.
- **Animation entrance timing uses inline `style`, not arbitrary Tailwind.** How-It-Works cards use `style={{ animationDelay: '<n>ms' }}` keyed off the map index. This avoids Tailwind's arbitrary-value warning on `delay-[120ms]` etc. (the same warning we hit on the hero). The `animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-fill-mode:both] motion-reduce:animate-none` class trio is still the canonical entrance pattern — only the per-item delay is inline.
- **`scroll-mt-20` on `#how-it-works`.** The landing header is `sticky top-0 h-16`, so an anchor link without scroll margin lands the section title under the header. `scroll-mt-20` is one pattern-break to remember for future anchored sections.

---

## Known trade-offs / deferrals

All logged in `docs/roadmap.md` "Deferred Follow-ups Log" under 2026-04-20 rows. The Phase-5-session-3 additions worth re-reading:

1. **Hero photograph is a third-party Unsplash URL.** Stable CDN but not owned. Pre-launch brand work should commission/license an exclusive hero photo and replace `HERO_IMAGE_SRC` at the top of `src/app/page.tsx`. Aspect is fixed at 4:5.
2. **Stats numbers are placeholder pilot-network figures.** Real counts land with the Analytics integration (Remaining Items). The caveat line under the grid is what prevents them from reading as fabricated.
3. **Public footer ships Mail only.** Instagram / Twitter / LinkedIn icons wait on real handles — see pattern note above.
4. **`og:image`, `sitemap.xml`, `robots.txt` still unshipped.** Step 38 added copy-only social metadata (title/description/twitter card). The remaining three are gated on (a) a real hero image, (b) a Next Route Handler for the sitemap, (c) a `src/app/robots.ts`. Don't do any of the three until the brand hero lands — otherwise the sitemap's social-preview will point at the current Unsplash placeholder.

---

## Things that should look broken but aren't

- **`[middleware] getUser failed: Auth session missing!` on public pages in dev.** This is pre-existing Phase-3 noise, not new. The middleware tries to resolve the user on every request; when no one is logged in, it logs and moves on. Not a Phase 5 regression.
- **`[env] Missing optional env vars (dev): RESEND_FROM`.** Also pre-existing — the soft-tier env check warns and moves on. Phase 4's `src/lib/env.ts` tier split is doing exactly what it's supposed to.
- **The offset warm panel behind the hero photo uses `translate-x-4 translate-y-4` rather than negative `bottom` / `right` positioning.** Don't "fix" it — my first draft mixed `-bottom-5 -right-5` with `inset-0` and ended up with a skewed box. The translate approach cleanly produces the intended "same-sized box, offset down-right" motif without tailwind-class conflicts.

---

## Recommended first actions for the next agent

1. **Read `docs/roadmap.md` Step 39** (filter pills). It's the next Phase 5 step and should be one commit on its own. Target files: `src/components/foster/filter-sidebar.tsx` only — don't also touch empty-states or onboarding in the same commit, each step is its own commit per the protocol.
2. **If the user asks you to merge Phase 5 to a feature branch**, note that session 3 shipped directly to `main`. Sessions 4+ can either continue on `main` (low risk for landing-adjacent changes) or switch to a `claude/phase-5` branch. Ask the user — don't decide unilaterally.
3. **If you touch the landing page again**, read `src/app/page.tsx` end-to-end first. The hero and How-It-Works section have interlocking animation timings and the `STATS` + `HOW_IT_WORKS_STEPS` + `ACCENT_CLASSES` constants at the top of the file are the canonical edit points for content changes.
4. **Run `git log --oneline -5` and confirm** you see `b994b96` and `5818cec` at the top. If you see `origin/main` diverged, the user has pushed — don't amend or force-push without asking.

---

## Progress toward Phase 5 completion

- ✅ Step 37 — Hero redesign
- ✅ Step 38 — How It Works + Footer (+ metadata copy upgrade)
- ⬜ Step 39 — Filter pills (`src/components/foster/filter-sidebar.tsx`)
- ⬜ Step 40 — Illustrated empty states (`src/components/empty-state.tsx` + audit call sites)
- ⬜ Step 41 — Form polish (section headers, required asterisks, validity checks, sticky save bar)
- ⬜ Step 42 — Incoming message avatars (`src/components/messages/message-thread.tsx`)
- ⬜ Step 43 — Onboarding redesign (`src/app/onboarding/page.tsx`)
- ⬜ Step 44 — Page transitions + card entrance animations
- ⬜ Step 45 — Responsive + print + content centering

Seven steps to go. Commit per step, each gets its own end-of-session handoff if the session covers ≥2 steps.
