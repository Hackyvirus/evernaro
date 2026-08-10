# Evernaro Deployment Guide

This guide covers deploying Evernaro to:

- Vercel (Next.js web app)
- Render (background worker)
- Neon PostgreSQL (database)
- Upstash Redis (queue + cache)
- Razorpay, Resend, Gupshup, and AI providers

For architecture decisions, see `docs/DEPLOYMENT_ARCHITECTURE.md`.

---

## Prerequisites

- GitHub repository with this code
- Accounts at: Vercel, Render, Neon, Upstash, Razorpay, Resend, Gupshup, OpenAI/Anthropic
- Domain: `evernaro.com` (or your chosen domain)

---

## Step 1 — Neon PostgreSQL

1. Create a new project in [Neon](https://neon.tech/).
2. Create a database.
3. Copy the connection strings:
   - **Pooled connection** → use for `DATABASE_URL`
   - **Direct connection** → use for `DIRECT_URL`
4. Add these to your local `.env` and later to Vercel + Render.

### Run migrations

From your local machine (or a CI step with `DIRECT_URL`):

```bash
npm install
npm run prisma:generate
npx prisma migrate deploy
```

For production, you can also set `RUN_MIGRATIONS=true` on a single Docker container. Do not enable this on multiple replicas.

---

## Step 2 — Upstash Redis

1. Create a new Redis database in [Upstash](https://upstash.com/).
2. Copy the **Redis URL** (e.g., `rediss://default:...`).
3. Use this for `REDIS_URL` in Vercel and Render.

Upstash Redis works with the existing `src/lib/redis.ts` implementation without changes.

---

## Step 3 — Vercel

### 3.1 Create project

1. Log in to [Vercel](https://vercel.com/).
2. Click **Add New Project** → import your GitHub repo.
3. Framework preset: **Next.js**.
4. Set root directory to `/` (default).
5. Click **Deploy**.

### 3.2 Environment variables

In Project Settings → Environment Variables, add all variables marked `[VERCEL]` or `[BOTH]` in `.env.example`:

Required:

- `DATABASE_URL`
- `DIRECT_URL`
- `REDIS_URL`
- `NEXT_PUBLIC_BASE_URL` → `https://evernaro.com`
- `AUTH_SECRET`
- `ENCRYPTION_KEY`
- `PLATFORM_SETUP_TOKEN`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `INBOUND_EMAIL_WEBHOOK_SECRET`
- `RAZORPAY_KEY_ID`
- `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`
- `AI_PROVIDER`
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`

Optional:

- `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`
- `META_APP_SECRET`
- `NEXT_PUBLIC_DEMO_BOOKING_URL`
- `CRON_SECRET`

Tuning (optional):

- `SEAT_LIMIT`, `DAILY_CAMPAIGN_RECIPIENT_LIMIT`, `CAMPAIGN_RATE_PER_SECOND`, etc.

### 3.3 Build settings

- Build Command: `npm run build`
- Output Directory: default (`.next`)
- Install Command: `npm install`
- Root Directory: `/`

### 3.4 Production domain

1. In Vercel Project Settings → Domains, add `evernaro.com`.
2. Update your DNS provider with the records Vercel provides.
3. Wait for DNS propagation.
4. Update `NEXT_PUBLIC_BASE_URL` to `https://evernaro.com` in all environments.

### 3.5 Verify deployment

- Visit `https://evernaro.com/api/health` → should return success.
- Visit `https://evernaro.com` → landing page should load.
- Sign up at `/signup` → verify the email verification flow works.

---

## Step 4 — Render Worker

### 4.1 Create a background worker

1. In [Render](https://render.com/), create a new **Background Worker**.
2. Connect your GitHub repository.
3. Set the branch to `main`.

### 4.2 Dockerfile

Use the existing Dockerfile:

- **Dockerfile Path:** `Dockerfile.worker`

### 4.3 Start command

The Dockerfile already defines the start command:

```bash
dumb-init npx tsx src/workers/index.ts
```

No custom start command is needed.

### 4.4 Environment variables

Add all variables marked `[RENDER]` or `[BOTH]` in `.env.example`:

- `DATABASE_URL`
- `DIRECT_URL`
- `REDIS_URL`
- `NEXT_PUBLIC_BASE_URL` → `https://evernaro.com`
- `AUTH_SECRET`
- `ENCRYPTION_KEY`
- `WORKER_HEALTH_FILE` → `/tmp/worker.health`
- Channel provider keys (if workers send messages): `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `RESEND_API_KEY`, `AI_PROVIDER`, `OPENAI_API_KEY`/`ANTHROPIC_API_KEY`, etc.
- Optional tuning: `CAMPAIGN_RATE_PER_SECOND`, `CAMPAIGN_WORKER_CONCURRENCY`, `REMINDER_WORKER_CONCURRENCY`, `NO_SHOW_WORKER_CONCURRENCY`, `SEAT_LIMIT`, `DAILY_CAMPAIGN_RECIPIENT_LIMIT`

### 4.5 Verify worker

- Check Render logs for `Worker started` and queue processing.
- Trigger a test appointment reminder and confirm it is sent.

---

## Step 5 — Razorpay

1. Create a Razorpay account and switch to Test mode.
2. Copy **Key ID** and **Key Secret**.
3. Set `RAZORPAY_KEY_ID` and `NEXT_PUBLIC_RAZORPAY_KEY_ID` (same value) in Vercel.
4. Set `RAZORPAY_KEY_SECRET` in Vercel and Render.
5. In Razorpay dashboard → Webhooks, add:
   - URL: `https://evernaro.com/api/webhooks/razorpay`
   - Events: `payment.captured`, `payment.failed`, `subscription.payment.failed`, `subscription.halted`, `subscription.cancelled`, `subscription.activated`, `subscription.charged`
   - Secret: set `RAZORPAY_WEBHOOK_SECRET` to this value.

For production, repeat with live Razorpay keys.

---

## Step 6 — Resend

1. Create a [Resend](https://resend.com/) account.
2. Add and verify your domain (e.g., `evernaro.com`).
3. Copy the API key.
4. Set `RESEND_API_KEY` in Vercel.
5. Set `EMAIL_FROM` to a verified sender (e.g., `Evernaro <noreply@evernaro.com>`).
6. (Optional) Configure inbound email webhook to `https://evernaro.com/api/email/inbound` with `INBOUND_EMAIL_WEBHOOK_SECRET`.

---

## Step 7 — WhatsApp / Gupshup

1. Create a Gupshup WhatsApp Business API account.
2. Obtain API key, source number, and app name.
3. In Evernaro dashboard → Channels → WhatsApp, enter the credentials.
4. Configure Gupshup to send inbound webhooks to:
   - `https://evernaro.com/api/whatsapp/webhook/<channelId>?secret=<channel-secret>`
   - The secret is derived from `AUTH_SECRET`, so set `AUTH_SECRET` before connecting the channel.
5. Create WhatsApp templates in the dashboard and wait for approval.
6. Top up the prepaid wallet before sending campaigns or reminders.

---

## Step 8 — AI Provider

1. Choose OpenAI or Anthropic.
2. Set `AI_PROVIDER` to `openai` or `anthropic`.
3. Set the corresponding API key (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`).
4. Optional: set `OPENAI_MODEL` or `ANTHROPIC_MODEL`.

AI is optional. If no provider is configured, the AI draft feature is disabled.

---

## Step 9 — Sentry (optional)

1. Create a Sentry project.
2. Copy the DSN.
3. Set `SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (browser) in Vercel.
4. Set `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN` for source-map upload at build time.

---

## Step 10 — Platform Admin Setup

1. Visit `https://evernaro.com/platform/setup`.
2. Enter the `PLATFORM_SETUP_TOKEN` value.
3. Create the first platform admin account.
4. Use `/platform` to manage organizations, billing, rate cards, and audit logs.

---

## Preview vs Production

- Vercel creates preview URLs for each pull request.
- Do **not** connect live channel webhooks (Razorpay, WhatsApp, etc.) to preview URLs.
- Use preview URLs only for manual UI testing.
- All production webhooks must point to `https://evernaro.com`.

---

## First Customer Setup (Salon Pilot)

After deployment, onboard the first salon:

1. **Sign up** at `/signup` → select Salon/Beauty.
2. **Verify email** and log in.
3. **Configure business** in `/settings`.
4. **Add services** in `/services`.
5. **Set business hours** so reminders are scheduled correctly.
6. **Connect WhatsApp** in `/channels` using Gupshup credentials.
7. **Add Razorpay** for billing and wallet top-ups.
8. **Configure AI** by adding an OpenAI or Anthropic key.
9. **Book a test appointment** in `/appointments`.
10. **Verify reminder** is sent via the worker.
11. **Reply to the reminder** and confirm it appears in `/inbox` with an AI draft.

---

## Troubleshooting

### Webhooks not reaching Vercel

- Verify `NEXT_PUBLIC_BASE_URL` matches the actual domain.
- Check provider webhook configuration URL.
- Check Vercel function logs.

### Worker not processing jobs

- Verify `REDIS_URL` is correct and reachable from Render.
- Verify worker logs show it started successfully.
- Check that `DATABASE_URL` is correct.

### Emails not sending

- Verify `RESEND_API_KEY` and `EMAIL_FROM`.
- Verify Resend domain is verified.

### Razorpay payments failing

- Verify `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`.
- Verify webhook secret matches Razorpay dashboard.
- Use Razorpay Test mode for initial verification.

---

## Security reminders

- Never commit `.env`.
- Never expose server secrets in `NEXT_PUBLIC_*` variables.
- Rotate `AUTH_SECRET` and `ENCRYPTION_KEY` only if you are prepared to reconnect all channels and invalidate all sessions.
- Keep `PLATFORM_SETUP_TOKEN` secret.
