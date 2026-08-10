# Evernaro

Evernaro is a multi-tenant omnichannel customer communication SaaS for Indian service businesses. It brings Telegram, Email, WhatsApp, Instagram, and Voice reminders into one team inbox, uses AI to draft replies from a business knowledge base, and automates appointment reminders and queue management.

**Current launch focus:** appointment-based Indian SMBs, starting with **salons and beauty clinics**. The core value proposition is reducing no-shows and saving front-desk time through automated WhatsApp appointment reminders and a unified team inbox.

---

## Architecture

- **Frontend:** Next.js 16 App Router + React 19 + TypeScript 5 + Tailwind CSS v4
- **Backend:** Next.js API routes (deployed as serverless functions on Vercel)
- **Background jobs:** Separate long-running BullMQ worker (`src/workers/index.ts`) for campaigns, scheduled reminders, queue no-show checks, and daily billing runs
- **Database:** PostgreSQL (Prisma ORM, migrations committed in `prisma/migrations/`)
- **Queue / cache:** Redis + BullMQ
- **Auth:** Auth.js v5 (NextAuth) with JWT sessions, bcrypt, TOTP MFA, and backup codes
- **AI drafts:** OpenAI or Anthropic (configurable via `AI_PROVIDER`)
- **Email:** Resend
- **Payments:** Razorpay (subscriptions + wallet top-ups)
- **WhatsApp:** Gupshup API with prepaid wallet and template enforcement
- **Other channels:** Telegram bot, Instagram DMs, Twilio voice calls
- **Error monitoring:** Sentry (optional, no-ops without config)
- **Deployment target:** Vercel for the web app + Render for the persistent worker (preferred)
- **Domain:** `evernaro.com` (configure in DNS + Vercel)

See the deployment documentation for detailed setup:

- `docs/DEPLOYMENT_ARCHITECTURE.md` — architecture and platform decisions
- `docs/DEPLOYMENT.md` — step-by-step deployment instructions

---

## Local setup

```bash
# Clone
git clone <repo-url>
cd evernaro

# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Generate the Prisma client
npm run prisma:generate

# Run the database migrations against your local Postgres
npx prisma migrate deploy

# Start the dev server
npm run dev
```

You also need a local **Postgres** database and **Redis** server. The easiest way is Docker:

```bash
docker-compose up -d postgres redis
```

Then update `DATABASE_URL`, `DIRECT_URL`, and `REDIS_URL` in `.env` to match.

### Required variables for local development

At minimum fill these in `.env` before running the app:

- `DATABASE_URL` — Postgres connection (pooled)
- `DIRECT_URL` — Postgres connection (direct, non-pooled)
- `AUTH_SECRET` — 32-byte base64 session key
- `ENCRYPTION_KEY` — 32-byte base64 credential-encryption key
- `NEXT_PUBLIC_BASE_URL` — `http://localhost:3000` for local dev
- `REDIS_URL` — Redis connection string

The included `.env` file already has secure local values for `AUTH_SECRET`, `ENCRYPTION_KEY`, `PLATFORM_SETUP_TOKEN`, `INBOUND_EMAIL_WEBHOOK_SECRET`, and `CRON_SECRET`. Replace the `REPLACE_WITH_YOUR_VALUE` placeholders for Postgres, Redis, AI, Resend, and Razorpay as needed.

---

## Development

Commands from `package.json`:

| Command | Purpose |
|---|---|
| `npm run dev` | Start Next.js dev server |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Vitest unit tests |
| `npm run typecheck` | Run `tsc --noEmit` |
| `npm run build` | Production Next.js build |
| `npm run start` | Start production server |
| `npm run worker` | Start the BullMQ worker (`npx tsx src/workers/index.ts`) |
| `npm run prisma:generate` | Generate Prisma client |
| `npm run prisma:validate` | Validate Prisma schema |
| `npm run verify-env` | Validate required environment variables |

---

## Database

### Prisma setup

```bash
# Generate the client after schema changes
npm run prisma:generate

# Validate the schema
npm run prisma:validate

# Run migrations (production / CI)
npx prisma migrate deploy

# Open Prisma Studio
npx prisma studio
```

`DATABASE_URL` is the pooled connection used by the app. `DIRECT_URL` is the direct connection used by Prisma for migrations and introspection. Both are required because Prisma Migrate cannot run through a connection pooler.

---

## Redis / BullMQ

Redis is used for:

- **BullMQ job queues:** `campaign-send`, `reminder-send`, `queue-no-show`, `billing-run`
- **Rate limiting:** login, signup, and webhook endpoints

The worker is a separate process that consumes these queues. It is **not** part of the Next.js server.

---

## Worker

Start the worker locally:

```bash
npm run worker
```

In production, run the worker as a persistent container/service. The Dockerfile for the worker is `Dockerfile.worker`. The worker is intentionally separate from the Next.js app because it needs a long-running process and cannot run on Vercel.

The worker uses the same environment variables as the web app (`DATABASE_URL`, `REDIS_URL`, `ENCRYPTION_KEY`, channel provider keys, etc.).

---

## Environment variables

See `.env.example` for the full template. Variables are grouped below.

### Required core application

| Variable | Purpose | Example |
|---|---|---|
| `DATABASE_URL` | Pooled Postgres connection string | `postgresql://...` |
| `DIRECT_URL` | Direct Postgres connection string | `postgresql://...` |
| `AUTH_SECRET` | 32-byte base64 session signing key | generate with `crypto.randomBytes(32).toString('base64')` |
| `ENCRYPTION_KEY` | 32-byte base64 credential-encryption key | generate with `crypto.randomBytes(32).toString('base64')` |
| `NEXT_PUBLIC_BASE_URL` | Public domain for webhooks | `https://evernaro.com` |
| `REDIS_URL` | Redis/BullMQ connection string | `redis://localhost:6379` |
| `PLATFORM_SETUP_TOKEN` | Token to create the first platform admin | 64-character hex |

