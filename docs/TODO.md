# Fostr Find — Technical TODO

Status legend: `[ ]` not started · `[~]` partial (UI exists, no backend) · `[x]` done

---

## 1. Onboarding & Profile Creation

- [x] Shelter onboarding form — `insert` into `shelters` (slug + random suffix, `user_id` from session)
- [x] Foster onboarding form — `insert` into `foster_parents`
- [x] Post-login role detection — `getPostAuthDestination()` in `src/lib/auth-routing.ts`; login redirects to `/shelter/dashboard`, `/foster/browse`, or `/onboarding`
- [x] Google OAuth callback — `src/app/auth/callback/route.ts` exchanges code, then same role-based redirect (configure provider + redirect URL in Supabase dashboard)

## 2. Dog CRUD (Shelter Side)

- [x] Create dog — `DogForm` inserts into `dogs` with `shelter_id` from session
- [x] Edit dog — edit page loads dog via `select`; `DogForm` updates row
- [x] List dogs — `/shelter/dogs` loads `dogs` for the signed-in shelter
- [x] Delete dog — `DogDeleteButton` → `DELETE /api/dogs/[id]`; shelter ownership; 409 if active applications block deletion
- [ ] Dog photo upload — file input renders; `/api/upload/photo` is a stub; needs FormData parsing, resize, Supabase Storage upload
- [ ] Photo preview/reorder in `DogForm`
- [x] Dog status transitions (available → pending → placed) — `DogRelistButton` + `PATCH /api/dogs/[id]/status` (`relist_dog` RPC)

## 3. Browse & Search (Foster Side)

- [x] Browse dogs page — Supabase `select` from `dogs` where `status = 'available'`, nested `shelters` for name/logo (DEV_MODE still uses placeholders)
- [x] Filter sidebar — filters fetched rows client-side (size, age, gender, medical needs); URL query params synced via `useSearchParams` + `router.replace`
- [ ] Distance-based search — schema has lat/lng; needs haversine/PostGIS query
- [ ] Pagination / infinite scroll
- [x] Dog detail page — `select` dog + shelter by id; apply flow uses real `shelter_id`

## 4. Applications

- [x] Apply for dog — `insert` into `applications` (`submitted`, `note`, `foster_id` / `dog_id` / `shelter_id`)
- [x] Foster "My Applications" page — server-fetches `applications` joined with `dogs` + `shelters`; tab filtering via `FosterApplicationsList` client component
- [x] Shelter "Applications" page — server-fetches `applications` joined with `dogs` + `foster_parents`; tab filtering via `ShelterApplicationsList` client component
- [x] Application detail (shelter) — real fetch with joins; `FosterProfileView` with ratings; `ShelterNoteEditor` for internal notes
- [x] Shelter internal notes — `ShelterNoteEditor` client component saves `shelter_note` on submit via Supabase
- [x] Accept application — `AcceptDeclineButtons` calls `/api/applications/[id]/accept`; auth + ownership + idempotency guard; sets dog → `pending`
- [x] Decline application — same pattern; sets application → `declined`; dog stays `available`
- [x] Complete foster — "Mark Complete" button (shown when `accepted`); sets application → `completed` + dog → `placed`
- [x] Status change side effects: accepting sets dog → `pending`, completing sets dog → `placed`

## 5. API Routes

- [x] `POST /api/applications/[id]/accept` — auth check, verify shelter ownership, idempotency guard, update status + dog → pending
- [x] `POST /api/applications/[id]/decline` — auth check, verify shelter ownership, idempotency guard, update status
- [x] `POST /api/applications/[id]/complete` — auth check, verify shelter ownership, idempotency guard, update status + dog → placed
- [x] `POST /api/notifications/send` — generic endpoint intentionally disabled (410 Gone); per-event emails wired directly in domain routes (accept, decline, complete)
- [x] `POST /api/upload/photo` — auth, FormData parse, magic-byte MIME validation, role-based bucket enforcement, Supabase Storage upload via `@/lib/storage.ts`
- [x] `POST /api/ratings` — auth, completed application, shelter ownership, idempotent insert
- [x] `DELETE /api/dogs/[id]` — auth, shelter ownership, guard against deleting dogs tied to active applications

## 6. Messaging

