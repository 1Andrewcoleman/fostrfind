# Fostr Find — Technical MVP Specification

**For:** Solo technical founder building with Cursor  
**Stack:** Next.js + Supabase + Tailwind  
**Target:** 3-week functional MVP

---

## Tech Stack

| Layer | Tool | Why |
|-------|------|-----|
| Framework | Next.js 14 (App Router) | Full-stack React, SSR, API routes, fast deploys |
| Database | Supabase (PostgreSQL) | Auth, DB, storage, realtime — one platform |
| Auth | Supabase Auth | Email + Google sign-in, role-based access |
| Storage | Supabase Storage | Dog photos, shelter logos, foster documents |
| Styling | Tailwind CSS + shadcn/ui | Rapid UI development, consistent components |
| Search | PostGIS (via Supabase) | Location-based foster search by radius |
| Email | Resend | Transactional emails (application updates, notifications) |
| Hosting | Vercel | Zero-config Next.js deploys, preview URLs |
| Analytics | PostHog (free tier) | Usage tracking, funnel analysis |

---

## Database Schema

### `shelters`
```
id              uuid        PK, default gen_random_uuid()
created_at      timestamptz default now()
user_id         uuid        FK -> auth.users(id)  -- the shelter admin account
name            text        NOT NULL
slug            text        UNIQUE NOT NULL  -- URL-friendly name
email           text        NOT NULL
phone           text
location        text        NOT NULL  -- city, state
latitude        float8
longitude       float8
logo_url        text
ein             text        -- 501(c)(3) verification
bio             text        -- short description
website         text
instagram       text
is_verified     boolean     default false
```

### `dogs`
```
id              uuid        PK, default gen_random_uuid()
created_at      timestamptz default now()
updated_at      timestamptz default now()
shelter_id      uuid        FK -> shelters(id) ON DELETE CASCADE
name            text        NOT NULL
breed           text
age             text        -- "puppy", "young", "adult", "senior"
size            text        -- "small", "medium", "large", "xl"
gender          text        -- "male", "female"
temperament     text        -- free text description
medical_status  text        -- free text (vaccinated, spayed, etc.)
special_needs   text        -- "no cats", "needs medication", etc.
description     text        -- full bio
photos          text[]      -- array of storage URLs
status          text        default 'available'  -- "available", "pending", "placed", "adopted"
```

### `foster_parents`
```
id              uuid        PK, default gen_random_uuid()
created_at      timestamptz default now()
user_id         uuid        FK -> auth.users(id)
first_name      text        NOT NULL
last_name       text        NOT NULL
email           text        NOT NULL
phone           text
location        text        NOT NULL
latitude        float8
longitude       float8
housing_type    text        -- "house", "apartment", "townhouse"
has_yard        boolean     default false
has_other_pets  boolean     default false
other_pets_info text        -- "2 cats, 1 dog" etc.
has_children    boolean     default false
children_info   text        -- "ages 5 and 8" etc.
experience      text        -- "none", "some", "experienced"
bio             text
avatar_url      text
pref_size       text[]      -- ["small", "medium"] etc.
pref_age        text[]      -- ["puppy", "adult"] etc.
pref_medical    boolean     default false  -- willing to foster medical needs
max_distance    int         default 25     -- miles
```

### `applications`
```
id              uuid        PK, default gen_random_uuid()
created_at      timestamptz default now()
updated_at      timestamptz default now()
dog_id          uuid        FK -> dogs(id) ON DELETE CASCADE
foster_id       uuid        FK -> foster_parents(id) ON DELETE CASCADE
shelter_id      uuid        FK -> shelters(id) ON DELETE CASCADE
status          text        default 'submitted'  -- "submitted", "reviewing", "accepted", "declined", "completed"
note            text        -- optional message from foster
shelter_note    text        -- internal note from shelter
```

### `ratings`
```
id              uuid        PK, default gen_random_uuid()
created_at      timestamptz default now()
application_id  uuid        FK -> applications(id)
shelter_id      uuid        FK -> shelters(id)
foster_id       uuid        FK -> foster_parents(id)
dog_id          uuid        FK -> dogs(id)
score           int         NOT NULL  -- 1-5
comment         text
```

### `messages`
```
id              uuid        PK, default gen_random_uuid()
created_at      timestamptz default now()
application_id  uuid        FK -> applications(id) ON DELETE CASCADE
sender_id       uuid        FK -> auth.users(id)
sender_role     text        -- "shelter" or "foster"
body            text        NOT NULL
read            boolean     default false
```

---

## Auth & Roles

Supabase Auth handles sign-up/sign-in. After auth, users complete an onboarding flow that determines their role.

### Sign-up Flow
1. User signs up with email or Google
2. Redirect to `/onboarding`
3. User selects role: "I'm a shelter/rescue" or "I'm a foster parent"
4. Role-specific onboarding form
5. On submit, create row in `shelters` or `foster_parents` with their `user_id`
6. Redirect to role-specific dashboard

