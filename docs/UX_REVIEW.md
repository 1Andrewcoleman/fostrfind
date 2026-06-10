# Fostr Find — Full UI/UX Review (portals, auth, public pages; landing excluded)

*Reviewed 2026-06-10 against the live app running in dev mode (all 22 portal/auth/public screens screenshotted at 1440px and 390px) plus a full code audit of both portals, auth, and shared infrastructure. Visual decisions judged against `.impeccable.md`.*

---

## Grading scale

Grades reflect "readiness for a trust-sensitive, two-sided marketplace handling real animal placements":

| Grade | Meaning |
|-------|---------|
| **A** | Ship-ready; would actively build user trust |
| **B** | Solid; minor polish remains, nothing blocks launch |
| **C** | Functional but with friction users will feel |
| **D** | Broken, contradictory, or confusing; will cost users |
| **F** | Missing where it's needed |

## Report card

| Area | Grade | One-line verdict |
|------|-------|------------------|
| Auth & onboarding flow | **A−** | Genuinely complete: verify-email polling, resend cooldown, no email enumeration, friendly error mapping, role-picker onboarding |
| Feedback & states (loading/empty/error) | **A−** | Every page has empty, loading, and error states; error boundaries are warm and actionable |
| Core foster flow (browse → apply → track → rate) | **B** | Works end to end; weak moments at the apply-confirmation and "when can I message?" steps |
| Core shelter flow (list → review → accept → complete → rate) | **B** | Clear status machine; settings page has two real defects |
| Visual design & brand execution | **B−** | Palette and typography are disciplined, but "calm contrast" is over-applied and wide-screen layouts collapse leftward |
| Information architecture & navigation | **B−** | 9 foster nav items, three inbox-like surfaces; dashboard competes with Browse as the landing |
| Copy & voice | **B−** | Mostly excellent, kind, specific — undermined by a random greeting pool that violates the locked voice |
| Mobile experience | **B+** | Filter FAB + sheet, responsive grids, safe-area insets; nothing breaks at 390px |
| Accessibility | **B** | Above-average for an MVP (aria labels, focus rings, motion-reduce); pink links and muted buttons are contrast risks |
| Restraint / over-engineering | **B** | Feature breadth is large for launch but mostly justified; a few gimmicks and stubs should be cut |
| **Overall** | **B** | Strong foundations; a short, specific punch list stands between this and an A− launch |

---

## What works

