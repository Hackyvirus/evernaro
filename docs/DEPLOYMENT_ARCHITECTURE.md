# Evernaro Deployment Architecture

## Overview

This document defines the production deployment architecture for Evernaro, a multi-tenant omnichannel customer communication SaaS built for Indian service businesses.

The intended architecture is:

- **Web application:** Vercel (Next.js App Router)
- **Background worker:** Render (persistent Docker worker)
- **Database:** Neon PostgreSQL
- **Queue / cache:** Upstash Redis
- **Domain:** `https://evernaro.com`
- **Email:** Resend
- **Payments:** Razorpay
- **WhatsApp:** Gupshup (via existing `src/lib/whatsapp.ts` implementation)
- **Monitoring:** Sentry
- **AI:** OpenAI or Anthropic (configurable)

## Verified compatibility

The following inspection was performed before selecting this architecture:

| Component | Finding | Compatible? |
|---|---|---|
| Next.js App Router | `src/app/` uses App Router, server components, and API routes | ✅ Vercel |
| Prisma | `prisma/schema.prisma` + migrations; uses `DATABASE_URL` and `DIRECT_URL` | ✅ Neon |
| Redis | `src/lib/redis.ts` uses `IORedis(process.env.REDIS_URL)` with `lazyConnect: true` | ✅ Upstash (TLS URL supported) |
| BullMQ | `src/lib/queue.ts` + `src/workers/index.ts` | ✅ Requires persistent worker (Render) |
| Worker | `Dockerfile.worker` exists and runs `npx tsx src/workers/index.ts` | ✅ Render |
| Dockerfile | `Dockerfile` exists for Next.js standalone output | ✅ Optional self-host / CI |
| Webhooks | Telegram, WhatsApp, Instagram, Email, Voice, Razorpay webhooks implemented | ✅ Need public domain on Vercel |
| Cron | Worker uses BullMQ schedulers for billing/dunning; no Vercel Cron required | ✅ Render |

## Architecture diagram

```text
                          evernaro.com
                               |
                               v
                       +------------------+
                       |      Vercel      |
                       |  Next.js App     |
                       |  (serverless)    |
                       +--------+---------+
                                |
            +-------------------+-------------------+
            |                   |                   |
            v                   v                   v
      +-----------+      +-----------+      +---------------+
      |   Neon    |      |  Upstash  |      |  External APIs |
      | Postgres  |      |   Redis   |      |  Razorpay     |
      |           |      |           |      |  Resend       |
      +-----+-----+      +-----+-----+      |  WhatsApp     |
            |                  |            |  AI           |
            |                  |            +---------------+
            |                  |
            |           +------v-------+
            +---------->|    Render    |
                        |  BullMQ Worker |
                        |  (persistent)  |
                        +----------------+
```

## Platform responsibilities

### Vercel

- Hosts the Next.js web application
- Handles all HTTP traffic: landing pages, dashboard, API routes, webhooks
- Runs serverless functions for API routes
- Serves static pages and prerendered pages
- Does NOT run the BullMQ worker

### Render

- Hosts the persistent Docker worker (`Dockerfile.worker`)
- Consumes BullMQ queues: `campaign-send`, `reminder-send`, `queue-no-show`, `billing-run`
- Runs scheduled jobs via BullMQ schedulers (daily billing, dunning reminders)
- Requires same environment variables as Vercel except platform-only variables

### Neon PostgreSQL

- Stores all application data
- Provides `DATABASE_URL` (pooled connection) for Prisma Client
- Provides `DIRECT_URL` (direct connection) for Prisma Migrate

### Upstash Redis

- Provides the Redis connection for BullMQ
- Provides the Redis connection for the rate limiter
- Must be accessible from both Vercel and Render

## Why not run the worker on Vercel?

Vercel functions are request/response and time-limited. Evernaro's worker is a long-running process that:

- Polls Redis/BullMQ queues indefinitely
- Runs scheduled jobs (daily billing, dunning)
- Maintains worker heartbeat and graceful shutdown

These requirements make a persistent host like Render the correct choice. The existing `Dockerfile.worker` is designed for exactly this.

## Required environment variables by platform

See `.env.example` for the full list and descriptions. Summary:

### Both Vercel and Render

- `DATABASE_URL`
- `DIRECT_URL`
- `REDIS_URL`
- `NEXT_PUBLIC_BASE_URL`
- `AUTH_SECRET`
- `ENCRYPTION_KEY`
- `CAMPAIGN_RATE_PER_SECOND`
- `CAMPAIGN_WORKER_CONCURRENCY`
- `REMINDER_WORKER_CONCURRENCY`
- `NO_SHOW_WORKER_CONCURRENCY`
- `SEAT_LIMIT`
- `DAILY_CAMPAIGN_RECIPIENT_LIMIT`
- `RATE_LIMIT_FAIL_CLOSED`
- `SENTRY_DSN`
- `AI_PROVIDER`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_MODEL`, `ANTHROPIC_MODEL`

### Vercel only

- `PLATFORM_SETUP_TOKEN`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `INBOUND_EMAIL_WEBHOOK_SECRET`
- `RAZORPAY_KEY_ID`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `NEXT_PUBLIC_SENTRY_DSN`
- `META_APP_SECRET`
- `NEXT_PUBLIC_DEMO_BOOKING_URL`
- `AUTH_TRUST_HOST`
- `RUN_MIGRATIONS`
- `CRON_SECRET`

### Render only

- `WORKER_HEALTH_FILE`

### Local only

- `DEMO_PASSWORD`
- `DEMO_PLATFORM_ADMIN_EMAIL`
- `DEMO_PLATFORM_ADMIN_PASSWORD`
- `NEW_ADMIN_PASSWORD`

## Network / security

- Vercel and Render both connect to Neon and Upstash over TLS.
- Webhooks from providers (Razorpay, WhatsApp, Telegram, etc.) hit Vercel public URLs.
- Server secrets (`RAZORPAY_KEY_SECRET`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `DATABASE_URL`, etc.) are never exposed via `NEXT_PUBLIC_*`.
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` is the only Razorpay value exposed to the browser, because Razorpay Checkout requires it client-side.

## Scaling considerations

- Vercel scales horizontally for web traffic.
- Render worker should run as a single instance or a small fixed number; BullMQ handles concurrency internally.
- Neon connection limit should be considered when scaling Vercel; use the pooled `DATABASE_URL`.
- Upstash Redis has connection limits; configure `CAMPAIGN_WORKER_CONCURRENCY` and `REMINDER_WORKER_CONCURRENCY` accordingly.

## Migration process

1. Deploy database migrations before deploying the app:
   ```bash
   npx prisma migrate deploy
   ```
2. Set `RUN_MIGRATIONS=true` only on a single Docker container if using the built-in entrypoint.
3. Do not run migrations from multiple containers simultaneously.

## Alternative providers

If you cannot use the preferred providers:

- **Database:** any managed PostgreSQL 16+ works. Just provide both `DATABASE_URL` (pooled) and `DIRECT_URL` (direct).
- **Redis:** any Redis-compatible managed service works. Upstash is preferred because it supports TLS and works with the existing `IORedis` client.
- **Worker host:** any persistent host that can run Docker containers (Railway, Fly.io, AWS ECS, Google Cloud Run with CPU always on).
- **Domain:** any DNS provider works. Just point the domain to Vercel and configure `NEXT_PUBLIC_BASE_URL`.

## No changes to application code required

This architecture uses the existing:

- `src/workers/index.ts`
- `Dockerfile.worker`
- `Dockerfile`
- `src/lib/redis.ts`
- `prisma/schema.prisma`

No code movement between platforms is required.
