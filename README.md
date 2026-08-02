# EverReach

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
- Sentry — error monitoring (no-ops until `SENTRY_DSN` is set)
- Razorpay — billing (no-ops until `RAZORPAY_KEY_ID`/`RAZORPAY_KEY_SECRET` are set)
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

Redis must be running locally for the worker (`REDIS_URL`, defaults to
`redis://localhost:6379`).

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
npx eslint .     # lint
```

Test coverage is intentionally minimal — pure/security-critical logic only
(encryption round-trip, phone formatting, the WhatsApp template-required
validation, the org-scoping session guard), not full coverage. CI
(`.github/workflows/ci.yml`) runs all three on every push and PR.

## Architecture notes

- **Multi-tenancy**: every row that belongs to a business is scoped by
  `orgId`, re-verified against the database on every request
  (`src/lib/session.ts`) rather than trusted from the session JWT alone.
- **Channel credentials** (bot tokens, API keys) are encrypted at rest
  (AES-256-GCM, `src/lib/crypto.ts`) — a database leak alone doesn't expose
  live third-party credentials.
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

## Deployment

Nothing here is wired up to auto-deploy yet — this is the shape to deploy
into once you're ready:

| Piece | Where | Why |
|---|---|---|
| Next.js app | Vercel | Natural fit for the framework; serverless functions handle the web/API traffic. |
| Worker (`Dockerfile.worker`) | Railway / Render / Fly.io (or similar) | Needs to run continuously — Vercel can't host a long-lived process. The Dockerfile is ready to point any of these at directly. |
| Redis | Upstash, or the worker host's managed Redis | `localhost:6379` only works for local dev. |
| Postgres | Neon (already in use) | Confirm your plan tier includes point-in-time backups before relying on it for real client data. |

Before pointing this at real customers:

1. Generate fresh production values for `AUTH_SECRET` and `ENCRYPTION_KEY`
   (same command as above) — don't reuse the dev-environment ones. Store them
   in the hosting platform's secret manager, never in a committed file.
2. Set a real `FROM_EMAIL` on a domain you own (see `.env`'s comment — the
   current value is Resend's shared sandbox domain, fine for dev, not for
   production) and add the SPF/DKIM/DMARC records Resend gives you.
3. Set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` so failures are actually
   visible once real traffic exists.
4. Update `NEXT_PUBLIC_BASE_URL` to the real production URL before any client
   connects a channel — their webhook URLs are generated from it.
5. Set `RAZORPAY_KEY_ID` / `NEXT_PUBLIC_RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
   if you want invoices to be payable online, and configure a webhook in the
   Razorpay dashboard pointing at `/api/webhooks/razorpay`, subscribed to
   `payment.captured` and `payment.failed`, then set `RAZORPAY_WEBHOOK_SECRET`
   to whatever secret you set there.

## Legal

`src/app/terms` and `src/app/privacy` are working drafts, accurate to what
the product actually does, but not yet reviewed by a lawyer. Don't treat them
as final before onboarding a real paying client.