- **The design system is real, not aspirational.** Tokens, the three-pastel semantic mapping (cherry-blossom = foster/brand, ash-grey = success/placed, powder-petal = shelter/pending), Source Serif 4 reserved for page H1s, Switzer everywhere else — all consistently applied across both portals. StatusBadge, EmptyState, StickySaveBar, and the stepper are reused everywhere they should be.
- **State coverage is exceptional for this stage.** Every list page has a tailored empty state with a CTA; skeletons exist for server pages; error boundaries ("We hit a snag loading this page") include a digest, retry, and a support mailto. Forms have inline Zod errors, server 422 field mapping, and loading spinners on every async button.
- **The auth journey is complete and careful.** Verify-email polls and advances automatically, resend has a 60s cooldown, forgot-password avoids email enumeration, Supabase errors are translated to human copy, and post-auth routing is role-aware.
- **Hard flows are handled correctly.** Re-apply after withdrawal actually works (the API updates the withdrawn row — the dialog's promise is kept). Accept/decline/complete are idempotent with confirmation dialogs. Dog delete is blocked with active applications. Photo uploads are validated, resized, and atomic.
- **Mobile was not an afterthought.** Filters become a FAB + bottom sheet with safe-area insets; grids collapse cleanly; the message thread uses viewport-height math; touch targets are adequate.

## What's broken (verified, with file references)

1. **Dead "Change Password" button** — `src/components/shelter/shelter-settings-form.tsx:346`. Renders enabled, has no handler. Worse, the same Account tab area says *"Contact support to change your email address"* while `account-settings-form.tsx` ships a complete email-change flow. The settings surface contradicts itself twice.
2. **Photo limit copy contradiction** — `dog-form.tsx:308` says *"Up to six photos"*; `MAX_DOG_PHOTOS = 5` (`constants.ts:25`) so the counter beside it says *"Photos (max 5) — 0 / 5"*. Both visible in the same viewport.
3. **The dashboard greeting misfires.** `getGreeting()` picks randomly from 27 strings including *"Wakey wakey"*, *"Hope the coffee's hot"*, *"Hanging in there"* — screenshots captured **"Glad you're up, there"** (foster, no first name) and **"Starting the day right, your shelter"** (shelter fallback). Three separate problems: the fallback names ("there", "your shelter") read as template bugs; SSR renders "Hello" then visibly swaps after hydration; and a random rotating greeting directly violates the locked voice ("never cutesy", "calm, not clever") in `.impeccable.md`.
4. **DEV_MODE crashes profile/settings.** `AccountSettingsForm` (`account-settings-form.tsx:50`) constructs a browser Supabase client with no dev guard, so `/foster/profile` and the shelter Account tab hit the error boundary in dev mode. Production is unaffected, but it makes two key screens un-demoable and untestable locally.
5. **"Currently fostering" badge over-counts** — `shelter/fosters/page.tsx:152–170` counts a foster's accepted applications across *all* shelters with no `shelter_id` filter. A shelter sees "Currently fostering 2" when that foster has nothing active with *them*.
6. **Typing indicator is a stub** — fully built UI in `message-thread.tsx`, hardcoded off, never wired to Realtime presence. Dead weight; cut or wire.
7. **Pending invites have no timestamp** — `created_at` is fetched but never rendered (`shelter/fosters/page.tsx:230`). A shelter can't tell a week-old invite from a fresh one, which is exactly when they'd want to cancel/resend.

## What's confusing

- **"When can I message the shelter?"** Messaging opens only after acceptance, but nothing on the dog detail page or apply dialog says so. A foster who wants to ask "does Buddy tolerate cats?" before committing to an application has no path — and only discovers the rule via the Messages empty state, after the fact. This is the single most likely point where an interested foster stalls out.
- **Applying ends in a shrug.** Submit → toast → dialog closes → you're still on the dog page. No "what happens next" moment (when to expect a reply, where to track it). For the emotional climax of the foster funnel, the payoff is a toast.
- **Double status display.** Application cards show a StatusBadge *and* a four-step stepper encoding the same state. The stepper is the better component; the badge is redundant on cards (keep it on detail pages and lists where the stepper doesn't fit).
- **The rating moment is fragile.** Marking a placement complete force-opens the rating modal; if the shelter skips, the "Rate Foster" recovery button only appears after a refresh.
- **Onboarding overpromises.** *"You can always add another account later"* — there is no role-switching or second-role UI anywhere. Cut the clause or build the feature.
- **Lost application drafts.** Closing the apply dialog resets the form. Eleven fields typed on a phone, one accidental backdrop tap, all gone.

## What's boring / what would lead a user away

- **The new-foster dashboard is a dead end**: three zero-stat cards, an empty applications panel, a roster card they can't use yet. The profile-completeness module — the single most useful nudge for a new foster, since profile strength affects acceptance — renders only on the Profile page. The first-session dashboard should sell the next action, not display three zeros.
- **Photo-less dogs look bleak.** The detail page leads with an enormous grey 4:3 box with a small paw glyph. For a product whose entire emotional engine is "look at this dog", the placeholder treatment is the weakest visual in the app. (Browse cards have the same issue at smaller scale.)
- **Everything whispers.** "Calm contrast" is the brand, but secondary buttons (`View Dog`, `View profile`, `Search`) are muted-grey-on-muted-cream and read as *disabled*. Most screens lack the principle's own promised "one sharper contrast moment per screen". A first-time visitor gets calm, but also gets "is this thing on?".

## Stylistic concerns to rethink

1. **Wide-screen layout collapse (known as TODO §25n, but launch-blocking in my view).** Dog detail, application detail, and the dog form render a ~660px left-hugging column with a vast dead field to the right at 1440px. It reads as a rendering bug, not a design choice. Center the column or introduce a second column (photos left / facts right on dog detail; application left / foster profile right on app detail).
2. **Link contrast.** Cherry-blossom text links ("Forgot password?", "Sign up", "Contact support") on cream are well below WCAG AA for normal text. Keep pink for fills, use iron-grey + underline for inline links, or darken the link tone.
3. **Login password placeholder** is `••••••••`, which reads as a pre-filled password. Use a blank field.
4. **Card affordance is inconsistent**: shelter dog cards are fully clickable; foster browse cards are only clickable via the "View Dog" button. Pick one (full-card link with button as affordance echo is the better pattern) and apply it both sides.

## Over-engineered for the goal

- **The greeting pool** (27 randomized strings to vary a dashboard heading) — cost: voice violations, hydration flicker, fallback bugs. Benefit: none. Replace with "Good morning/afternoon/evening" + name, or just the name.
- **Three inboxes**: Messages, Notifications, and Invites are separate nav destinations with separate badges. Notifications already covers "application updates, messages, and shelter invites" by its own subtitle. For launch, Invites could live inside Notifications (or the dashboard) and cut the foster nav from 9 to 8; longer-term, consider whether Notifications earns its keep as a page at all versus badges + email.
- **Two-way ratings at launch** is ambitious for a marketplace with zero liquidity — every shelter and foster profile will show "no ratings" for months. It's built and sound, so keep it, but suppress empty rating UI (don't render "—" averages) until data exists. This aligns with the "no fake/empty metrics" trust stance.
- **Typing indicator stub** (above) — classic speculative feature; remove until presence is actually wired.

What is *not* over-engineered, despite its breadth: the six application statuses, the invite/roster system, photo pipeline, and reporting all map to real shelter workflows and earn their complexity.

---

## ✅ Pre-launch critical list (do these before launch, in order)

**Tier 1 — contradictions and dead UI (hours each):**
1. Remove or wire the dead **Change Password** button; resolve the email-change contradiction between the two settings tabs (`shelter-settings-form.tsx:341–346`).
2. Fix **"Up to six photos" vs max 5** (`dog-form.tsx:308`).
3. Replace the **greeting pool** with a single calm time-of-day greeting; fix the "there"/"your shelter" fallbacks (omit the name clause when missing); render it server-side to kill the flicker.
4. Scope the **"Currently fostering" count** to the viewing shelter (`shelter/fosters/page.tsx:152`).
5. Show **sent dates on pending invites**; remove the typing-indicator stub.

**Tier 2 — flow gaps that will cost real users (a day each):**
6. **Post-application confirmation**: replace the toast-only ending with an explicit success state — what the shelter sees, typical response expectations, link to My Applications.
7. **Say when messaging opens** on the dog detail page and apply dialog ("You'll be able to message {shelter} once they accept your application"). Longer term, consider a pre-application question channel — this is the top candidate for "what would lead a user away".
8. **Put profile completeness on the foster dashboard** (it already exists as a component) and give the empty dashboard a real first-run state: complete profile → browse dogs → apply.
9. **Persist apply-dialog drafts** (component state or localStorage keyed by dog id) so a stray tap doesn't destroy a phone-typed application.
10. Guard `AccountSettingsForm` for **DEV_MODE** so profile/settings are demoable and testable.

**Tier 3 — visual credibility on desktop (1–2 days total):**
11. **Fix wide-screen layout**: center or two-column the dog detail, application detail, and dog form pages.
12. **Raise the floor on contrast**: distinguish secondary buttons from disabled ones; darken pink text links to AA; verify the pink primary button passes contrast for its label.
13. **Improve the no-photo treatment** (warmer illustrated placeholder, and nudge shelters at dog-creation: "Dogs with photos get N× more applications" — only if true, otherwise "Photos help fosters connect with a dog").

Items 1–5 are trivially small; 6–10 are the highest-leverage UX work in the codebase; 11–13 decide whether a small-town shelter director on a 1080p laptop perceives the product as finished.

---

## Notes on method

- Both portals, auth, and public pages were exercised in `NEXT_PUBLIC_DEV_MODE=true` with placeholder data; pages requiring live Supabase (message threads, application detail) were reviewed in code.
- Findings cross-checked against `docs/TODO.md` §25 — wide-screen centering (25n), incoming message avatars (25j), and inline-validation polish (25h) were already known; the Tier 1 defects above were not.