- [x] Message thread pages (foster + shelter) — server fetch application + messages; `MessageThread` client for send/display; DEV_MODE placeholder when no Supabase URL
- [x] Send message — `MessageThread` inserts into `messages` with `sender_id` / `sender_role`; optimistic UI
- [x] Fetch messages — server `select` by `application_id`, ordered for display; initial props mirrored after mark-as-read `UPDATE` so client state matches DB
- [x] Message list pages — server-fetched threads (accepted/completed apps) with last message preview + per-thread unread badges
- [x] Supabase Realtime subscription — `postgres_changes` on `public.messages` in `MessageThread`; deduplicates own-sends against optimistic rows; marks incoming as read client-side
- [x] Unread message count / indicators — layouts count unread (by role); thread list badges; nav badge via `portal-nav`
- [x] Mark messages as read on open — server marks other-party unread rows when thread loads; RLS allows `UPDATE (read)` only (see migrations `20240103000000`, `20240104000000`)

## 7. Ratings & Reviews

- [x] Rating submission after foster completion — `RatingDialog` from `AcceptDeclineButtons`; optional prompt after "Mark Complete"; "Rate Foster" on completed applications when no rating yet (`hasExistingRating` from application detail query)
- [x] `StarRating` — wired in `RatingDialog` for score selection
- [x] `insert` into `ratings` — `POST /api/ratings` with Zod validation, shelter ownership, idempotency
- [x] Display average rating on foster profile — application detail / profile views use existing data + `calculateAverageRating` where applicable
- [~] Rating history on foster history page — completed apps + ratings shown; further polish optional

## 8. Profile Management

- [x] Foster profile page — server-fetches `foster_parents` row; `FosterProfileForm` client component upserts via Supabase; Sonner toasts
- [x] Shelter settings page — server-fetches `shelters` row; `ShelterSettingsForm` client component updates via Supabase; Sonner toasts
- [x] Avatar/logo upload — `AvatarLogoField` component wired in both foster profile and shelter settings forms
- [x] `ProfileCompleteness` component — reads from server-fetched data passed via props

## 9. Dashboard (Shelter)

- [x] Dashboard page — server-fetches real counts (active dogs, pending apps, unread messages) and last 5 applications with joins
- [x] Fetch active dog count (`select count` from `dogs` where shelter + available)
- [x] Fetch pending application count (submitted + reviewing)
- [x] Fetch recent applications list (last 5 with `ApplicationCard`)
- [x] Fetch unread message count

## 10. Foster History

- [x] History page — server-fetches completed `applications` joined with `dogs` + `shelters`; separate ratings query
- [x] `FosterHistoryCard` component wired with real data + optional rating display
- [x] Stats: total placements + average rating computed via `calculateAverageRating`

## 11. Email Notifications (Resend)

- [~] Set up Resend API key — `@/lib/email.ts` integrated with Resend; degrades to console log when `RESEND_API_KEY` is missing or not a real key; set env var to enable
- [ ] Application submitted → email shelter (only in-app notification currently; no `sendEmail` call in `POST /api/applications`)
- [x] Application accepted → email foster — `sendEmail` wired in `POST /api/applications/[id]/accept`
- [x] Application declined → email foster — `sendEmail` wired in `POST /api/applications/[id]/decline`
- [x] Foster completed → email both parties — two `sendEmail` calls in `POST /api/applications/[id]/complete`
- [ ] New message → email recipient (debounced) — only in-app notification currently; no `sendEmail` call in `POST /api/messages`
- [x] Email templates (HTML) for each notification type — React email templates implemented in `@/lib/email.ts`

## 12. Photo & File Storage

- [x] Supabase Storage upload helper — `@/lib/storage.ts` with `validateImageFile`, `uploadImage`, `buildUploadPath`, `checkBucketRole`, `validateBucketName`
- [ ] Image resize/optimization before upload — not implemented; images uploaded at original size
- [x] Storage bucket RLS policies — migration `20240112000000_storage_buckets.sql`; per-bucket SELECT/INSERT/DELETE policies
- [x] Delete old photos on replacement — `AvatarLogoField` derives old path from `initialUrl` and calls `storage.remove()` before uploading the new file
- [x] Max file size validation client-side — `validateImageFileFast` (sync, checks `file.size` against `MAX_FILE_SIZE_BYTES`)

## 13. Security & Edge Cases

