# Fostr Find — Product Description (Source of Truth)

This document describes **what Fostr Find is** and **what it does today**, in plain language. It is intended for product, pricing, partnerships, and onboarding—not engineering. When another document disagrees with this one for **product behavior**, treat **this file as authoritative** unless it is explicitly updated.

---

## One-sentence summary

**Fostr Find is a two-sided platform where animal shelters list dogs that need foster homes, and approved foster parents discover those dogs, apply, message the shelter, and move through placement—while both sides track applications, messages, and history in one place.**

---

## The problem it solves

Shelters need reliable foster placements without juggling spreadsheets, scattered emails, and unclear application status. Foster parents need a trustworthy way to find real dogs from real organizations, apply once per dog, and stay in the loop through acceptance, placement, and follow-up. Fostr Find connects those workflows so neither side is guessing where things stand.

---

## Who the product serves

### Shelters (organizations)

Staff sign up as a shelter, complete an organization profile, and manage their listings and foster pipeline inside a dedicated **shelter portal**.

### Foster parents (individuals)

Individuals sign up as foster parents, build a profile that shelters see when they apply, and use a **foster portal** to browse, save dogs, apply, and communicate.

### The public (no account)

Anyone can view select **marketing pages**, **legal pages**, a **directory of shelter profiles**, and **shareable dog pages** so shelters can link out from social posts or email campaigns without forcing a login.

---

## How accounts and roles work

- A person creates **one login** and chooses whether they are onboarding as a **shelter** or a **foster parent**.
- Shelters and fosters **do not share the same dashboard**; each role has its own navigation and pages.
- Shelters are tied to **one primary organization account** in the current product (not multi-user shelter teams in-app).

---

## Shelter-side functionality (what shelters can do)

### Organization profile and settings

- Create and maintain shelter profile information used across listings and public pages (for example: name, location, contact details, bio, logo, website and social links where collected).
- Manage **account settings** tied to login (email and password updates, account deletion where enabled).
- **Verified shelter badge**: the product supports marking a shelter as verified for trust signals on listings and profiles; verification is an operational/settings outcome rather than a self-serve wizard in this description.

### Dog listings

- **Add, edit, and delete** dogs available for foster placement.
- Maintain dog details that support discovery and informed applications (for example: photos, description, size, age band, gender, medical or special-needs flags, temperament notes as surfaced in the product).
- Dogs move through **listing statuses** that reflect the placement lifecycle (such as available, pending placement, placed, and adopted—as shown to users). Shelters work within those states when processing applications and completions.

### Applications pipeline

- See **incoming applications** from foster parents for their dogs.
- **Review applications** in grouped views (for example: new, in review, accepted, declined, completed, withdrawn).
- Open an **application detail** view that brings together the dog, the applicant’s foster profile, internal shelter notes, and actions.
- **Accept** or **decline** applications; **mark placements complete** when a foster run ends successfully from the shelter’s perspective.
- Record **internal notes** on an application visible to the shelter team only (not to the foster).
- See when a foster **withdraws** an application so it does not disappear from history—it remains visible as withdrawn.

### Ratings (shelter → foster)

- After a completed placement, shelters can **rate the foster parent** (for example: star score with optional comment), supporting reputation on future applications.

### Messaging

- Exchange **threaded messages** with a foster parent in the context of an **accepted or completed application** (conversation is tied to that placement thread).
- See **message threads** with previews and indicators for **unread** messages.
- Unread counts surface in navigation so shelters know when to follow up.

### Notifications

- Receive **in-app notifications** for important events (for example: new applications and outcomes that trigger alerts—exact wording and types are product-facing rather than technical).
- Open a **notifications list**, mark items read, and navigate to the linked place in the product.

### Shelter directory and discovery (public-facing)

- Shelters appear in a **public shelter directory** with search.
- Each shelter has a **public profile page** fosters can use to learn about the organization before applying.

### Foster roster and invitations (relationship management)

- Maintain a **foster roster** scoped to that shelter: see fosters they have a relationship with (through placements/history as modeled in the product), search within it, and view a **foster detail** page for context.
- **Invite** fosters by email to join or reconnect on the platform; invites show up in the foster portal as **Invites** with accept/decline flows where applicable.
- Record **notes about fosters** on the roster for internal shelter use.

