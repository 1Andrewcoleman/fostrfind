# Agent Handoff · 2026-04-20 (4th Session) — Phase 5-b Visual Migration

Written for the next agent picking up this project. **Read this before doing anything else.** Prior handoffs (especially `AgentHandoff_2026-04-20_session-3.md`) still describe Steps 37–38 as originally shipped, but this session pivoted the design direction mid-stream. This file covers what changed in **session 4** — the entire Phase 5-b visual migration.

**Session covered:** Phase 5-b Commits 0–7 (7/7). Work lives on `main` as seven standalone commits, each independently revertable.
**Repo state at handoff:** working tree clean on `main`, still ahead of `origin/main` (session 3 commits never pushed, plus all of 5-b). `.serena/` remains untracked (intentional).

---

## Why session 4 exists at all

Session 3 shipped Steps 37–38 ("landing hero redesign with social proof" + "how-it-works + footer") under the **old** warm-honey / amber direction. That ship included a prominent "4.9 rating from foster parents" trust card and a "2,400 Dogs Fostered" social-proof stats bar.

The user returned and immediately rejected both: the numbers were placeholder pilot-network figures, and shipping invented metrics as trust signals on an animal-welfare platform is not acceptable. Everything else was collateral damage: the saturated amber palette, faux-bolded italic hero accent, and every SVG grain-overlay decoration.

Instead of patching, the user ran `/impeccable teach` to lock a new design context from first principles (`.impeccable.md`) and asked for a migration plan. That plan is `docs/Phase5b_VisualMigration_Plan.md` — a 7-commit sequence designed so the token swap + utility audit ship in **one** big commit (Commit 1), and every surface gets restyled against that uniform system in the following six.

**If you read nothing else from this handoff, read `.impeccable.md`.** Every visual decision from here on is derived from it. If it conflicts with `docs/roadmap.md` or any prior handoff, `.impeccable.md` wins for visual choices; the roadmap wins for product scope.

---

## What shipped (7 commits)

| # | SHA prefix | Commit title | Scope |
|---|-----------|--------------|-------|
| 0 | `b728989` | `chore(docs): establish .impeccable.md design context and CLAUDE.md pointer` | `.impeccable.md` (new), `CLAUDE.md` pointer section. Single source of truth: five design principles, locked typography + OKLCH color tokens. |
| 1 | `2310e0a` | `feat(design): migrate to OKLCH tri-pastel palette and Source Serif 4 + Switzer` | `globals.css`, `tailwind.config.ts`, `layout.tsx`, new `src/app/fonts/switzer/*.woff2`, plus every `text-warm` / `bg-warm` / `chart-N` utility class in `src/` reclassified. **The big one** — app appearance changes globally here. |
| 2 | `110b424` | `feat(landing): remove placeholder metrics and fake rating card` | `page.tsx` only. `STATS` array + the "2,400 / 180+ / 4.9" band deleted. Floating 4.9-rating card over the hero photo deleted. One-line comment at file top citing `.impeccable.md` to prevent re-addition. |
| 3 | `92c69e9` | `feat(landing): hero restyle against calm-contrast direction` | `page.tsx` only. Italic accent dropped, SVG grain removed, warm panel → butter, eyebrow chip pulse removed, CTAs rebalanced as two equal doors (peach = shelter, butter = foster), H1 `font-extrabold` → `font-semibold` to stop faux-bolding Source Serif 4. |
| 4 | `de9cedc` | `feat(landing): how-it-works restyle with semantic pastels` | `page.tsx` only. Card top-strips remapped to peach/butter/sage per product role. Section H2 becomes the page's single Source Serif 4 editorial accent. Hover lift shortened to 200ms / `-translate-y-0.5`. Watermark number muted to 0.04 alpha. |
| 5 | `5808131` | `feat(landing): public-footer restyle and metadata review` | Shared footer paws repointed from `text-warm` → `text-primary`. Every `from-warm/30 to-primary/20` gradient on shelter pages flattened to `bg-peach/30`. `terms/privacy` H1s to `font-semibold tracking-tight`. `og:image` deliberately deferred (empty tag is worse than no tag). |
| 6 | *latest* | `feat(portal): align portals to tri-pastel palette and wire next-themes` | Second-biggest commit. Status badges + stepper + accept buttons collapsed to three pastels + destructive. Dashboard stat chips take semantic pastels. `next-themes` wired via new `PortalThemeProvider`, mounted only in shelter + foster layouts. Dark OKLCH palette derived in `.impeccable.md` and `globals.css`. Sun/moon toggle added to `portal-sidebar-user.tsx`. |
| 7 | *this commit* | `docs: phase 5-b wrap — update roadmap markers, handoff` | `roadmap.md` Steps 37–45 marked superseded / folded. New Phase 5-b summary block + progress tracker row. This handoff. |