- [x] RLS recursion fix — `SECURITY DEFINER` helpers (`get_my_foster_ids`, `get_my_shelter_ids`) break circular policy deps (migration `20240102000000`)
- [x] Messages mark-as-read hardening — column-scoped `UPDATE (read)` + tightened policy so participants cannot edit message body or sender columns (migration `20240104000000`)
- [x] Verify application ownership before status changes (all three API routes check shelter `user_id`)
- [x] Rate limiting on API routes — `validateMutationRequest` enforcer on all mutation routes
- [x] Input sanitization on all user-submitted text (XSS prevention) — `sanitizeText` / `sanitizeMultiline` in both profile forms and dog form
- [x] Prevent duplicate applications (same foster + same dog) — dog detail page checks for existing application on load; button disabled if already applied
- [ ] Handle expired/revoked sessions gracefully
- [x] CSRF protection on mutation endpoints — covered by `HttpOnly` same-site session cookies + Supabase SSR auth

## 14. UX Polish

- [x] Toast notifications on success/error for all mutations (Sonner wired on profiles, application actions, internal notes)
- [x] Confirmation dialogs before destructive actions (accept/decline/complete use `AlertDialog`)
- [x] Loading skeletons on data-fetching pages — `loading.tsx` for dashboard, applications, history, messages (both portals); inline skeletons for browse grid and dog detail
- [x] Mobile navigation — `MobileNav` + `Sheet` in `portal-nav.tsx` (foster + shelter layouts)
- [x] Active nav link highlighting — `usePathname` in `portal-nav.tsx`
- [~] Empty state components — used on browse, shelter dogs, applications, dashboard, history
- [ ] Form error display improvements
- [x] Optimistic UI updates for messaging — `MessageThread` appends sent messages before insert completes

## 15. Infrastructure

- [ ] Environment variable validation on startup
- [ ] Error boundary improvements (`error.tsx` exists but is generic)
- [x] Sentry or equivalent error tracking
- [ ] Analytics (PostHog, Mixpanel, etc.)
- [ ] CI/CD pipeline
- [x] Production deployment (Vercel)
- [ ] Database backups strategy
- [ ] Seed script for development data
- [ ] Automated tests — unit/integration coverage for helpers (`formatRelativeTime`, etc.), `portal-layout-data`, and critical API routes (no test runner wired yet)
- [ ] **Layout data perf** — `getPortalLayoutData` still runs two parallel queries against `foster_parents` / `shelters` (unread count + identity); consider fetching the profile row once and reusing it for both paths

---

## 16. Auth — Critical Gaps

- [x] **Sign-out** — `PortalSidebarUser` + `supabase.auth.signOut()` + hard nav to `/login` in desktop sidebar and mobile nav sheet (see [`src/components/portal-sidebar-user.tsx`](../src/components/portal-sidebar-user.tsx))
- [x] **Forgot password / reset password flow** — `/auth/forgot-password` + `/auth/reset-password` implemented with `supabase.auth.resetPasswordForEmail()`
- [x] **Email verification handling** — `/auth/verify-email` interstitial + `/auth/confirm` route handler implemented

## 17. Foster Dashboard

- [x] Foster home / dashboard page at `/foster/dashboard` — shows active application count, current fostering placements, unread messages, and recent application cards
- [x] Redirect foster post-login to `/foster/dashboard` instead of `/foster/browse`
- [x] Add Dashboard nav item to `FOSTER_NAV` in `portal-nav.tsx`

## 18. Application Workflow Gaps

- [x] **"Reviewing" status transition** — "Mark as Reviewing" in `AcceptDeclineButtons` + `POST /api/applications/[id]/review` route with rate limiting and notify
- [x] **Foster application withdrawal** — `WithdrawApplicationButton` in `ApplicationStatusCard`; `DELETE /api/applications/[id]` guarded to `submitted`/`reviewing` only
- [x] **"View Conversation" link from application pages** — "Message Foster/Parent" button on shelter app detail and foster `ApplicationStatusCard` when `accepted`/`completed`

## 19. Dog & Shelter Management Gaps

- [x] **Manual dog status override** — `DogRelistButton` on edit dog page + `PATCH /api/dogs/[id]/status` using `relist_dog` atomic RPC
- [x] **Shelter placed/completed dogs history** — "Placed" tab on `/shelter/dogs` shows dogs with `status = 'placed'` and linked completed application records

## 20. Browse & Discovery Gaps