### Authentication / security

- `AUTH_SECRET`
- `ENCRYPTION_KEY`
- `INBOUND_EMAIL_WEBHOOK_SECRET`
- `CRON_SECRET` (optional)

### AI

- `AI_PROVIDER` — `openai` or `anthropic`
- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`

AI is optional. If no provider is configured, AI draft suggestions are silently skipped.

### Email

- `RESEND_API_KEY` — outbound and transactional email
- `INBOUND_EMAIL_WEBHOOK_SECRET` — inbound email webhook verification

### WhatsApp / Gupshup

Channel credentials are entered through the dashboard and encrypted at rest with `ENCRYPTION_KEY`. The app needs a Gupshup WhatsApp Business API account.

### Razorpay

- `RAZORPAY_KEY_ID` — public key
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` — same public key, exposed to browser for checkout
- `RAZORPAY_KEY_SECRET` — server-side secret, **never expose to browser**
- `RAZORPAY_WEBHOOK_SECRET` — configured in Razorpay dashboard for webhook verification

### Monitoring

- `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`

All optional. Sentry no-ops safely when not configured.

### Optional integrations

- Telegram bot token (configured in dashboard)
- Instagram page access token + `META_APP_SECRET` (configured in dashboard)
- Twilio credentials for voice calls (configured in dashboard)

---

## Deployment

### Vercel (web app)

1. Push this repo to GitHub.
2. Import the project in Vercel.
3. Add all required environment variables in the Vercel dashboard.
4. Set the framework preset to **Next.js**.
5. Deploy.

**Important:** set `NEXT_PUBLIC_BASE_URL` to the production domain before connecting any channel, because all webhook URLs are built from it.

### Worker

Deploy `Dockerfile.worker` to a persistent host. Options:

- Railway
- Render
- Fly.io
- AWS ECS / Google Cloud Run (with CPU always allocated)

The worker needs the same environment variables as the web app.

### Database

Provision a PostgreSQL database (e.g., Neon, Supabase, Railway, AWS RDS). Set both `DATABASE_URL` (pooled) and `DIRECT_URL` (direct).

Run migrations once before the first deploy:

```bash
npx prisma migrate deploy
```

For Docker, set `RUN_MIGRATIONS=true` on a single app container to run migrations at startup. Disable it on replicas.

### Redis

Provision a managed Redis instance (e.g., Upstash, Redis Cloud, Railway Redis). Set `REDIS_URL`.

### Webhooks

Configure each provider to point to the live URLs:

- Telegram: `https://evernaro.com/api/telegram/webhook/<channelId>?secret=<channel-secret>`
- WhatsApp/Gupshup: configured through Gupshup dashboard
- Instagram: `https://evernaro.com/api/instagram/webhook/<channelId>`
- Email inbound: `https://evernaro.com/api/email/inbound`
- Razorpay: `https://evernaro.com/api/webhooks/razorpay`
- Voice/Twilio: `https://evernaro.com/api/voice/twiml/<callLogId>` and status callback

### Domain

Point `evernaro.com` (or your chosen domain) to Vercel and configure DNS. Enable HTTPS.

---

## Preview vs Production

- **Preview deployments:** Vercel creates a preview URL per branch. Do **not** connect live channel webhooks to preview URLs unless you configure them for testing.
- **Production:** only the production domain should receive provider webhooks.

---

## First customer setup (salon pilot)

Minimum steps to onboard a real salon:

1. **Create account** — sign up at `/signup`, select Salon/Beauty.
2. **Verify email** — click the verification link.
3. **Configure salon** — set business name, hours, and public slug in `/settings`.
4. **Add services** — create services (e.g., Haircut, Facial) with duration and price in `/services`.
5. **Configure hours** — set business hours so the system knows when you are open.
6. **Configure WhatsApp** — connect a Gupshup WhatsApp Business API channel in `/channels` and top up the wallet.
7. **Configure reminders** — create a scheduled reminder template for appointments.
8. **Configure AI** — add `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` to enable AI draft replies.
9. **Configure billing** — set Razorpay keys so the salon can subscribe and top up wallet.
10. **Test appointment** — book an appointment for tomorrow.
11. **Test reminder** — confirm the automated WhatsApp reminder is scheduled/sent.
12. **Test inbound reply** — reply to the reminder and verify it appears in `/inbox` with an AI draft.

---

## CI/CD

This repository includes a GitHub Actions workflow at `.github/workflows/ci.yml` that runs on every push and pull request:

- Install dependencies
- Generate Prisma client
- Validate Prisma schema
- Run ESLint
- Run unit tests
- Run TypeScript typecheck
- Run production build
- Build Docker image

It uses CI-safe dummy values for `DATABASE_URL` and `DIRECT_URL` because no live database connection is required for validation.

---

## Security

- `.env` is gitignored. Never commit it.
- Channel credentials are encrypted with AES-256-GCM before being stored in Postgres.
- Sessions are re-verified against the database on every protected request.
- All API routes enforce organization scoping and role-based access.
- `NEXT_PUBLIC_*` variables are exposed to the browser — only put public keys there (e.g., `NEXT_PUBLIC_RAZORPAY_KEY_ID`). Never expose server secrets.

---

## Useful scripts

```bash
# Generate secure secrets
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # AUTH_SECRET / ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"      # PLATFORM_SETUP_TOKEN
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"      # INBOUND_EMAIL_WEBHOOK_SECRET / CRON_SECRET

# Validate env
npm run verify-env

# Seed demo data (development only)
npx tsx scripts/seed-demo-account.ts
```

---

## License

Private — Eversity Tech LLP.
