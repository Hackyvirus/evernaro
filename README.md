# Evernaro

Omnichannel customer messaging for small businesses, built by Eversity Tech LLP.
One inbox for Telegram, Email, WhatsApp, Instagram, and Voice reminders, with
AI-drafted replies a human reviews before sending.

Two apps live in this repo: the **client dashboard** (what a business uses day
to day) and the **platform admin dashboard** (what Eversity uses to manage
every client org).

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- Prisma 6 + PostgreSQL (Neon)
- Auth.js (next-auth v5 beta) — two separate Credentials providers, one for
  org users, one for platform admins
- BullMQ + Redis — background jobs for bulk Campaigns and scheduled Reminders
- Sentry — error monitoring
- Razorpay — billing
- Vitest — unit tests

## Local setup

```bash
npm install
cp .env.example .env   # fill in real values — see below
npx prisma generate
npx prisma migrate dev
npm run dev            # web app at http://localhost:3000
npm run worker          # separate terminal — required for Campaigns/Reminders/Voice to actually send
```

Generate fresh secret values (`AUTH_SECRET`, `ENCRYPTION_KEY`, webhook secret)
instead of inventing them by hand:

```bash
npm run secrets        # prints ready-to-paste values — copy into .env, never commit
```

Redis must be running locally for the worker (`REDIS_URL`, defaults to
`redis://localhost:6379`).

### Demo accounts (local development only)

After running migrations, seed the local database with demo accounts:

```bash
npx prisma db seed   # or: npm run db:seed
```

These accounts are created only when `NODE_ENV` is not `production` and are
**not valid in production**. Rotate or remove them before going live.

| URL | Email | Password |
|---|---|---|---|
| `/login` | `client@demo.com` | `DemoClient1234` |
| `/platform/login` | `admin@demo.com` | `DemoAdmin1234` |

### Required environment variables

See the comments in `.env` for the full list and what each one is for —
database, auth, AI provider, email, encryption key, Redis, and the optional
Sentry/rate-limit knobs. The two that will bite you if wrong:

- `NEXT_PUBLIC_BASE_URL` must match wherever the app is actually reachable —
  every channel's inbound webhook URL is built from it.
- `ENCRYPTION_KEY` must be a 32-byte key, base64-encoded (generate with
  `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`).
  Losing it makes every stored channel credential unrecoverable.

## Testing

```bash
npm test        # vitest, runs once
npx tsc --noEmit # type-check
npm run lint     # lint
npm run build    # production build
```

Test coverage is intentionally minimal — pure/security-critical logic only
(encryption round-trip, phone formatting, the WhatsApp template-required
validation, the org-scoping session guard, wallet math), not full coverage.
CI (`.github/workflows/ci.yml`) runs all four on every push and PR.

## Architecture notes

- **Multi-tenancy**: every row that belongs to a business is scoped by
  `orgId`, re-verified against the database on every request
  (`src/lib/session.ts`) rather than trusted from the session JWT alone.
- **Channel credentials** (bot tokens, API keys) are encrypted at rest
  (AES-256-GCM, `src/lib/crypto.ts`) — a database leak alone doesn't expose
  live third-party credentials.
- **Authentication**: bcrypt password hashing, email verification, password
  reset, and optional TOTP MFA (via Settings > Security). `src/lib/totp.ts`
  handles TOTP secrets and backup codes; `src/lib/auth.ts` enforces MFA at
  login.
- **WhatsApp template compliance**: Meta rejects free-text messages sent more
  than 24 hours after a contact's last inbound message. Campaigns and
  Reminders enforce an approved template in that case
  (`src/lib/whatsapp-template-validation.ts`); inbox replies show a warning
  instead of a hard block, since a human is making that call in real time.
- **Voice is reminder-only** — never wired into bulk Campaigns. India's
  TRAI/DND rules make unsolicited automated calling a real compliance risk;
  Voice only reaches contacts through an individually-scheduled Reminder.
- **The worker (`src/workers/index.ts`) is a separate long-lived process**,
  not part of the Next.js app — it consumes BullMQ jobs for Campaigns and
  Reminders. It needs to run continuously in production, which Vercel's
  serverless functions can't do (see Deployment below).