- [x] **Text / keyword / breed search** — debounced search input in `BrowseFilterForm` filters by `name` / `breed` client-side
- [x] **Pre-populate browse filters from foster preferences** — browse page reads foster `pref_size`, `pref_age`, `pref_medical` and initialises `FilterState` when no URL params are set
- [ ] **Public shelter profile page** — dog cards show the shelter name but it is not clickable; add a `/shelter/[slug]` public page showing shelter bio, logo, location, and active listings so fosters can vet a shelter before applying
- [ ] **Pagination on all list pages** — pagination is noted for browse only; shelter applications, foster applications, shelter dogs, and message thread lists all fetch all records; add cursor/page-based pagination or infinite scroll

## 21. Account Settings

- [x] **Change password** — "Change Password" section in `AccountSettingsForm` calls `supabase.auth.updateUser({ password })`
- [ ] **Change email** — users cannot update their login email; add an email-change form that calls `supabase.auth.updateUser({ email })` and handles the re-confirmation flow
- [x] **Account deletion** — "Delete Account" danger-zone in `AccountSettingsForm`; anonymises profile data and calls delete via server action

## 22. Two-Way Trust & Ratings

- [ ] **Foster-to-shelter ratings** — only shelters can rate foster parents; add a reverse rating flow so fosters can rate their shelter experience after a completed placement; requires a new `shelter_ratings` table (or a `rater_role` column on `ratings`) + `POST /api/shelter-ratings`
- [ ] **Shelter verification workflow** — `shelters.is_verified` is always `false`; add a verification request button on shelter settings, an admin review queue, and surface the verified badge on shelter profiles and dog listings

## 23. Collaboration & Scale

- [ ] **Shelter multi-staff access** — each shelter is bound to a single `user_id`; add a `shelter_members` join table with roles (owner / staff) + an invitation flow so multiple staff can manage the same shelter account
- [x] **In-app notification center** — notification bell + dropdown implemented; `notifications` table backed; wired to application accept/decline/complete events (Steps 48–49)

## 24. Legal & Compliance

- [x] **Terms of Service page** — `/terms` page implemented with ToS content; linked from signup and footer
- [x] **Privacy Policy page** — `/privacy` page implemented; linked from signup and footer
- [ ] **Terms acceptance on signup** — add a required checkbox on the signup form confirming the user accepts the ToS and Privacy Policy; store acceptance timestamp on the user record

---

## 25. UI/UX Aesthetic Overhaul

> **Current state:** A warm brand palette, Plus Jakarta Sans + Inter, `--warm` accent, larger radius, portal nav treatment, browse dog cards (logos, colored badges, special needs overlay), sticky filter `Card` (desktop) + mobile filter sheet + results chips + FAB, `StatusBadge` icons, shelter dashboard greeting + stat pills, `Loader2` on async buttons, Sonner toast styling, portal identity sidebar (avatar + sign-out), onboarding step indicator + progress bar, message thread bubbles + thread list polish (`RelativeTime`, unread row tint), foster application stepper, and consolidated layout auth (`getPortalLayoutData`, single `getUser()` per request) are **shipped**. **Not yet shipped:** incoming sender avatars beside bubbles in `MessageThread` (see §25j). See [`CLAUDE.md`](../CLAUDE.md) **Design system & UI** for where tokens and key components live.
>
> Everything below remains aesthetic-first — the goal is to feel warm, trustworthy, and purpose-built for animal rescue. Open items are mostly **forms (25h)**, **illustrated empty states (25g)**, **onboarding card redesign (25k)**, and other polish.

### 25a. Brand Identity & Design Tokens

- [x] **Replace primary color with a warm brand palette** — the current `--primary: 222.2 47.4% 11.2%` (cold dark navy) reads as corporate; swap to a warm, approachable palette (e.g. a deep amber-brown primary with a complementary soft sage or terracotta accent) that reflects care and warmth without being childish; update all HSL tokens in `globals.css`
- [x] **Add a custom Google Font pairing** — import a friendly but refined heading font (e.g. *DM Sans*, *Plus Jakarta Sans*, or *Nunito*) for `h1`–`h3` and keep Inter or the system stack for body; set `font-family` on the `html` element and configure the Tailwind `fontFamily` extension so `font-display` and `font-body` utilities are available
- [x] **Increase `--radius` to `0.75rem`** — the current `0.5rem` feels stiff; rounder corners soften the UI and are consistent with modern consumer apps; cascade through card, input, badge, button, and dialog radius tokens
- [x] **Define a semantic color for "warm accent"** — add a `--warm` token (warm amber/honey) used for highlights, active states, and the paw/brand icon; prevents the icon from being the same navy as text
- [x] **Add a subtle background texture or tint** — replace the flat `--background: 0 0% 100%` with a very faint warm off-white (e.g. `30 20% 99%`) so the page doesn't feel stark white; similarly shift `--muted` to a warm cream rather than the current cool gray
- [x] **Dark mode design pass** — the dark mode CSS variables exist but are untouched default shadcn values; once the light palette is set, calibrate the dark equivalents so dark mode feels intentionally designed, not auto-inverted

