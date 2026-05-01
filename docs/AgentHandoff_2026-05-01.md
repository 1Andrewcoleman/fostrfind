# Agent Handoff · 2026-05-01 — Phase 7 Step 48

Read this before continuing Phase 7 notification work. This handoff only captures new implementation notes from Step 48.

## Notification foundation notes

- Step 48 uses `supabase/migrations/20240117000000_notifications.sql`, not the roadmap’s suggested `20240115000000_notifications.sql`, because that timestamp is already occupied by `dog_saves`.
- `createNotification()` lives in `src/lib/notifications.ts` and intentionally swallows both service-client construction failures and insert failures. Notification writes must never fail the primary user action.
- `src/lib/__tests__/service-client-allowlist.test.ts` now allowlists `src/lib/notifications.ts`; future service-role imports still need explicit review.
- `POST /api/messages` is now the only send path for `MessageThread`. Realtime receiving and client-side read receipts remain unchanged.
- `getPortalLayoutData()` now returns `unreadNotifications`; Step 49 can consume that count for the bell UI without adding another layout query.

## Verification notes

- Local dev server started successfully, but ports 3000–3002 were already occupied, so Next used `http://localhost:3003`.
- Manual DB smoke was not run in this session because the migration was not applied to a Supabase database from the agent environment. Apply `20240117000000_notifications.sql` before testing notification rows in SQL.