### Role Detection
- On every authenticated page load, check if `user_id` exists in `shelters` table → shelter dashboard
- Check if `user_id` exists in `foster_parents` table → foster dashboard
- Exists in neither → redirect to `/onboarding`

### Row Level Security (RLS)
- Shelters can only read/write their own shelter data and their own dogs
- Shelters can read foster profiles and applications for their dogs only
- Fosters can only read/write their own profile
- Fosters can read all dogs with status "available"
- Fosters can read/write their own applications
- Messages scoped to application participants only
- Ratings readable by anyone, writable only by shelter that managed the placement

---

## Page Structure & Routes

### Public Pages
```
/                       Landing page — hero, how it works, CTA to sign up
/login                  Sign in (email + Google)
/signup                 Sign up (email + Google)
```

### Onboarding
```
/onboarding             Role selection → role-specific form
```

### Shelter Pages (protected)
```
/shelter/dashboard      Overview: active listings, pending applications, recent activity
/shelter/dogs           List of all shelter's dogs (with status filter)
/shelter/dogs/new       Create new dog listing form
/shelter/dogs/[id]      Edit dog listing
/shelter/applications   All incoming applications across all dogs
/shelter/applications/[id]   Single application detail — foster profile, rating history, accept/decline
/shelter/messages       All message threads
/shelter/messages/[applicationId]   Single conversation thread
/shelter/settings       Shelter profile, logo, contact info
```

### Foster Pages (protected)
```
/foster/browse          Browse available dogs — card grid with filters
/foster/dog/[id]        Dog detail page — photos, full profile, shelter info, apply button
/foster/applications    My applications and their statuses
/foster/messages        All message threads
/foster/messages/[applicationId]   Single conversation thread
/foster/profile         My profile — edit info, preferences
/foster/history         My foster history — past dogs, ratings received
```

---

## Key User Flows

### Flow 1: Shelter Lists a Dog
1. Shelter clicks "Add Dog" from dashboard or dogs page
2. Fill form: name, photos (drag & drop upload), breed, age, size, gender, temperament, medical status, special needs, description
3. Photos upload to Supabase Storage, URLs stored in `dogs.photos` array
4. Submit → dog created with status "available"
5. Dog immediately visible to foster parents in browse

### Flow 2: Foster Browses & Applies
1. Foster navigates to `/foster/browse`
2. Default view: all available dogs within their `max_distance` radius, sorted by newest
3. Filter sidebar: breed, size, age, gender, medical needs, specific shelter
4. Click dog card → dog detail page with photo carousel, full bio, shelter name
5. Click "Apply to Foster" → modal with optional personal note
6. Submit → creates row in `applications` with status "submitted"
7. Email notification sent to shelter

### Flow 3: Shelter Reviews Application
1. Shelter sees new application in dashboard (badge count)
2. Click application → sees foster's full profile: name, location, housing, pets, kids, experience, bio
3. Below profile: foster's history — previous dogs fostered, ratings from other shelters, average score
4. Shelter clicks "Accept" or "Decline"
5. Status updates → email notification sent to foster
6. If accepted, messaging thread opens automatically
7. Dog status changes to "pending"

### Flow 4: Placement Completion & Rating
1. After foster period ends, shelter marks application as "completed"
2. Dog status changes to "placed" (or "adopted" if foster-to-adopt)
3. Shelter prompted to rate the foster: 1-5 stars + short comment
4. Rating appears on foster's history page
5. Dog appears in foster's history with dates and shelter name

### Flow 5: Messaging
1. Messaging available only after application is accepted
2. Threaded per application (one thread per dog-foster pairing)
3. Simple text messages, newest at bottom
4. Real-time updates via Supabase Realtime subscriptions
5. Unread badge count on dashboard and messages nav

---

## UI Components

### Shared
- `Navbar` — logo, navigation links (role-specific), avatar dropdown
- `AuthGuard` — wrapper component that redirects unauthenticated users to login
- `RoleGuard` — wrapper that checks shelter vs foster role
- `LoadingSpinner` — consistent loading state
- `EmptyState` — friendly message + CTA when lists are empty
- `StatusBadge` — color-coded pill for application/dog status
- `StarRating` — display and input component for 1-5 stars

### Shelter-Specific
- `DogForm` — create/edit dog listing with photo upload
- `DogCard` — compact card showing dog photo, name, status, application count
- `ApplicationCard` — foster name, photo, rating average, application date, status
- `FosterProfileView` — read-only view of foster's profile + history + ratings
- `AcceptDeclineButtons` — action buttons with confirmation modal

### Foster-Specific
- `BrowseDogCard` — photo, name, breed, age, size, shelter name, distance
- `DogDetailPage` — photo carousel, full profile, shelter info, apply CTA
- `FilterSidebar` — checkboxes and sliders for browse filters
- `ApplicationStatusCard` — dog photo, name, shelter, status, date applied
- `FosterHistoryCard` — dog photo, name, dates fostered, rating received
- `ProfileCompleteness` — progress indicator encouraging full profile

---

## API Routes (Next.js Route Handlers)

All data goes through Supabase client directly from components where possible (leveraging RLS). API routes only needed for:

```
POST /api/applications/[id]/accept    -- update status, send email, open messaging
POST /api/applications/[id]/decline   -- update status, send email
POST /api/applications/[id]/complete  -- mark completed, prompt rating
POST /api/notifications/send          -- send email via Resend
POST /api/upload/photo                -- handle image resize before Supabase Storage
```

Everything else (CRUD for dogs, fosters, applications, messages, ratings) → direct Supabase client calls with RLS.

---

## Image Handling

- Max 5 photos per dog listing
- Client-side resize to max 1200px width before upload (use browser canvas)
- Upload to Supabase Storage bucket `dog-photos` with path `/{shelter_id}/{dog_id}/{filename}`
- Store public URLs in `dogs.photos` array
- Display with Next.js `<Image>` component for automatic optimization
- Shelter logos: single image, bucket `shelter-logos`, path `/{shelter_id}/logo`
- Foster avatars: single image, bucket `foster-avatars`, path `/{foster_id}/avatar`

---

## Location & Search

### On Onboarding
- When shelter or foster enters their location (city, state), geocode to lat/lng
- Use a free geocoding API (Nominatim via OpenStreetMap) or browser Geolocation API
- Store `latitude` and `longitude` in their respective tables

### Browse Query
```sql
SELECT dogs.*, shelters.name as shelter_name, shelters.logo_url,
  (
    3959 * acos(
      cos(radians($foster_lat)) * cos(radians(shelters.latitude)) *
      cos(radians(shelters.longitude) - radians($foster_lng)) +
      sin(radians($foster_lat)) * sin(radians(shelters.latitude))
    )
  ) AS distance_miles
FROM dogs
JOIN shelters ON dogs.shelter_id = shelters.id
WHERE dogs.status = 'available'
HAVING distance_miles <= $max_distance
ORDER BY dogs.created_at DESC
```

For MVP, this haversine formula in SQL is sufficient. PostGIS extension can be enabled later for better performance at scale.

---

## Email Notifications (via Resend)

### Triggers
| Event | Recipient | Email |
|-------|-----------|-------|
| New application submitted | Shelter | "New foster application for {dog_name}" |
| Application accepted | Foster | "Great news — your application for {dog_name} was accepted!" |
| Application declined | Foster | "Update on your application for {dog_name}" |
| New message | Other party | "New message about {dog_name}" |
| Placement completed | Foster | "Thank you for fostering {dog_name}!" |

### Implementation
- Create email templates as React components (Resend supports this)
- Trigger via API route or Supabase database webhook
- For MVP: simple API calls from the action handlers (accept, decline, complete)
- Later: move to Supabase Edge Functions for background processing

---

## Realtime (Supabase Realtime)

Subscribe to changes on:
- `messages` table filtered by `application_id` — live chat updates
- `applications` table filtered by `shelter_id` — new application alerts for shelters
- `applications` table filtered by `foster_id` — status change alerts for fosters

```javascript
supabase
  .channel('messages')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `application_id=eq.${applicationId}`
  }, (payload) => {
    // append new message to UI
  })
  .subscribe()
```

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
NEXT_PUBLIC_APP_URL=
```

---

## Deployment

### Vercel
- Connect GitHub repo
- Set environment variables
- Auto-deploy on push to `main`
- Preview deploys on every PR

### Supabase
- Create project via dashboard
- Run migrations via Supabase CLI (`supabase db push`)
- Enable RLS on all tables
- Create storage buckets with appropriate policies
- Enable Realtime on `messages` and `applications` tables

---

## Development Order (3-Week Build)

### Week 1: Foundation + Shelter Side
- Day 1: Project setup, Supabase project, auth, database migrations
- Day 2: Onboarding flow (role selection, shelter form, foster form)
- Day 3: Shelter dashboard layout, dog listing CRUD
- Day 4: Photo upload, dog form polish
- Day 5: Shelter dogs list page with status filters
- Day 6-7: Buffer, testing, bug fixes

### Week 2: Foster Side + Core Loop
- Day 8: Foster browse page with dog cards
- Day 9: Filter sidebar, location-based search query
- Day 10: Dog detail page with photo carousel
- Day 11: Application flow (apply, shelter queue, accept/decline)
- Day 12: Foster profile page, history page, rating display
- Day 13: Rating system (shelter rates foster after completion)
- Day 14: Buffer, testing, bug fixes

### Week 3: Messaging + Notifications + Polish
- Day 15: Messaging UI and Supabase Realtime
- Day 16: Email notifications via Resend
- Day 17: Mobile responsiveness pass
- Day 18: Empty states, loading states, error handling
- Day 19: Landing page
- Day 20-21: Final testing, deploy to production, onboard first shelter

---

## Post-MVP Features (Do Not Build Yet)
- AI-based foster-dog matching
- Shelter management software integrations (Shelterluv, PetPoint)
- Training courses and certification badges
- Foster starter kit e-commerce
- Donation infrastructure
- Push notifications (native)
- Analytics dashboards for shelters
- Background check integration
- Foster-to-adopt conversion flow
- Multi-language support