### 25b. Landing Page

- [ ] **Hero section redesign** — replace the centered icon-on-a-circle with a full-bleed asymmetric layout: large headline on the left, a real dog photography placeholder (or illustrated scene) on the right; add a warm gradient wash behind the headline instead of the flat `bg-gradient-to-b from-background to-muted`
- [x] **Animated headline or subtle entrance** — fade/slide-in on hero icon, headline, subtext, and CTAs using `tailwindcss-animate` (`animate-in` + staggered delays); `motion-reduce:animate-none` for accessibility
- [ ] **Social proof / stats bar** — add a row of trust signals below the CTA buttons (e.g. "2,400+ dogs fostered · 180+ partner shelters · ★ 4.9 avg foster rating") in a muted banner strip; even as placeholder copy it signals maturity
- [ ] **"How It Works" step cards** — replace the three plain icon circles with illustrated or icon-rich cards that have a number badge, a more descriptive graphic, and a subtle background tint per step; give them a border and shadow-sm so they read as cards, not floating text
- [ ] **Shelter logo marquee / "trusted by" row** — add a horizontally scrolling strip of placeholder shelter logos or silhouettes above the footer to convey legitimacy
- [ ] **Footer redesign** — replace the single copyright line with a two-column footer containing nav links (About, Terms, Privacy, Contact), social icons, and the brand lockup; the current footer is invisible on most screens

### 25c. Navigation & Portal Sidebar

- [x] **User identity in the sidebar footer** — `PortalSidebarUser` + `getPortalLayoutData` / `PortalIdentity`; avatar, display name, role badge, sign-out; mirrored in mobile nav sheet
- [x] **Sidebar active state redesign** — the current active state is `bg-accent` (same gray as muted) with no color differentiation; replace with a warm-tinted pill (`bg-primary/10 text-primary font-semibold`) plus a left-border accent bar so the active page is unmistakeable
- [x] **Sidebar brand lockup** — the `PawPrint` icon next to "Fostr Find" in the sidebar header is the same size and color as the nav icons below it; make the brand treatment larger, give the paw a warm color, and separate it visually with more padding so it reads as a logo not a nav item
- [x] **Micro-transitions on nav items** — add `transition-all duration-150` with a subtle `translate-x-0.5` on hover so links feel interactive; currently only `transition-colors` is applied
- [x] **Unread badge pulse animation** — add a `animate-pulse` ring on the unread message badge when count > 0 to draw attention without being disruptive

### 25d. Dog Cards (Browse Grid)

- [x] **"No photo" placeholder redesign** — the current placeholder is a flat gray box with "No photo" text in the center; replace with a warm gradient fill + a centered illustrated dog silhouette SVG (or a `PawPrint` icon at larger size with opacity) so cards without photos still feel intentional
- [x] **Card hover state** — replace `hover:shadow-md transition-shadow` with a richer hover: `hover:shadow-lg hover:-translate-y-1 transition-all duration-200`; currently the shadow change is barely perceptible
- [x] **Photo aspect ratio + object-position** — the photo area is a fixed `h-52` div; use a `aspect-[4/3]` approach instead so cards are consistent regardless of uploaded image dimensions; add `object-position: center top` to favor the dog's face
- [x] **Badge styling** — the size/age/gender badges use `variant="secondary"` (light gray); replace with colored variants: warm amber for age, teal/sage for size, soft pink/blue for gender; add a small relevant icon inside each badge (e.g. `Ruler` for size, `Calendar` for age)
- [x] **"View Dog" button** — the full-width dark button at the bottom of every card is heavy; replace with a lighter `variant="ghost"` or outlined button with an arrow icon, or remove the button entirely and make the whole card a link with a visible arrow chevron on hover
- [x] **Shelter name treatment on card** — the `MapPin` + shelter name is currently 3px of muted text; upgrade to show the shelter's logo avatar (tiny, 16px) inline next to the shelter name for recognisability
- [x] **Special needs indicator** — if `dog.special_needs` is set, surface a small "Special needs" badge or heart icon on the card photo corner (top-right overlay) so it's visible at a glance in the grid