---

## New primitives worth knowing about

### `.impeccable.md` (new file)

The design-context source of truth. Five principles:

1. **Restraint over richness** — one meaningful element per moment.
2. **Calm contrast** — no pure black / pure white; narrow lightness band.
3. **Typography leads** — Source Serif 4 only in H1s + one editorial accent per page; Switzer everywhere else.
4. **Three pastels, each with a job** — butter = brand/foster/CTA; sage = success/placement/verified; peach = shelter-side/in-progress.
5. **Motion responds to intent** — no autoplay loops, no decorative pulses, ≤500ms staggered page entrances, `motion-reduce:animate-none` on everything.

If you're about to write CSS and you can't say which principle is driving it, stop.

### OKLCH tokens (`src/app/globals.css`)

Both light and dark palettes shipped. The dark palette **only applies inside the portal** — public pages stay light-only. Dark tokens are mirrored in `.impeccable.md` for reference — if you edit one side, edit both. `--warm` has changed meaning from "honey amber" to "sage / success"; old code that used `text-warm` for brand / paw-icons now uses `text-primary`. Any new component that wants to signal "done / completed / placed" uses `text-warm`. Shelter-side lives on the new `--accent-peach` token, exposed via `colors.peach` in `tailwind.config.ts`.

### Font system

- **Source Serif 4** via `next/font/google`, weights 400/600 only. Bound to `--font-display`. Applied with `font-display` utility class. Reserve for H1s + one editorial accent per page.
- **Switzer** via `next/font/local`, weights 300/400/500/600/700. Self-hosted under `src/app/fonts/switzer/*.woff2`, sourced from [fontshare.com/fonts/switzer](https://www.fontshare.com/fonts/switzer). Bound to `--font-sans` and applied on `<body>`. All UI text.
- **Do not reintroduce Inter or Plus Jakarta Sans.** Both were removed in Commit 1. If you need a sans, you already have Switzer.

### `PortalThemeProvider` (`src/components/portal-theme-provider.tsx`)

Thin wrapper around `next-themes` with the project's conventions baked in (`attribute="class"`, system default, `disableTransitionOnChange`). Mounted only in `(foster)/layout.tsx` and `(shelter)/layout.tsx`. Public pages never see it. Root `<html>` has `suppressHydrationWarning` because `next-themes` mutates the class attribute post-hydration.

### Theme toggle (`portal-sidebar-user.tsx`)

Sun/moon button next to the sign-out button. Mount-guarded (`useEffect(setMounted)`) to avoid SSR hydration warnings. No cross-fade on swap (principle 5) — icon simply swaps.

### Status-badge + stepper collapse

`status-badge.tsx` and `foster/application-stepper.tsx` both used to map 5–9 application/dog states to 5–9 Tailwind palette tints (blue-100, amber-100, green-100, red-100, purple-100, emerald-100, sky-100, violet-100…). Now they collapse to the three-pastel + destructive system:

- in-progress / shelter-side → **peach**
- success / positive terminal state → **warm (sage)**
- declined → **destructive**

Two badges in the same family (e.g. `submitted` + `reviewing`) render the same color — the icon carries the fine-grained difference. If you add a new status, it has to fit one of these buckets or you're inventing a fourth pastel, which is banned.

---

## Things that should look broken but aren't

- **`bg-peach/40` DEV_MODE banner in portals.** Used to be `bg-yellow-400 text-yellow-900`. Peach is the same product-alert semantic, just quieter and on-palette. Don't "fix" it.
- **Attribute chips (age / size / gender) on `browse-dog-card.tsx` all render on `bg-muted`.** They used to be amber-50 / teal-50 / pink-50-vs-sky-50. These are metadata, not statuses; they don't earn pastel airtime, and the gender-color pairing (pink/sky) was drifting into stereotype. Icon carries the attribute.
- **Shelter "Verified" badge is sage, not emerald-100.** Verified is a success state; success lives on warm.
- **Star-rating stars are peach, not amber/yellow.** Ratings are a shelter-side / evaluation signal, not a success signal.
- **Hero "offset panel" uses `translate-x-4 translate-y-4` rather than negative `bottom`/`right` positioning.** Session 3's first draft mixed `-bottom-5 -right-5` with `inset-0` and got a skewed box. Translate preserves the "same-sized offset box" motif cleanly. Still that way post-migration.

---

## Known trade-offs / deferrals

See `docs/roadmap.md` → "Phase 5-b follow-ups" for the full list. Highlights:

1. **Dark mode contrast sweep.** Tokens shipped and the toggle works, but a full visual pass through every portal surface in dark mode hasn't happened yet. Shadcn dialog overlays, toast tints against dark surfaces, and any `bg-white` / `bg-background` conflicts in deeper components may need cleanup. This is a "walk every portal page in dark, note anything illegible" task.
2. **Public pages can go dark-by-accident.** Because `next-themes` writes to `document.documentElement`, a user who toggles dark in the portal and then navigates to `/`, `/terms`, `/privacy`, `/login`, or `/signup` will see the dark tokens apply. The plan was "portals only," and the public pages weren't designed for dark — they still *work* (all tokens have `.dark` values) but haven't been visually approved in dark mode. If the user cares, the fix is to scope the toggle to only change theme when inside a portal layout, or to force `data-theme="light"` on public pages. Logged, not fixed.
3. **`og:image` still deferred.** Copy-only social metadata shipped in Commit 5; `og:image`, `sitemap.xml`, `robots.txt` wait on a real brand hero image (not the current Unsplash placeholder).
4. **Phase 5 Steps 39–45 are folded, not done.** Filter pills, empty states, form polish, message avatars, onboarding redesign, page transitions, responsive polish. Each is its own follow-up commit against the new design system. Nothing in them requires another token migration.

---

## Environment

No new env vars, no new runtime deps (`next-themes` was already installed from Phase 4's shadcn setup). Font files were added under `src/app/fonts/switzer/` — they're committed, not gitignored. Total payload impact: ~60KB across 5 Switzer weights. Source Serif 4 is served from Google Fonts via `next/font/google`, subsetted to latin.

Node 25 `npx` quirk still applies — keep using `node node_modules/<bin>/...` for `next`, `tsc`, `eslint`. Session 4 verification commands that worked:

- `node node_modules/typescript/bin/tsc --noEmit` — exit 0
- `node node_modules/eslint/bin/eslint.js src/` — exit 0
- `node node_modules/next/dist/bin/next build` — exit 0, full route tree renders

---

## Recommended first actions for the next agent

1. **Read `.impeccable.md` end-to-end.** It is short. It governs every visual decision.
2. **Glance at `docs/Phase5b_VisualMigration_Plan.md`.** Shows the reasoning for why the migration was structured as 7 commits instead of one big one — the "coupling" section explains why incremental token migration is impossible.
3. **Walk the app in dark mode.** Sign into a foster or shelter account, toggle the moon icon in the sidebar, and look for anything unreadable or off-palette. This is the "dark mode contrast sweep" follow-up above.
4. **Pick one Phase 5-b follow-up.** Filter pills (was Step 39) is the cleanest first one — small scope, one file (`src/components/foster/filter-sidebar.tsx`), no palette decisions needed since palette is locked.
5. **Do not re-add fake metrics.** Top-of-file comment on `src/app/page.tsx` exists specifically to catch this. If a PM asks for a trust-signal section on the landing page, point at `.impeccable.md`'s "Trust signal strategy" section.
6. **Run `git log --oneline -10` and confirm** you see `b728989` (Commit 0) through the most recent two commits (Commit 6 + 7) at the top. If `origin/main` has diverged, the user has pushed — don't amend or force-push.

---

## Progress toward Phase 5 completion (revised)

- ✅ Step 37 — Hero redesign (shipped session 3, restyled under 5-b Commits 2 + 3)
- ✅ Step 38 — How It Works + Footer (shipped session 3, restyled under 5-b Commits 4 + 5)
- 🔁 Step 39 — Filter pills → Phase 5-b follow-up
- 🔁 Step 40 — Illustrated empty states → Phase 5-b follow-up
- 🔁 Step 41 — Form polish → Phase 5-b follow-up (with stripe-ban rewrite)
- 🔁 Step 42 — Incoming message avatars → Phase 5-b follow-up
- 🔁 Step 43 — Onboarding redesign → Phase 5-b follow-up
- 🔁 Step 44 — Page transitions → Phase 5-b follow-up (principle 5 constrained)
- 🔁 Step 45 — Responsive + print → Phase 5-b follow-up (no palette impact)

Plus:

- ✅ Phase 5-b Commit 0 — design context docs
- ✅ Phase 5-b Commit 1 — tokens + fonts + utility audit
- ✅ Phase 5-b Commit 2 — kill placeholder metrics
- ✅ Phase 5-b Commit 3 — hero restyle
- ✅ Phase 5-b Commit 4 — how-it-works restyle
- ✅ Phase 5-b Commit 5 — footer + shared surfaces
- ✅ Phase 5-b Commit 6 — portal pass + dark mode wire-up
- ✅ Phase 5-b Commit 7 — docs wrap (this handoff)

Seven follow-ups to go. Each is independently scopable — commit per follow-up, each gets its own end-of-session handoff if a session covers ≥2 of them.
