# Launch Capacity Plan

> Hardening audit finding 8.2 — define load budgets and graceful degradation
> before broad public launch.

## Service Tier Assumptions (Pilot / MVP)

| Service | Plan | Key Limit |
|---|---|---|
| Supabase | Free | 500 MB DB, 60 direct connections, 200 pooled, 2 GB storage bandwidth/month |
| Vercel | Hobby | 10 s serverless timeout, 100 GB bandwidth/month |
| Resend | Free | 100 emails/day, 1 req/s |
| Supabase Storage | Free | 1 GB storage, 2 GB bandwidth/month |

## Breaking Points (10,000 users/hour estimate)

1. **Supabase connection pool (hits first):** ~2,000 concurrent authenticated users
   issuing DB queries will exhaust the 200-connection pool on free tier.
   *Mitigation:* Upgrade to Supabase Pro ($25/mo) before launch; enables 500 pooled.

2. **Resend email rate (hits second):** 100 emails/day on free tier is exhausted
   by a moderate batch of application accepts, declines, and invites.
   *Mitigation:* Upgrade Resend to paid ($20/mo for 50k/month) and add email queuing.

3. **Vercel 10 s timeout:** Long RLS queries or slow Resend calls can push
   acceptance/completion routes over the limit on the free plan.
   *Mitigation:* Move email sends fully fire-and-forget (already implemented with
   `void sendEmail(...)`) and upgrade to Vercel Pro for 60 s timeout.

4. **Storage bandwidth:** Supabase free tier has 2 GB/month storage bandwidth.
   Dog photo browsing at scale will exhaust this quickly.
   *Mitigation:* Enable Supabase CDN caching on storage objects; upgrade Storage plan.

## Recommended Pre-Launch Upgrades

- [ ] Supabase Pro (connection pool + PITR backup)
- [ ] Resend paid plan (50k emails/month)
- [ ] Vercel Pro or at minimum confirm function timeout behaviour

## Email / Notification Queue Strategy

Current state: emails are sent inline (fire-and-forget with `void sendEmail(...)`).
Failures are logged to console/Sentry but not retried.

**Before broad launch:** move email/notification creation to a durable queue:
- Option A: Supabase Edge Function with a `notification_queue` table + cron retry
- Option B: Resend's built-in scheduled sending (not yet available as of 2026)
- Option C: Vercel Cron + a `pending_emails` table

## Uptime and Alerting Targets

- [ ] Set up external uptime monitor (UptimeRobot / Better Uptime) on `/api/health`
- [ ] Create `/api/health` route that checks Supabase connectivity and returns 200/503
- [ ] Sentry error-rate alert: >5% of requests returning 5xx
- [ ] Supabase Dashboard billing alert: bandwidth, storage, connection usage

## Rate Limiting

Current rate limiting is process-local (see `src/lib/rate-limit.ts` for migration
instructions to Upstash Redis). Before broad launch:
- [ ] Migrate to distributed Upstash rate limiter
- [ ] Add WAF-level DDoS protection (Vercel Pro or Cloudflare)
