# Demo Accounts

These accounts and records were created for end-to-end testing. All credentials are temporary and should be removed before going live with real customers.

## Organization

- **Name:** Demo Salon
- **Slug:** `demo-evernaro`
- **Industry:** Salon / Beauty
- **Status:** Active

## Dashboard Accounts (client/org login)

Log in at `/login`.

| Email | Password | Role |
|-------|----------|------|
| `demo@evernaro.com` | `DemoPass1234` | Owner |
| `demo-admin@evernaro.com` | `DemoPass1234` | Admin |
| `demo-agent@evernaro.com` | `DemoPass1234` | Agent |
| `demo-viewer@evernaro.com` | `DemoPass1234` | Viewer |

## Platform Admin Account

Log in at `/platform/login`.

| Email | Password |
|-------|----------|
| `admin-demo@evernaro.com` | `DemoAdmin1234` |

> Creating this platform admin means `/platform/setup` will redirect to `/platform/login`. Delete the platform admin (see below) if you need to re-run first-time setup.

## Sample Data Seeded

- 5 channels (WhatsApp, Telegram, Email, Instagram, Voice) with dummy credentials
- 5 services and 3 staff profiles
- 12 contacts
- 6 conversations with messages
- 6 appointments
- 4 queue entries
- 2 campaigns with recipients
- 4 reminders
- 2 job cards
- 2 memberships
- 3 reviews
- 2 invoices (1 paid, 1 pending)
- Customer events, automations, audit logs, and a wallet balance of ₹1,000

## Customize Before Seeding

Set environment variables before running the seed script to change defaults:

```powershell
$env:DEMO_OWNER_EMAIL="you@example.com"
$env:DEMO_PASSWORD="YourPassword123"
$env:DEMO_PLATFORM_ADMIN_EMAIL="admin@example.com"
$env:DEMO_PLATFORM_ADMIN_PASSWORD="YourAdminPass123"
$env:DEMO_ORG_SLUG="your-demo-slug"
$env:DEMO_INDUSTRY="REAL_ESTATE"   # SALON, CLINIC, RESTAURANT, etc.
npx tsx scripts/seed-demo-account.ts
```

## Recreate Demo Data

```powershell
$env:DOTENV_CONFIG_PATH=".env.local"; npx tsx scripts/seed-demo-account.ts
```

The script deletes the existing demo org first, so it is safe to re-run.

## Delete All Demo Data

```powershell
$env:DOTENV_CONFIG_PATH=".env.local"; node scripts/delete-demo-account.mjs --yes
```

This removes:

- The demo organization and all related data (contacts, conversations, appointments, invoices, campaigns, etc.)
- The demo platform admin account

## Important Notes

- Channel tokens and API keys are placeholders. Do not send real messages/calls with them.
- The demo subscription is attached to the **Growth** plan for billing-page testing.
- Wallet balance is fake demo credit.
