# Fostr Fix — Technical TODO

Status legend: `[ ]` not started · `[~]` partial (UI exists, no backend) · `[x]` done

---

## 1. Onboarding & Profile Creation

- [~] Shelter onboarding form → currently logs to console; needs `insert` into `shelters` table
- [~] Foster onboarding form → currently logs to console; needs `insert` into `foster_parents` table
- [ ] Post-login role detection — login always redirects to `/shelter/dashboard`; should detect role and route to correct portal
- [ ] Google OAuth callback handling (button exists, flow untested end-to-end)

## 2. Dog CRUD (Shelter Side)

- [~] Create dog — `DogForm` renders with Zod validation; needs Supabase `insert` into `dogs` + link to shelter
- [~] Edit dog — edit page loads `DogForm` in edit mode; needs `select` by id then `update`
- [ ] Delete dog — no UI or logic exists
- [ ] Dog photo upload — file input renders; `/api/upload/photo` is a stub; needs FormData parsing, resize, Supabase Storage upload
- [ ] Photo preview/reorder in `DogForm`
- [ ] Dog status transitions (available → pending → placed) — no toggle/control in UI

## 3. Browse & Search (Foster Side)

- [~] Browse dogs page — renders 3 hardcoded `PLACEHOLDER_DOGS`; needs Supabase `select` from `dogs` where `status = 'available'`
- [~] Filter sidebar — checkbox/radio state works client-side; needs to drive real query params (size, age, gender, medical)
- [ ] Distance-based search — schema has lat/lng; needs haversine/PostGIS query
- [ ] Pagination / infinite scroll
- [~] Dog detail page — hardcoded dog; needs `select` dog + shelter by id

## 4. Applications

- [~] Apply for dog — button sets local state; needs `insert` into `applications` table
- [~] Foster "My Applications" page — empty array; needs `select` from `applications` joined with `dogs` + `shelters`
- [~] Shelter "Applications" page — empty array; needs `select` from `applications` joined with `dogs` + `foster_parents`
- [~] Application detail (shelter) — shows hardcoded foster data; needs real fetch + foster profile view
- [ ] Shelter internal notes — textarea exists; needs save on blur/submit (`update` `shelter_note`)
- [~] Accept application — `AcceptDeclineButtons` call `/api/applications/[id]/accept` which is a stub
- [~] Decline application — same; stub returns `{ success: true }`
- [~] Complete foster — same; stub returns `{ success: true, promptRating: true }`
- [ ] Status change side effects: accepting should set dog → `pending`, declining others, completing should set dog → `placed`

## 5. API Routes (All Stubs)

- [ ] `POST /api/applications/[id]/accept` — auth check, verify shelter ownership, update status, update dog, email foster
- [ ] `POST /api/applications/[id]/decline` — auth check, verify shelter ownership, update status, email foster
- [ ] `POST /api/applications/[id]/complete` — auth check, update status, set dog → placed, prompt rating
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

- [~] Foster profile page — form state works; needs `upsert` into `foster_parents`
- [~] Shelter settings page — form renders; needs `update` on `shelters` table
- [ ] Avatar/logo upload — file inputs exist; needs Supabase Storage wiring
- [~] `ProfileCompleteness` component — calculates % from local state; needs to read from DB

## 9. Dashboard (Shelter)

- [~] Dashboard page — renders cards with hardcoded zeros
- [ ] Fetch active dog count (`select count` from `dogs` where shelter)
- [ ] Fetch pending application count
- [ ] Fetch recent applications list
- [ ] Fetch unread message count

## 10. Foster History

- [~] History page — empty array; needs `select` from `applications` where `status = 'completed'` joined with `dogs` + `ratings`
- [ ] `FosterHistoryCard` component exists but is unused by the page

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

- [ ] Rate limiting on API routes
- [ ] Input sanitization on all user-submitted text (XSS prevention)
- [ ] Prevent duplicate applications (same foster + same dog)
- [ ] Verify application ownership before status changes
- [ ] Handle expired/revoked sessions gracefully
- [ ] CSRF protection on mutation endpoints

## 14. UX Polish

- [ ] Loading skeletons on data-fetching pages (shadcn `Skeleton` is installed)
- [ ] Toast notifications on success/error for all mutations (shadcn `Sonner` is installed)
- [ ] Mobile navigation (sidebar is `hidden md:flex`; no hamburger menu)
- [ ] Active nav link highlighting (currently all links same style)
- [ ] Empty state components (`EmptyState` exists but not used on most pages)
- [ ] Form error display improvements
- [ ] Optimistic UI updates for messaging
- [ ] Confirmation dialogs before destructive actions

## 15. Infrastructure

- [ ] Environment variable validation on startup
- [ ] Error boundary improvements (`error.tsx` exists but is generic)
- [ ] Sentry or equivalent error tracking
- [ ] Analytics (PostHog, Mixpanel, etc.)
- [ ] CI/CD pipeline
- [ ] Production deployment (Vercel)
- [ ] Database backups strategy
- [ ] Seed script for development data