### Signals that help prioritization

- See **how many fosters have saved** a given dog listing (aggregate interest signal), alongside applications.

### Trust and safety (basic)

- Participate in **mutual reporting** flows tied to an application context when something needs review (structured reporting, not public comments).

### Feedback (product input)

- Submit **feedback** from shelter settings so operational issues and ideas reach the team.

---

## Foster-side functionality (what foster parents can do)

### Profile

- Complete a **foster profile** shelters see when evaluating applications (housing, preferences, experience, and other fields collected during onboarding and profile editing).

### Discovery and browsing

- **Browse** dogs available from participating shelters.
- Filter listings by attributes such as **size, age, gender, and medical needs**, with filters reflected in the browsing experience.
- **Distance-style filtering** may appear where location data exists for fosters and shelters (when coordinates are present).
- Filter browsing by **shelter** (including deep links from shelter profiles).
- **Save** dogs to a personal **Saved** list.
- Open **dog detail** pages; logged-out visitors can see a **teaser** view on the same shareable URL; fosters see full detail and apply where eligible.

### Applications

- **Apply** to foster a specific dog with application details the shelter requests (including availability dates and a personal note).
- View **My Applications** with status and progression.
- **Withdraw** an application while it is still in an early stage (it remains visible to the shelter as withdrawn rather than vanishing).

### Messaging

- Message shelters **in-context** for accepted/completed placements, with **thread lists** and **unread** indicators consistent with the shelter experience.

### Notifications

- Receive and manage **in-app notifications** linked to relevant pages.

### Invites

- See shelter **invitations** and respond.

### Relationship with shelters

- View **which shelters currently have them on a roster** (for example after an accepted placement or accepting an invite), with navigation to shelter context where provided.

### History

- Review **past placements** and related **ratings** visible to the foster (including presentation of reviews left by shelters after completion).

### Account

- Manage **account settings** (email/password and deletion where enabled).
- Submit **feedback** from profile.

---

## Placement lifecycle (conceptual, not legal language)

Typical happy path:

1. Shelter lists a dog.
2. Foster discovers the dog and submits an application.
3. Shelter reviews and **accepts**; the dog moves into a “pending placement” style state from a listing perspective.
4. Parties coordinate via **in-app messaging**.
5. Shelter marks the placement **complete**; the dog moves to a **placed** style outcome.
6. Shelter may **rate** the foster afterward.

Alternate paths include **declined** applications, **withdrawn** applications, and dogs returning toward **available** when operational decisions allow (per shelter tools available in-product).

---

## Email and outbound communication (product-level)

The platform is built to send **transactional emails** for key events (for example: application submitted, application accepted or declined, placement completed, invitations, and related notifications). Exact templates and which events are active in a given environment are operational choices; the **intent** is that important transitions do not rely solely on someone remembering to log in.

---

## Payments and subscriptions

**There is no in-product billing, subscription checkout, or paywalled feature gate described here.** Pricing models are outside this document unless explicitly added later. This description states current **capabilities** only.

---

## Explicit boundaries (what this description is not claiming)

- **Not a multi-user shelter staff product** with roles and permissions per employee account (single shelter login model unless separately expanded).
- **Not real-time chat** in the sense of live “typing…” sync—messaging is threaded and refresh-based from a user expectation standpoint unless upgraded.
- **Not a national adoption marketplace** focused on permanent adoption paperwork—focus is **foster placement** workflows between shelters and fosters.
- **Not a replacement for legal contracts or home inspections**—it supports coordination and records application decisions and messages, not offline compliance.

---

## Brand and trust stance (non-visual)

Fostr Find presents itself as **calm, credible, and rescue-oriented**: emphasizing clarity of process (“how it works”), honest listings, and respectful communication between shelters and fosters rather than gamified metrics.

---

## Revision discipline

When functionality changes materially (new modules, removed modules, or changed roles), **update this document in the same change cycle** so it remains the single plain-language source of truth.

*Last reviewed against product scope: 2026-05-05.*