### 25e. Browse Page Layout

- [x] **Sticky filter sidebar** — the filter sidebar scrolls away with the page; add `sticky top-6` so filters stay in view while browsing the grid
- [x] **Filter sidebar as floating card** — wrap the filter sidebar in a `Card` with `shadow-sm` and `rounded-xl` so it has visual weight and looks like a panel, not bare text on the page background
- [ ] **Filter chips / pill selectors** — replace the checkbox lists for Size and Age with horizontal pill/chip toggle buttons (outlined → filled on select) which are more mobile-friendly and visually legible; keep checkboxes only for the binary medical toggle
- [x] **Results count + active filter chips** — show a "12 dogs found" count above the grid with removable chips for each active filter so users can see and undo filters without scrolling back to the sidebar
- [x] **Mobile filter sheet** — on small screens the 64-width sidebar is hidden but there is no "Filter" button to access it; add a floating `Filter` pill button fixed to the bottom of the screen on mobile that opens a `Sheet` containing the filter sidebar

### 25f. Application & Status Cards

- [x] **Status badge color coding** — `StatusBadge` currently maps all statuses to generic variants; create a proper color scheme: `submitted` → blue, `reviewing` → amber, `accepted` → green, `declined` → red, `completed` → purple; add an icon per status (Clock, Eye, CheckCircle, XCircle, Award)
- [x] **Application card visual hierarchy** — the `ApplicationCard` shows avatar + name + dog name as flat text; add a right-side arrow chevron to indicate it's clickable, and use `font-semibold` for the dog's name to create clear hierarchy
- [x] **Foster application status card** — add a progress-step indicator (submitted → reviewing → accepted/declined → completed) as a horizontal stepper on the foster's application detail view so they can visually track where their application is
- [x] **Accepted application highlight** — give accepted applications a green-tinted card border (`border-l-4 border-l-green-500`) on list views to make them immediately identifiable

### 25g. Empty States

- [ ] **Illustrated empty states** — all empty states currently show plain text with no visual; add a unique SVG illustration or icon composition per context (e.g. a sleepy dog for "no applications", a magnifying glass with paw for "no dogs match filters", a speech bubble for "no messages")
- [~] **Empty state CTA buttons** — `EmptyState` is a client component: use `href` from Server Components, `onClick` from Client Components; browse (clear filters), messages, shelter dashboard, and shelter applications list now wire CTAs — finish auditing any remaining empty views

### 25h. Forms & Inputs

- [x] **Input focus ring** — the default focus ring uses `--ring` (same dark navy as the text); replace with a warm-colored focus ring (`ring-primary/50` or the new `--warm` token) so focused inputs are clearly highlighted
- [ ] **Section headers inside forms** — `CardTitle` headings like "Personal Info" and "Foster Preferences" are plain `font-semibold` text; add a colored left-border accent line or a small icon before each section title to create visual anchoring
- [ ] **Avatar upload area redesign** — the current upload area is a `h-16 w-16` circle with an `Upload` icon; replace with a dashed-border drop zone (`border-2 border-dashed border-muted-foreground/30 hover:border-primary`) that shows a preview when a file is selected, and a subtle "Drag & drop or click to upload" label
- [ ] **Inline field validation styling** — required fields have no visual indicator (no asterisk, no color); add a subtle red `*` after required labels and a green checkmark icon that appears inside the input when the field is valid
- [ ] **Profile completeness bar** — the `ProfileCompleteness` banner is plain muted/border; restyle it as a warm amber/honey banner with a progress bar that fills with the warm accent color and animated transitions when new fields are completed
- [ ] **Floating save button** — on long forms (foster profile, shelter settings) the save button is at the very bottom and requires scrolling; add a sticky `bottom-0` save bar that appears once the user has made a change (dirty state detection)

### 25i. Dashboard (Shelter)

