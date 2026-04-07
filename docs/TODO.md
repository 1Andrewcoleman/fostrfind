# Fostr Fix — Technical TODO

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
- [ ] Delete dog — no UI or logic exists
- [ ] Dog photo upload — file input renders; `/api/upload/photo` is a stub; needs FormData parsing, resize, Supabase Storage upload
- [ ] Photo preview/reorder in `DogForm`
- [ ] Dog status transitions (available → pending → placed) — no toggle/control in UI

## 3. Browse & Search (Foster Side)

- [x] Browse dogs page — Supabase `select` from `dogs` where `status = 'available'`, nested `shelters` for name/logo (DEV_MODE still uses placeholders)
- [~] Filter sidebar — filters fetched rows client-side (size, age, gender); medical filter not applied to query; URL query params not wired
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
- [ ] `POST /api/notifications/send` — Resend integration (code is commented out), email templates
- [ ] `POST /api/upload/photo` — auth check, FormData parse, image resize, Supabase Storage upload, return public URL

## 6. Messaging

- [~] Message thread pages (foster + shelter) — UI renders with hardcoded placeholder messages
- [ ] Send message — input exists; needs `insert` into `messages` table
- [ ] Fetch messages — needs `select` from `messages` where `application_id` matches
- [ ] Message list pages — empty arrays; needs `select distinct application_id` grouped threads
- [ ] Supabase Realtime subscription — subscribe to `postgres_changes` on `messages` table for live updates
- [ ] Unread message count / indicators
- [ ] Mark messages as read on open

## 7. Ratings & Reviews

- [ ] Rating submission UI after foster completion (no UI exists)
- [ ] `StarRating` component exists but is unused — wire into completion flow
- [ ] `insert` into `ratings` table
- [ ] Display average rating on foster profile (`calculateAverageRating` helper exists)
- [ ] Rating history on foster history page

## 8. Profile Management

- [x] Foster profile page — server-fetches `foster_parents` row; `FosterProfileForm` client component upserts via Supabase; Sonner toasts
- [x] Shelter settings page — server-fetches `shelters` row; `ShelterSettingsForm` client component updates via Supabase; Sonner toasts
- [ ] Avatar/logo upload — file inputs exist (disabled); needs Supabase Storage wiring
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

- [ ] Set up Resend API key (currently placeholder in `.env.local`)
- [ ] Application submitted → email shelter
- [ ] Application accepted → email foster
- [ ] Application declined → email foster
- [ ] Foster completed → email both parties
- [ ] New message → email recipient (debounced)
- [ ] Email templates (HTML) for each notification type

## 12. Photo & File Storage

- [ ] Supabase Storage upload helper (shared across dog photos, logos, avatars)
- [ ] Image resize/optimization before upload
- [ ] Storage bucket RLS policies (currently buckets exist but no access policies)
- [ ] Delete old photos on replacement
- [ ] Max file size validation client-side

## 13. Security & Edge Cases

- [x] RLS recursion fix — `SECURITY DEFINER` helpers (`get_my_foster_ids`, `get_my_shelter_ids`) break circular policy deps (migration `20240102000000`)
- [x] Verify application ownership before status changes (all three API routes check shelter `user_id`)
- [ ] Rate limiting on API routes
- [ ] Input sanitization on all user-submitted text (XSS prevention)
- [ ] Prevent duplicate applications (same foster + same dog)
- [ ] Handle expired/revoked sessions gracefully
- [ ] CSRF protection on mutation endpoints

## 14. UX Polish

- [x] Toast notifications on success/error for all mutations (Sonner wired on profiles, application actions, internal notes)
- [x] Confirmation dialogs before destructive actions (accept/decline/complete use `AlertDialog`)
- [ ] Loading skeletons on data-fetching pages (shadcn `Skeleton` is installed)
- [ ] Mobile navigation (sidebar is `hidden md:flex`; no hamburger menu)
- [ ] Active nav link highlighting (currently all links same style)
- [~] Empty state components — used on browse, shelter dogs, applications, dashboard, history
- [ ] Form error display improvements
- [ ] Optimistic UI updates for messaging

## 15. Infrastructure

- [ ] Environment variable validation on startup
- [ ] Error boundary improvements (`error.tsx` exists but is generic)
- [ ] Sentry or equivalent error tracking
- [ ] Analytics (PostHog, Mixpanel, etc.)
- [ ] CI/CD pipeline
- [ ] Production deployment (Vercel)
- [ ] Database backups strategy
- [ ] Seed script for development data
