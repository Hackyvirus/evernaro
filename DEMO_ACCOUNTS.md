# Demo Accounts

These accounts and records were created for end-to-end testing. All credentials are temporary and should be removed before going live with real customers.

> **Common password for all dashboard accounts:** `DemoPass1234`

## Dashboard Accounts (one per industry/service)

Log in at `/login`.

| # | Industry / Service | Email | Org Slug |
|---|--------------------|-------|----------|
| 1 | Real Estate | `demo-real-estate@evernaro.com` | `demo-real-estate` |
| 2 | Salon / Beauty | `demo-salon@evernaro.com` | `demo-salon` |
| 3 | Clinic | `demo-clinic@evernaro.com` | `demo-clinic` |
| 4 | Dental Clinic | `demo-dental@evernaro.com` | `demo-dental` |
| 5 | Restaurant | `demo-restaurant@evernaro.com` | `demo-restaurant` |
| 6 | Auto / Bike Service Center | `demo-auto-service@evernaro.com` | `demo-auto-service` |
| 7 | Home Services | `demo-home-services@evernaro.com` | `demo-home-services` |
| 8 | Education / Coaching / Training | `demo-education@evernaro.com` | `demo-education` |
| 9 | Law Firm | `demo-legal@evernaro.com` | `demo-legal` |
| 10 | Wellness / Spa | `demo-wellness@evernaro.com` | `demo-wellness` |
| 11 | Other (generic) | `demo-other@evernaro.com` | `demo-other` |

## Platform Admin Account

Log in at `/platform/login`.

| Email | Password |
|-------|----------|
| `admin-demo@evernaro.com` | `DemoAdmin1234` |

> Creating this platform admin means `/platform/setup` will redirect to `/platform/login`. Run the cleanup script (below) if you need to reopen first-time setup.

## Sample Data Per Organization

Each demo org contains:

- A WhatsApp, Telegram, and Email channel (dummy credentials)
- Services from the industry template defaults
- 3 staff profiles
- 6 contacts
- 3 conversations with messages
- 3 appointments
- Queue entries (if the industry supports queues)
- 2 campaigns with recipients
- 2 reminders
- Job cards (if the industry supports job cards)
- Memberships (if the industry supports memberships)
- Reviews (if the industry supports reviews)
- 2 invoices (1 paid, 1 pending)
- Customer events, automations, and audit logs
- A Growth-plan subscription and ₹1,000 WhatsApp wallet balance

## Customize Before Seeding

Set environment variables before running the seed script to change defaults:

```powershell
$env:DEMO_PASSWORD="YourPassword123"
$env:DEMO_PLATFORM_ADMIN_EMAIL="admin@example.com"
$env:DEMO_PLATFORM_ADMIN_PASSWORD="YourAdminPass123"
npx tsx scripts/seed-demo-account.ts
```

## Recreate All Demo Data

```powershell
$env:DOTENV_CONFIG_PATH=".env.local"; npx tsx scripts/seed-demo-account.ts
```

The script deletes existing `demo-*` organizations first, so it is safe to re-run.

## Delete All Demo Data

```powershell
$env:DOTENV_CONFIG_PATH=".env.local"; node scripts/delete-demo-account.mjs --yes
```

This removes:

- All organizations whose slug starts with `demo-` and all their related data
- The demo platform admin account

## Important Notes

- Channel tokens and API keys are placeholders. Do not send real messages/calls with them.
- All dashboard accounts share the same password for convenience.
- Wallet balances and subscriptions are fake demo data.