- [x] **Stat card visual lift** — the three stat cards (`Active Listings`, `Pending Applications`, `Unread Messages`) are white cards with a large number and a tiny muted icon; add a colored icon background pill per stat (teal for dogs, amber for applications, blue for messages), a subtle trend indicator (arrow + % vs last week, even as placeholder), and increase the number to `text-4xl font-extrabold`
- [x] **Dashboard greeting** — add a personalised greeting at the top (`Good morning, Happy Paws 👋`) pulled from the shelter name and current time; small detail, large impact on warmth
- [x] **Recent applications section** — the list of `ApplicationCard` components has no visual "section card" wrapper; wrap it in a `Card` with a `CardHeader` that includes a "View all" link so the section feels intentional and contained

### 25j. Messaging

- [x] **Message bubble styling** — chat rows styled as bubbles (primary fill + tail for outgoing, muted + tail for incoming) in `MessageThread`
- [ ] **Incoming sender avatar in thread** — show the other party’s avatar next to incoming bubbles in `MessageThread` (thread list polish and bubbles are done; avatar column not implemented yet)
- [x] **Thread list previews** — message thread list items should show a truncated last message body, a relative timestamp ("2 min ago"), and a bolder unread indicator (full background tint on unread rows, not just a badge)
- [x] **Typing indicator placeholder** — add a "..." animated bubble that can be wired to Realtime when that is implemented; even as a static decoration in the interim it signals the design intent
- [x] **Empty message thread state** — when a thread has no messages yet (just accepted), show a warm illustrated placeholder ("Say hello to get the conversation started") instead of a blank white area

### 25k. Onboarding Flow

- [ ] **Role selection cards redesign** — the two role cards ("I'm a Shelter" / "I'm a Foster Parent") are basic bordered cards; redesign with a full-bleed illustrated header image per role (shelter building vs. cosy home), bolder headline, bullet list of what you can do, and a bottom CTA; add a `hover:scale-[1.02]` transform and a heavier border on hover
- [x] **Multi-step progress indicator** — `StepIndicator` on role + profile steps: "Step N of M" label and progress bar (`TOTAL_STEPS` derived from `STEP_META`)
- [ ] **Shelter form visual grouping** — the shelter onboarding form is one flat column of inputs; group them into visual clusters (Basic Info, Contact, Online Presence) with thin dividers and subsection labels

### 25l. Micro-interactions & Motion

- [ ] **Page transition** — add a subtle `opacity-0 → opacity-100` fade on route change using a layout-level animation wrapper so navigating between pages feels smooth rather than an instant flash
- [x] **Button loading state** — buttons in loading state currently just change label text; add an inline `Loader2` spinning icon (from lucide) before the label so the affordance is clearer
- [ ] **Card entrance animations** — dog browse cards, application cards, and dashboard stat cards should fade-and-slide-up on mount using `animate-fade-in` with staggered `animation-delay` based on index, so grids don't pop in all at once
- [x] **Toast redesign** — Sonner toasts are styled by default; customise with the brand palette — success toasts with a warm green + paw checkmark icon, error toasts with a muted red, info toasts with the brand warm color

### 25m. Accessibility & Responsive Polish

- [x] **Keyboard focus visibility** — run through all interactive elements; many shadcn defaults have `focus-visible:ring-2` but the ring color (dark navy on white) has low contrast ratio; switch to a high-contrast ring using the new warm accent token
- [ ] **Responsive browse layout** — on screens between `sm` and `md` the filter sidebar and grid are squeezed into a cramped two-column layout; add a collapsible sidebar toggle at the `md` breakpoint so the grid can use full width when filters are hidden
- [x] **Mobile form inputs** — `Input` / `SelectTrigger` use `h-11 md:h-10`; `Textarea` has taller min-height + padding on mobile; browse filters use `min-h-[44px]` rows for checkbox/radio rows
- [ ] **Print stylesheet** — `/shelter/applications/[id]` and foster profiles are the kind of pages shelter staff may want to print; add a `@media print` block that hides the nav, action buttons, and sidebar and formats the content as a clean single-column document

### 25n. Main content width & alignment (portal pages)

On wide screens the main content column (`flex-1` in `(foster)/` and `(shelter)/` layouts) often leaves a large empty band on the right: **profile** forms read as a narrow left-aligned block, and **`EmptyState`** blocks (applications, messages, history, etc.) sit off-center relative to the full viewport. Populated lists may need different treatment, but the baseline should feel balanced.

