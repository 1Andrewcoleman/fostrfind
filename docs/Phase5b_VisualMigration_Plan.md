# Phase 5-b — Visual Migration & Landing Redesign Plan

Written 2026-04-20 (session 3, post-teach). **No code has been changed by this plan.** It exists to force a decision before any visual work begins.

**Why Phase 5-b and not Phase 5 continuation?** Phase 5 (Steps 37–45 in [`docs/roadmap.md`](./roadmap.md)) was written before the [`/impeccable teach`](../.impeccable.md) direction existed. Steps 39–45 remain valid *as a list of surfaces to touch*, but the specific styling guidance in each (amber pill hover states, pulsing badges, saturated warmth) is now superseded by `.impeccable.md`. This plan renumbers and re-scopes the remaining work so the design direction is applied *once*, across the whole app, instead of each step drifting.

---

## Governing document

All visual decisions below derive from [`.impeccable.md`](../.impeccable.md). If this plan and `.impeccable.md` ever disagree, `.impeccable.md` wins. When a commit finishes, sanity-check it against the five design principles in that file:

1. Restraint over richness
2. Calm contrast
3. Typography leads
4. Three pastels, each with a job
5. Motion responds to intent

---

## Ordering constraint: why this can't be done piecewise

The migration has one unavoidable coupling: **changing `globals.css` tokens affects every component that uses them, simultaneously.** You cannot "migrate the landing page first, then the portal" — the moment `--primary` shifts from warm-amber to butter-yellow, every `bg-primary` in the codebase shifts too. Any plan that pretends you can migrate incrementally produces a broken intermediate state for N commits.

Therefore the plan is:

- **Commit 1** is a single big migration: new tokens + new fonts + every existing utility-class usage audited and reclassified in one sweep. The app's appearance changes globally, but no component is *redesigned* yet — they just pick up the new direction.
- **Commits 2–7** redesign surfaces one at a time against the now-uniform design system.

This is the only way to avoid the app looking half-broken between commits. Accept the bigger Commit 1.

---

## Commits

Each commit gets its own `tsc --noEmit`, `eslint src/`, and `next dev` smoke pass per the agent protocol. Each is independently reviewable and independently revertable.

### Commit 0 — Land the design context (`chore(docs): establish .impeccable.md and CLAUDE.md pointer`)

**Files**: `.impeccable.md` (new, already written), `CLAUDE.md` (already edited with pointer section).

No code changes. Gives future agents a stable reference to point to on subsequent PRs. Ship this first so every later commit message can simply say "per `.impeccable.md`" rather than re-explaining the direction.

**Estimated effort**: 0 min (files already written; just `git add` + commit).

---

### Commit 1 — Tokens, fonts, and utility-class audit (`feat(design): migrate to OKLCH tri-pastel palette and Source Serif 4 + Switzer type system`)

**This is the large one.** Everything after this commit is surface-by-surface refinement. Everything before it is the old design.

