# Data Privacy, Retention, and Deletion Policy

> Hardening audit finding 4.2 — defines retention windows, deletion/anonymization
> behavior, and data export requirements.

## PII Inventory

| Table | PII Columns | Sensitivity |
|---|---|---|
| `shelters` | name, email, phone, location, ein, logo_url, instagram, website | High (EIN is tax ID) |
| `foster_parents` | first_name, last_name, email, phone, location, avatar_url, bio, other_pets_info, children_info | High |
| `applications` | available_from, available_until, why_this_dog, emergency_contact_name, emergency_contact_phone | Medium |
| `messages` | body (may contain personal details) | High |
| `shelter_foster_invites` | email, message | Medium |
| `notifications` | title, body, metadata | Low |
| `reports` | body, reporter_user_id, subject_*_id | High (safety data) |
| `ratings`, `shelter_ratings` | comment, score | Medium |

## Retention Windows

| Data Type | Retention | Trigger |
|---|---|---|
| Active profile data | Until account deletion | User request |
| Completed placement history (applications, ratings, messages) | Pseudonymized indefinitely | Account deletion |
| Safety reports | 2 years from resolution | Manual admin review |
| Invite records | 1 year from creation | Batch cleanup job (not yet implemented) |
| Notifications | 90 days | Batch cleanup job (not yet implemented) |

## Account Deletion Flow

Account deletion is handled by `POST /api/account/delete` and implemented
in two phases:

1. **`prepare_account_deletion(user_id)` SQL RPC** (migration `20240125`):
   - Declines all active applications (submitted, reviewing, accepted)
   - Anonymizes shelter rows: replaces PII fields with "Deleted Shelter" / `deleted@fostrfind.invalid`
   - Anonymizes foster_parents rows: replaces PII fields with "Deleted User" / `deleted@fostrfind.invalid`
   - All changes are atomic — the entire cleanup either succeeds or rolls back.

2. **`auth.admin.deleteUser(userId)`**: Deletes the auth.users row.
   - `shelters.user_id` → CASCADE DELETE → deletes shelter row → CASCADE deletes dogs/applications
   - `foster_parents.user_id` → CASCADE DELETE → deletes foster row → CASCADE deletes dog_saves

3. **Preserved data**: Completed placement history (applications with status=completed,
   messages, ratings) is preserved with pseudonymized names for shelter operational
   continuity.

### Deletion Audit Event

The deletion is logged as a `console.warn` event with `[account/delete]` prefix
in the route at the time of auth user deletion. Until structured logging is implemented,
this appears in Vercel/hosting function logs and is captured by Sentry.

## User Data Export

**Status: Not yet implemented.** Before launch in jurisdictions requiring data
portability (EU GDPR Article 20, CCPA), implement a `GET /api/account/export`
route that returns a JSON zip of:
- Profile data (shelter or foster_parents row, minus internal FKs)
- Applications (submitted by or received by the user)
- Messages (sent or received)
- Ratings (given or received)
- Reports filed by the user

## Data Processor Inventory

| Processor | Data Shared | Agreement Required |
|---|---|---|
| Supabase | All table data, auth credentials | DPA via Supabase dashboard |
| Resend | Email addresses, notification content | DPA available |
| Sentry | Error payloads, stack traces | DPA available; PII scrubbing required |
| Vercel | HTTP request logs, function logs | DPA available |

## Next Steps

- [ ] Implement `GET /api/account/export` for data portability
- [ ] Add batch cleanup jobs for invite and notification retention windows
- [ ] Sign DPAs with all processors before EU launch
- [ ] Add cookie consent banner if using analytics
- [ ] Define breach notification procedures (72-hour window for GDPR)
