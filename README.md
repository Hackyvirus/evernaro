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

Generate fresh secret values (AUTH_SECRET, ENCRYPTION_KEY, webhook secret)
instead of inventing them by hand:

```bash
npm run secrets        # prints ready-to-paste values — copy into .env, never commit
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

## Test logins (local development only)

These accounts are seeded in the dev database only. They are **not valid in
production**, and they must not be used once real customer data exists.

| | URL | Email | Password |
|---|---|---|---|
| Client dashboard (org: Design Test Co) | `/login` | `uitest@example.com` | `TestPass1234` |
| Platform admin | `/platform/login` | `sushant@eversitytech.com` | `TestAdmin1234` |

**Before going live:** rotate the platform admin password, remove or disable
these seeded accounts, and make the repository private.

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

Continuous deployment is configured via GitHub Actions:

- `.github/workflows/ci.yml` — runs type-check, lint, tests, and build on every
  push and PR.
- `.github/workflows/deploy.yml` — deploys the Next.js app to Vercel and builds
  a Docker image for the worker. Set the repository secrets listed in the
  workflow files before enabling this.

| Piece | Where | Why |
|---|---|---|
| Next.js app | Vercel | Natural fit for the framework; serverless functions handle the web/API traffic. |
| Worker (`Dockerfile.worker`) | Railway / Render / Fly.io (or similar) | Needs to run continuously — Vercel can't host a long-lived process. The Dockerfile is ready to point any of these at directly. |
| Redis | Upstash, or the worker host's managed Redis | `localhost:6379` only works for local dev. |
| Postgres | Neon (already in use) | Confirm your plan tier includes point-in-time backups before relying on it for real client data. |

### Production launch checklist

1. **Make the repo private** and remove the dev test credentials from this README.
2. Generate fresh production values for `AUTH_SECRET` and `ENCRYPTION_KEY`
   (`npm run secrets`). Store them in the platform secret manager, never in a
   committed file. `ENCRYPTION_KEY` is the critical one: losing it makes every
   stored channel credential unrecoverable.
3. Set a real `FROM_EMAIL` on a domain you own (Resend's shared sandbox domain
   is fine for dev, not for production) and add the SPF/DKIM/DMARC records
   Resend gives you.
4. Set `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` so failures are visible once real
   traffic exists.
5. Update `NEXT_PUBLIC_BASE_URL` to the real production URL before any client
   connects a channel — their webhook URLs are generated from it.
6. Set `RAZORPAY_KEY_ID` / `NEXT_PUBLIC_RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
   for online invoices, and configure a Razorpay webhook at
   `/api/webhooks/razorpay` subscribed to `payment.captured` and `payment.failed`.
   Set `RAZORPAY_WEBHOOK_SECRET` to the same secret.
7. Exercise the paid flow with a real (small) payment before onboarding a
   customer — confirm the Razorpay webhook flips an invoice to PAID and the
   wallet top-up credits.
8. Replace the placeholder testimonials on the landing page
   (`src/app/page.tsx`) with real customer quotes before running public marketing.
9. Have the `Terms` and `Privacy` pages reviewed by a lawyer familiar with Indian
   IT and contract law.
10. Run a live WhatsApp send and template sync with Gupshup, and verify inbound
    webhooks reach the production `/api/whatsapp/webhook/[channelId]` endpoint.
11. Rotate the platform admin password and remove the seeded dev accounts.

Run `npm run secrets` to print ready-to-paste values for `AUTH_SECRET`,
`ENCRYPTION_KEY`, and the webhook secret. After filling in `.env`, run
`npm run verify-env` to check that all required variables are present and
well-formed before deploying.

## Legal

`src/app/terms` and `src/app/privacy` are production-ready drafts, accurate to
what the product actually does. They still need review by a lawyer familiar
with Indian IT and contract law (and any market you sell into) before you rely
on them as final legal documents.