- **Billing** (`src/lib/razorpay.ts`) uses Razorpay Orders + Checkout for a
  one-time payment per invoice, not the Subscriptions product — Subscriptions
  needs a Plan pre-created in the Razorpay dashboard, which needs a live
  account to set up first. A platform admin generates an invoice (defaulting
  to the org's monthly fee); the org owner pays it from their Billing page.
  The webhook (`/api/webhooks/razorpay`) is the durable source of truth for
  payment status — the client-side confirmation is just for fast UI feedback.
- **Subscription enforcement**: suspended or past-due organizations are blocked
  from sending messages at the single shared chokepoint (`src/lib/send.ts` and
  `src/workers/index.ts`). The billing UI still shows a payment banner and a
  way to settle the invoice.

## Deployment

You deploy **two pieces** in production:

| Piece | Platform | Why |
|---|---|---|
| Next.js app | Vercel | Handles web traffic, API routes, and static pages. |
| Worker | Render / Railway / Fly.io | Runs the BullMQ job queue continuously. Vercel cannot run long-lived processes. |
| Database | Neon | Postgres (already configured). |
| Redis | Upstash (or any managed Redis 6.2+) | Required for BullMQ. Local Redis is only for development. |

### High-level flow

1. Buy/own a domain (`evernaro.com`).
2. Create a Neon Postgres database.
3. Create an Upstash Redis database.
4. Create a Vercel project and connect the GitHub repo.
5. Add all environment variables in Vercel.
6. Deploy the Vercel app.
7. Create a Render/Railway service for the worker using `Dockerfile.worker`.
8. Add the same environment variables to the worker service.
9. Connect your domain to Vercel.
10. Configure third-party services (Razorpay, Resend, WhatsApp provider, etc.).

You do **not** need to install Docker locally. Render/Railway/Fly.io build the Docker image for you from `Dockerfile.worker`.

### Step 1: Generate production secrets

Run this locally:

```bash
npm run secrets
```

It prints three values. Copy them somewhere safe (a password manager, not a chat). You will need them in Vercel and the worker service:

- `AUTH_SECRET`
- `ENCRYPTION_KEY`
- `INBOUND_EMAIL_WEBHOOK_SECRET`

**Never commit these.**

### Step 2: Neon Postgres

1. Create a project at [neon.tech](https://neon.tech).
2. Create a database.
3. Copy the **pooled** connection string for `DATABASE_URL`.
4. Copy the **direct** connection string for `DIRECT_URL`.

Both strings look like:

```text
postgresql://neondb_owner:PASSWORD@HOST-pooler.region.aws.neon.tech/evernaro?sslmode=require
postgresql://neondb_owner:PASSWORD@HOST.region.aws.neon.tech/evernaro?sslmode=require
```

### Step 3: Upstash Redis

1. Create an account at [upstash.com](https://upstash.com).
2. Create a Redis database.
3. Choose **Redis 6.2 or higher** (BullMQ requires this).
4. Copy the **Redis URL** (it looks like `rediss://default:TOKEN@HOST:6379`).
5. Paste it into `REDIS_URL`.

### Step 4: Vercel — Next.js app

1. Go to [vercel.com](https://vercel.com) and import the GitHub repo `Hackyvirus/evernaro`.
2. Framework preset: **Next.js**.
3. Add the environment variables listed in the table below.
4. Click **Deploy**.

Vercel will build the project on every push to `main`.

### Step 5: Environment variables for production

Add these to **Vercel** → Project → Settings → Environment Variables.

| Variable | Example value / where to get it |
|---|---|
| `DATABASE_URL` | Neon pooled connection string |
| `DIRECT_URL` | Neon direct connection string |
| `AUTH_SECRET` | From `npm run secrets` |
| `ENCRYPTION_KEY` | From `npm run secrets` |
| `NEXT_PUBLIC_BASE_URL` | `https://evernaro.com` |
| `REDIS_URL` | Upstash Redis URL |
| `FROM_EMAIL` | `hello@evernaro.com` (after verifying domain in Resend) |
| `RESEND_API_KEY` | Resend API key |
| `INBOUND_EMAIL_WEBHOOK_SECRET` | From `npm run secrets` |
| `AI_PROVIDER` | `openai` or `anthropic` |
| `OPENAI_API_KEY` | OpenAI API key (optional) |
| `ANTHROPIC_API_KEY` | Anthropic API key (optional) |
| `SENTRY_DSN` | Sentry project DSN |
| `NEXT_PUBLIC_SENTRY_DSN` | Same as `SENTRY_DSN` |
| `SENTRY_ORG` | Sentry organization slug |
| `SENTRY_PROJECT` | Sentry project slug |
| `SENTRY_AUTH_TOKEN` | Sentry auth token (for source maps) |
| `RAZORPAY_KEY_ID` | Razorpay key ID |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Same as `RAZORPAY_KEY_ID` |
| `RAZORPAY_KEY_SECRET` | Razorpay key secret |
| `RAZORPAY_WEBHOOK_SECRET` | Razorpay webhook secret |
| `CAMPAIGN_RATE_PER_SECOND` | `5` |
| `CAMPAIGN_WORKER_CONCURRENCY` | `5` |
| `REMINDER_WORKER_CONCURRENCY` | `10` |
| `SEAT_LIMIT` | `5` |
| `DAILY_CAMPAIGN_RECIPIENT_LIMIT` | `2000` |
| `RUN_MIGRATIONS` | `false` (set `true` only for the first deploy, then set back) |

### Step 6: Run the first database migration

After the first deploy, you must run Prisma migrations against the Neon database.

**Option A — one-off Vercel command:**

In Vercel, run a one-off command:

```bash
npx prisma migrate deploy
```

**Option B — from your local machine:**

Set `DATABASE_URL` and `DIRECT_URL` to your Neon production strings, then run:

```bash
npx prisma migrate deploy
```

After the first migration, set `RUN_MIGRATIONS=false` in Vercel.

### Step 7: Render / Railway — worker

The worker is a **Docker container**. You do not need to know Docker; the platform builds it for you.

#### Render

1. Go to [render.com](https://render.com) and create a **Web Service**.
2. Connect the GitHub repo `Hackyvirus/evernaro`.
3. Select **Docker** as the runtime.
4. Set the **Dockerfile Path** to `Dockerfile.worker`.
5. Set the same environment variables as Vercel (except `NEXT_PUBLIC_*` variables are not needed for the worker, but they will not hurt).
6. Choose a **Basic** plan or higher. The worker must run 24/7.
7. Deploy.

#### Railway

1. Go to [railway.app](https://railway.app) and create a new project.
2. Choose **Deploy from GitHub repo** and select `Hackyvirus/evernaro`.
3. Add a service.
4. In the service settings, set the **Dockerfile** to `Dockerfile.worker`.
5. Add the environment variables.
6. Deploy.

### Step 8: Connect your GoDaddy domain to Vercel

You already own `evernaro.com` on GoDaddy.

1. In Vercel, go to your project → **Settings** → **Domains**.
2. Add `evernaro.com` and `www.evernaro.com`.
3. Vercel will show you DNS records to add. They usually look like this:

| Type | Name | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

> The exact IP and CNAME value may differ. Use whatever Vercel shows you.

4. Go to [godaddy.com](https://godaddy.com) → **My Products** → **DNS** for `evernaro.com`.
5. Delete any existing A, CNAME, or AAAA records for `@` and `www`.
6. Add the records from Vercel.
7. Save.
8. Wait 5–30 minutes for DNS to propagate.
9. In Vercel, click **Verify**.

Once verified, Vercel will issue an SSL certificate automatically.

### Step 9: Configure email (Resend)

1. Add `evernaro.com` as a domain in Resend.
2. Resend will give you DNS records (SPF, DKIM, DMARC).
3. Add those records in GoDaddy DNS.
4. After verification, set `FROM_EMAIL=hello@evernaro.com` in Vercel.

### Step 10: Configure Razorpay

1. In Razorpay dashboard, set the webhook URL:

```text
https://evernaro.com/api/webhooks/razorpay
```

2. Subscribe to events: `payment.captured`, `payment.failed`.
3. Set a webhook secret and paste it into `RAZORPAY_WEBHOOK_SECRET` in Vercel and the worker.

### Step 11: Configure WhatsApp / other channels

When you connect a channel in the app, it will ask for the webhook URL. The app builds it automatically from `NEXT_PUBLIC_BASE_URL`. As long as `NEXT_PUBLIC_BASE_URL=https://evernaro.com`, the webhook URLs will be correct.

For WhatsApp, verify inbound webhooks reach:

```text
https://evernaro.com/api/whatsapp/webhook/[channelId]
```

## Troubleshooting

### `output: "standalone"` breaks Vercel builds

`next.config.ts` uses `output: "standalone"` only when `DOCKER_BUILD=true`. Vercel builds use the default Next.js output. If you see an error about `.next/next-server.js.nft.json`, make sure `DOCKER_BUILD` is not set in Vercel.

### Docker build fails with Redis or database errors during static generation

This project uses lazy initialization for external connections:

- `src/lib/queue.ts` creates BullMQ queues only when a job is scheduled.
- Pages that read sessions or query the database export `dynamic = "force-dynamic"` so they are never statically generated at build time.

If you add a new page that uses `auth()`, `prisma`, `queue`, or `redisConnection`, either:
- mark it with `export const dynamic = "force-dynamic"`, or
- make sure it does not access external services during the build step.

### CI now builds Docker images on every push

`.github/workflows/ci.yml` runs both the Next.js build and a Docker build for `Dockerfile` and `Dockerfile.worker`. This catches Docker-only build failures before they reach production.

## Production launch checklist

1. **Make the repo private** if it contains real secrets in commit history.
2. Generate fresh `AUTH_SECRET` and `ENCRYPTION_KEY` (`npm run secrets`). Store them in Vercel and the worker service.
3. Set a real `FROM_EMAIL` on `evernaro.com` and verify it in Resend.
4. Set `NEXT_PUBLIC_BASE_URL=https://evernaro.com` before connecting any channel.
5. Set all Razorpay keys and webhook.
6. Run a small test payment and confirm the invoice becomes `PAID`.
7. Verify the worker is running and connected to Redis.
8. Replace placeholder testimonials in `src/app/page.tsx` with real quotes before marketing.
9. Have the `Terms` and `Privacy` pages reviewed by a lawyer.
10. Run a live WhatsApp send and verify inbound webhooks reach the production endpoint.
11. Rotate the platform admin password and remove the seeded demo accounts.

Run `npm run secrets` to print ready-to-paste values for `AUTH_SECRET`,
`ENCRYPTION_KEY`, and the webhook secret. After filling in `.env`, run
`npm run verify-env` to check that all required variables are present and
well-formed before deploying.

## Legal

`src/app/terms` and `src/app/privacy` are production-ready drafts, accurate to
what the product actually does. They still need review by a lawyer familiar with
Indian IT and contract law (and any market you sell into) before you rely
on them as final legal documents.