- [ ] **Center and constrain main content** — audit foster and shelter portal pages: wrap page body in a consistent container (e.g. `mx-auto w-full max-w-*` with horizontal padding, or `flex justify-center` for empty states) so primary content is visually centered in the main pane and uses width intentionally (not stuck to the left with excess negative space)
- [ ] **Profile & long forms** — foster profile and similar multi-card forms: either widen the form column to a comfortable max (e.g. `max-w-4xl` centered) or use a two-column grid on `lg+` so fields use horizontal space without a huge empty margin
- [ ] **Empty states in context** — ensure `EmptyState` (and equivalent “no data” layouts) is centered within the **main content area** (not only self-centered inside a narrow left-aligned wrapper); verify after layout changes on empty and populated pages

---

## 26. Pre-Launch Hardening

> Gaps found during codebase audit that any production MVP should address. Grouped by severity.

### RED — must fix before real users

- [x] **Database indexes** — migration `20240109000000_add_indexes.sql` adds all required indexes
- [x] **Atomic status transitions** — migrations `20240110000000_atomic_transitions.sql`; accept/complete API routes use `accept_application` / `complete_application` RPCs
- [x] **Unique constraints** — migration `20240111000000_unique_constraints.sql` adds `UNIQUE(dog_id, foster_id)` on `applications` and `UNIQUE(application_id)` on `ratings`
- [ ] **RLS: block applications to non-available dogs** — add INSERT policy check `dog_id IN (SELECT id FROM dogs WHERE status = 'available')` so fosters cannot apply to pending/placed dogs at the DB level
- [x] **`getUser()` error handling** — all server pages throw `authError` inside try-catch → `fetchError = true` → `ServerErrorPanel`; no silent redirect on network/token errors
- [x] **Server page error handling** — all server pages wrap Supabase queries in try-catch; `ServerErrorPanel` shown on failure

### ORANGE — should fix before launch

- [x] **Message thread query-level auth** — thread pages use `.eq('shelter_id', ...)` / `.eq('foster_id', ...)` guards alongside RLS
- [x] **Profile form validation** — `fosterProfileSchema` in `foster-profile-form.tsx` and `shelterSettingsSchema` in `shelter-settings-form.tsx` both use Zod with per-field error display
- [ ] **Sanitize error messages** — replace raw `error.message` displays (which can leak RLS policy names) with generic user-facing messages; log originals server-side
- [x] **Image domain config** — `images.remotePatterns` for Supabase Storage hostname added to `next.config.mjs`
- [x] **Centralize `DEV_MODE`** — exported from `src/lib/constants.ts`; all files import from there

### YELLOW — good practice

- [x] **Page metadata** — `metadata` exports on all portal pages (dashboard, applications, messages, history, settings, browse, dog detail, etc.)
- [x] **Remove unused `pg` dependency** — `pg` is not present in `package.json`

---

## 27. Phase 6 backlog mirror

> **Source of truth:** [`docs/roadmap.md`](./roadmap.md) — section **“Phase 6: Discovery, Trust & Safety (Backlog)”**. This block is a quick checkbox list for agents who live in TODO.md first; specs, ordering, and “relationship to Step X” notes stay in the roadmap.

- [x] **6.1** Browse / directory: search **listings by shelter name** (extends Step 13; optional `/shelters` index)
- [x] **6.2** Shelter UI: **foster lookup & past-foster history** (scoped to that shelter’s applications)
- [x] **6.3** Dog detail: **share** link (Web Share API + copy fallback; align with `og` metadata)
- [x] **6.4** **Mutual reporting** foster ↔ shelter — `reports` table + RLS + `POST /api/reports` + shared `ReportApplicationDialog` wired into both portals (admin triage queue still deferred)
- [x] **6.5** Foster **saved dogs** + shelter-visible **save counts** per dog — `dog_saves` table, `get_save_counts_for_my_dogs()` RPC, `/api/dogs/[id]/save` (POST/DELETE), `/foster/saved` page, heart on dog detail, real aggregate count on shelter dog cards
- [ ] **6.6** **Map view** of shelters in radius — **deferred**: gated on a geocoding pipeline + map provider/key (see roadmap Deferred Follow-ups Log 2026-04-29)
- [ ] **6.7** **Verification playbook** — consolidate email (Step 7), shelter `is_verified` workflow ([§22](./TODO.md#22-two-way-trust--ratings)), and any future foster trust-tier (product/legal TBD)