**Files touched**:
- `src/app/globals.css` — full token rewrite (HSL → OKLCH, three pastels with semantic roles)
- `tailwind.config.ts` — wrap every color token with `oklch(var(--token))` instead of `hsl(var(--token))`; add new `colors.peach` token alongside the existing `colors.warm` (which changes *meaning* from honey to sage)
- `src/app/layout.tsx` — remove Plus Jakarta import; swap to Source Serif 4 via `next/font/google`; add Switzer via `next/font/local`; update the `--font-display` binding
- `src/app/fonts/switzer/` — new folder with `.woff2` files downloaded from [fontshare.com/fonts/switzer](https://www.fontshare.com/fonts/switzer), weights 300 / 400 / 500 / 600 / 700
- **Utility-class audit** across all of `src/`:
  - Every `text-warm` / `bg-warm` / `bg-warm/NN` / `border-warm` usage gets re-classified. If the existing intent was "honey brand-highlight," the new class is `text-primary` (butter) or `bg-primary/NN`. If the intent was "success / completed," keep `text-warm` (which now means sage). If the intent was "shelter-side," change to the new `text-peach` / `bg-peach/NN`.
  - Every `from-background to-muted` gradient on a surface loses its gradient (principle 1).
  - Every pulsing-dot / auto-playing animation is removed (principle 5).
  - Every `border-left: N px` or `border-l-N` with `N > 1` accent stripe is rewritten — Impeccable's absolute ban. The existing `portal-nav.tsx` active state uses such a stripe — it becomes a filled-pill background instead.
- `src/components/ui/sonner.tsx` — update the toast tint classNames for the new palette (success uses sage, warning uses peach, error stays muted ink-red).

**Files NOT touched in this commit**: the specific compositional layout of any page. The hero's asymmetric 7/5 stays asymmetric in Commit 1. The How-It-Works cards stay three-card-grid in Commit 1. Only colors, fonts, and banned-pattern fixes change.

**Validation** (non-negotiable before shipping):
- Manually view every top-level route — `/`, `/terms`, `/privacy`, `/login`, `/signup`, `/onboarding`, `/shelter/dashboard`, `/shelter/dogs`, `/shelter/applications`, `/foster/browse`, `/foster/history`, `/foster/messages`, `/foster/applications` — in light mode. Confirm nothing is obviously broken (missing color, illegible text, black-on-black, etc.). Record one screenshot per route.
- Confirm contrast passes WCAG AA on body text (at least 4.5:1) and on CTAs (at least 3:1 for large text). Since we're moving to a lower-contrast palette deliberately, use Chrome DevTools or a contrast checker on the three most-viewed text/background pairings before ship.
- `tsc --noEmit`, `eslint src/`, dev server hit.

**Rollback posture**: one commit, one revert. If the migration introduces a regression we can't fix quickly, `git revert` and go back to warm-amber.

**Estimated effort**: 3–4 hours. The utility audit is the bulk of the time.

---

### Commit 2 — Landing: remove the dishonest trust signals (`feat(landing): remove placeholder metrics and fake rating card (§25b)`)

**Files**: `src/app/page.tsx` only.

- Delete the entire `STATS` array and its rendering `<section>`.
- Delete the floating "4.9 rating from foster parents" card from the hero photo frame.
- Delete the pulsing-dot animation on the eyebrow chip (was already queued for removal in Commit 1 under the motion ban; catch any residuals here).
- Rebalance the hero spacing now that the floating card is gone — the photo frame likely wants the offset panel slightly larger, or the image's vertical negative-space reclaimed.
- Add a one-line product decision comment at the top of the file referencing `.impeccable.md`'s trust-signal stance, so nobody re-adds fake metrics in a future PR.

**Validation**: visual diff vs Commit 1 version shows the band and the rating card are gone; nothing else shifted.

**Estimated effort**: 30 min.

---

### Commit 3 — Landing: hero restyle (`feat(landing): hero restyle against calm-contrast direction (§25b)`)

**Files**: `src/app/page.tsx` only.

- Hero headline: decide on the italic treatment. Proposal: keep the two-line structure, **but drop the italic primary accent** in favor of a weight contrast (H1 weight 400 for both lines, second line gets the butter-yellow color token only). Italic was the most distinctive moment under the old direction but reads as "over-engineered" against the new one. If the user wants to keep the italic as the one typographic surprise, that's fine and gets flagged in the commit.
- Offset warm panel: keep the motif. The color becomes butter-yellow at a low alpha (foster/brand side of the marketplace).
- Grain overlay: reduce from `opacity-[0.035]` to `opacity-[0.02]` or remove entirely — the new background is already softer, so the grain may be redundant.
- Eyebrow chip: keep as a border pill but restyle in sage (since "open for new fosters" is a positive/active state). Verbiage stays.
- CTAs: keep two buttons; the primary becomes butter (foster side), the outline uses peach tones (shelter side). Butter and peach are visually distinct enough that the two CTAs read as two equal doors, not primary + secondary.
- Drop the `sticky top-0 ... h-16` header's `backdrop-blur` if it no longer adds clarity against the softer background (test visually; keep if it still reads as a header).

**Validation**: screenshot of new hero vs Commit 2 hero; verify the composition reads calmer, not less interesting.

**Estimated effort**: 1–1.5 hours.

---

### Commit 4 — Landing: How-It-Works restyle (`feat(landing): how-it-works restyle with semantic pastels (§25b)`)

**Files**: `src/app/page.tsx` only (possibly small tweaks to `ACCENT_CLASSES` constant).

- Each card's top strip picks ONE of the three pastels based on product role:
  - **Card 1 "Shelters list dogs"** → peach (shelter-side)
  - **Card 2 "Fosters browse & apply"** → butter (foster-side / brand)
  - **Card 3 "Dogs find homes"** → sage (success / placement)
- Watermark number drops to `text-foreground/[0.04]` (was `/[0.05]`); still legible but quieter.
- Hover lift shortens to `duration-200` (was `duration-300`) and the `translate-y` distance reduces (was `-translate-y-1`; try `-translate-y-0.5`). Calmer motion.
- Icon tile border-radius may shift from `rounded-2xl` to `rounded-xl` — the global `--radius` drops from 0.75rem to 0.625rem in Commit 1, so this inherits automatically, but double-check the tile still reads correct.
- Accent-dot on each icon tile stays; the ring color picks up the card's pastel.
- Section eyebrow "The flow" stays.
- Section header "How it works" becomes the **first Source Serif 4 moment on the page** — this is the one editorial accent the page gets (principle 3).

**Validation**: each card's pastel is visually distinguishable but none dominates; the section reads as a single coherent trio, not three competing cards.

**Estimated effort**: 1 hour.

---

### Commit 5 — Public footer + metadata refresh (`feat(landing): public-footer restyle and metadata tune-up`)

**Files**: `src/components/public-footer.tsx`, `src/app/layout.tsx`.

- `public-footer.tsx`: restyle against new palette. Paw icon moves from `text-warm` (which is now sage — wrong semantically for a brand icon) to `text-primary` (butter — correct for brand). Column headers stay small-caps, but become Switzer 500 (not 600 — less weight contrast, calmer). Bottom-strip paw also `text-primary`.
- `layout.tsx`: the metadata copy written in Commit Step 38 is still good. Only add an `og:image` reference that points at a placeholder path (don't generate the image itself yet — deferred per `.impeccable.md`) so the OG tag structure is complete and ready for when a real brand photo lands. Actually — on reflection, skip this; empty `og:image` is worse than no tag. Keep deferred.

**Validation**: footer reads balanced, no color shouts.

**Estimated effort**: 45 min.

---

### Commit 6 — Portal pass (`feat(portal): align shelter and foster portals to new design direction`)

**Files** (estimated; confirm by running `rg "bg-warm|text-warm|from-background to-muted|animate-pulse" src/app/(shelter)/ src/app/(foster)/ src/components/`):

- `src/components/portal-nav.tsx` — active nav pill already rebanished in Commit 1 per the border-stripe ban; this commit tunes the active state to use a sage fill (reads as "you are here / current"). Unread badge on Messages uses butter (not a red or amber).
- `src/components/foster/browse-dog-card.tsx` — card tile styling, special-needs overlay, shelter logo treatment. Likely a small spacing + type-weight refresh only.
- `src/components/foster/filter-sidebar.tsx` — pairs with §39 from the old roadmap (swap Size + Age checkbox lists for pills). The pills pick up the new palette; active pill is butter.
- `src/components/empty-state.tsx` — audit call sites; per-context inline SVG illustrations (this was roadmap §40). Illustrations are line art only — principle 1 says no ornament without purpose. Each empty state's illustration must clearly map to the emptiness being depicted.
- `src/components/messages/message-thread.tsx` — message bubbles: incoming = neutral surface, outgoing = butter at low alpha. Sender avatars added (roadmap §42). No read-receipt animations.
- `src/app/onboarding/page.tsx` — the redesign from roadmap §43. Role cards become two large pastel tiles (peach = shelter, butter = foster). Form grouping stays.
- `src/app/(foster)/foster/dashboard/*` and `src/app/(shelter)/shelter/dashboard/*` — stat icon pills update to use one-and-only-one pastel each per metric type. No per-page over-use.
- `src/components/ui/sonner.tsx` — already updated in Commit 1; sanity-check against the now-uniform palette.

**Also in this commit**: wire `next-themes` for authenticated portals only (not public pages). The `(foster)/layout.tsx` and `(shelter)/layout.tsx` opt into `ThemeProvider` with `defaultTheme="system"`. Add a simple theme toggle in `portal-sidebar-user.tsx` alongside the sign-out button (small sun/moon icon). The dark tokens will be derived in this commit — see `.impeccable.md` "Dark (authenticated portals only, phase 2)" section.

**Validation**: every portal route still works; dark mode renders without broken contrast; motion behavior across shelter + foster views is consistent with principle 5.

**Estimated effort**: 4–6 hours. This is the second-largest commit after Commit 1 because it covers a lot of ground, but each surface is a small change.

---

### Commit 7 — Docs sync (`docs: phase 5-b wrap — update roadmap markers, handoff`)

**Files**: `docs/roadmap.md`, new `docs/AgentHandoff_2026-04-21.md` (or similar, dated per ship day).

- Mark roadmap Steps 37–38 as superseded (their redesign direction was replaced by `.impeccable.md`).
- Mark Steps 39–45 as folded into Commit 6 of this plan.
- Append a Phase 5-b summary block and progress tracker.
- New handoff doc covering what changed, what the pitfalls were, anything future agents need to know that isn't in `.impeccable.md` itself.

**Estimated effort**: 1 hour.

---

## Total estimate

~11–14 hours of focused work, spread across 7 commits. Probably 2–3 sessions. Suggested pacing:

- **Session A**: Commits 0 + 1 (design context + the big migration). End session here; let it sit overnight so a fresh look can catch any palette-level mistake before the surfaces get layered on top.
- **Session B**: Commits 2 + 3 + 4 + 5 (landing + footer). All related, worth doing in one pass.
- **Session C**: Commit 6 (portal pass) + Commit 7 (docs).

---

## Decision points needing your sign-off before Commit 1 starts

1. **Italic accent on the hero headline** — keep (one typographic surprise) or drop (stricter restraint)? My lean: drop. The restraint brief is stronger than the desire for a hero-moment italic.
2. **Grain overlay on the hero** — reduce to 0.02 or remove entirely? My lean: remove. The new background is already softer and grain no longer earns its presence.
3. **Old `--warm` token semantic shift** — the existing code uses `text-warm` / `bg-warm` in many places for "honey brand-highlight" (paw icons, active states). The new `--warm` means sage / success. Options:
   - **(a)** Reclassify every existing `*-warm` class by inspection (what I described above — I do the audit in Commit 1). Cleanest end state; bigger commit.
   - **(b)** Introduce a new `--sage` / `--peach` / `--butter` token set and leave `--warm` pointing at the old honey color until a separate commit phases it out. Smaller Commit 1; more tokens to think about in the interim.
   - My lean: (a). Cleaner. One-time pain.
4. **Dark mode scope** — wire `next-themes` in Commit 6 (portal pass) or defer to a Phase 5-c entirely? My lean: wire it in Commit 6 so the portal pass is "done done" for the foreseeable future. Extra 1–2 hours but avoids revisiting every portal component twice.
5. **Anything in `.impeccable.md` you want to revise before we start?** This is your last chance to move the goalposts cheaply. Once Commit 1 ships, every later decision is downstream of what's in that file.

---

*Next action: you review this plan + the five decision points. Once you sign off, I start with Commit 0 (land the design context docs) and then Commit 1 (the migration). I pause between every commit for your visual review.*
