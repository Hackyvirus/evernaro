# Evernaro — Current State Audit

**Date:** 2026-08-08  
**Repository:** `D:\Eversity\everreach`  
**Branch:** `main`

---

## Executive Summary

Evernaro is a multi-tenant Next.js 16 SaaS with an omnichannel inbox, customer/appointment/queue/job-card management, billing, and 11 industry templates. Industry support is currently a labeling/seeding/navigation layer on top of generic modules. The highest-value gap is the lack of a real-time customer flow experience: no public queue join, no customer self-service portal, no QR check-in, and no WebSockets/SSE.

---

## 1. Current Architecture

Evernaro is a multi-tenant SaaS built on:

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.3.0 (App Router, React 19, TypeScript 5) |
| Styling | Tailwind CSS v4 with CSS-variable design tokens |
| ORM / DB | Prisma 6.19.3 + PostgreSQL |
| Auth | Next-Auth v5 beta, JWT sessions, bcrypt, TOTP MFA |
| Background jobs | BullMQ + Redis |
| Email | Resend |
| Payments | Razorpay |
| Monitoring | Sentry |
| AI | OpenAI + Anthropic SDKs |

### Deployment

- `next.config.ts` uses standalone output only when `DOCKER_BUILD=true`; default output for Vercel.
- Docker multi-stage build for app + separate worker container.
- No `middleware.ts`; auth enforced via server-component layouts and API helpers.

### Repo structure

```
src/app/           → pages & API routes
src/components/    → reusable UI + landing components
src/lib/           → utilities, services, engines, auth, billing, AI
src/workers/       → BullMQ worker process
prisma/            → schema + migrations + seeds
scripts/           → one-off scripts
```

## 2. Existing Modules

### Auth & authorization

- Org-user auth at `/login` with roles `OWNER`, `ADMIN`, `AGENT`, `VIEWER` and optional TOTP MFA.
- Platform-admin auth at `/platform/login` with separate credential space.
- Session helpers re-verify JWT claims against DB on every call.

### Org dashboard modules (`src/app/(dashboard)`)

All implemented: Dashboard, Inbox, Contacts, Channels, Campaigns, Reminders, Appointments, Queue, Services, Staff, Resources, Job cards, Memberships, Reviews, Billing, Analytics, Knowledge, Settings, Team.

### Platform admin modules (`src/app/(platform-protected)/platform`)

Client list, create/edit clients, billing catalog, WhatsApp rate cards, platform analytics, audit logs.

### Public customer-facing modules

- `/business/[slug]/book` — public appointment booking.
- `/business/[slug]/review` — tokenized review submission.

## 3. Existing Database Models

### Core tenant models

`Organization`, `User`, `PlatformAdmin`, `Channel`, `Contact`, `Conversation`, `Message`.

### Operational models

`Service`, `StaffProfile`, `ServiceStaff`, `Resource`, `Appointment`, `Queue`, `QueueEntry`, `JobCard`, `Membership`, `Review`, `CustomerEvent`, `Automation`, `AutomationExecution`, `NotificationPreference`, `BusinessProfile`, `IndustryTemplate`, `OrganizationIndustryConfig`.

### Billing models

`SubscriptionPlan`, `PlanFeature`, `PlanLimit`, `AddOn`, `PlanAddOn`, `BillableService`, `ServicePricingRule`, `CustomerSubscription`, `SubscriptionItem`, `UsageRecord`, `UsageAggregate`, `Invoice`, `InvoiceItem`, `Payment`, `Coupon`, `CouponRedemption`, `TaxConfiguration`, `BillingEvent`, `WhatsAppWallet`, `WalletTransaction`, `WhatsAppRateCard`.

### Logs

`AuditLog`, `EmailLog`.

### Tenant isolation

- Every org-scoped model has `orgId` FK with `onDelete: Cascade`.
- Enforced in API routes/server components; no Postgres RLS.

## 4. Existing APIs

- **Auth:** `/api/auth/[...nextauth]`, `/api/signup`, `/api/auth/*`
- **Org data:** `/api/users/*`, `/api/staff`, `/api/organization`, `/api/contacts/*`, `/api/conversations/*`, `/api/channels/*`
- **Messaging:** `/api/campaigns/*`, `/api/reminders/*`, `/api/whatsapp-templates/*`, inbound webhooks
- **Operations:** `/api/appointments/*`, `/api/queue/*`, `/api/services`, `/api/resources/*`, `/api/memberships/*`, `/api/reviews`, `/api/jobs/*`
- **Billing:** `/api/billing/*`, `/api/wallet/*`, `/api/invoices/*`, `/api/webhooks/razorpay`
- **Platform admin:** `/api/platform/organizations/*`, `/api/platform/billing/*`, `/api/platform/rate-cards`, `/api/platform/analytics`, `/api/platform/audit-logs`
- **Public:** `/api/public/[slug]/services`, `/api/public/[slug]/book`, `/api/public/[slug]/review`

## 5. Existing Dashboards

### Org dashboard

KPI cards, attention items, recent conversations, reminders, campaigns, channel health. Sidebar built from industry-template nav keys.

### Platform admin dashboard

Client org list with MRR/channels/contacts/conversations, client detail, billing catalog, WhatsApp rate cards, fleet analytics, audit logs.

## 6. Existing Industry Implementations

### Industry templates

`src/lib/industry-templates.ts` defines 11 presets: Real Estate, Salon, Clinic, Dental, Restaurant, Auto Service, Home Services, Education, Legal, Wellness, Other.

Each provides terminology, feature flags, workflow statuses, dashboard nav, overview cards, default services, default automations.

### Wiring

- Signup copies selected template into `Organization.industryTemplateId` and `OrganizationIndustryConfig`.
- `industry-config.ts` merges template defaults with org overrides.
- `dashboard-nav.ts` maps nav keys to real routes.
- `vertical-presets.ts` provides starter content; only Real Estate is populated today.

### Reality check

Industry support is primarily a labeling/seeding/navigation layer. Underlying CRUD modules are generic. Vehicles, tables, courses, batches, matters, deals map to generic resources/jobs/contacts.

## 7. Existing Queue Functionality

### Model

`Queue`, `QueueEntry`, `QueueEntryStatus` (WAITING, CALLED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW).

### APIs

`GET /api/queue`, `POST /api/queue`, `PUT /api/queue`, `POST /api/queue/[id]/call-next`, `PATCH /api/queue/entries/[id]/status`.

### Service logic

`src/lib/services/queue-service.ts`: token generation, position normalization, status timestamps.

### Real-time

- Polling only every 7 seconds on queue page.
- Status-change detection + audible beep.
- No WebSockets, SSE, or Redis pub/sub.

## 8. Existing Appointment Functionality

### Model

`Appointment` with contact/service/staff/resource, startsAt/endsAt, status, notes, deposit.
`AppointmentStatus`: BOOKED, CONFIRMED, ARRIVED, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW.

### APIs

`GET /api/appointments`, `POST /api/appointments`, `PATCH /api/appointments/[id]/status`.

### Service logic

`appointment-service.ts`: CRUD + availability check. `appointment-reminders.ts`: auto-schedules 24h/2h reminders. `review-requests.ts`: signs review links with HMAC.

## 9. Existing Notification Functionality

### Channels supported

Email (Resend), Telegram, WhatsApp (Gupshup), Instagram (Meta), Voice (Twilio, reminders only).

### Send chokepoint

`src/lib/send.ts` enforces active subscription, debits WhatsApp wallet, validates template requirements.

### Background sending

BullMQ queues `campaign-send` and `reminder-send`; standalone worker at `src/workers/index.ts`.

### Gaps

- `NotificationPreference` is stored but not consumed by send path.
- No SMS provider.
- No push notifications.

## 10. Existing Payment Functionality

- Razorpay integration: order/subscription/webhook signature verification.
- Razorpay webhook at `/api/webhooks/razorpay`.
- WhatsApp wallet with idempotent ledger.
- SaaS billing: subscriptions, usage, invoices, coupons.
- Plans: Free, Starter ₹499, Growth ₹1,499, Business ₹3,999, Enterprise custom.

## 11. Existing Customer-Facing Functionality

- Public booking page creates/updates contact by phone and books appointment.
- Public review page accepts tokenized reviews.
- No public queue join, no customer self-service portal, no public status tracking page.

## 12. Reusable Components

`src/components/ui` exports: Button, Card, Logo, Input/Textarea/Select, Badge, Tabs, Table primitives, Avatar, Toast, ThemeToggle, Spinner, Skeleton, PageHeader, NavItem, Breadcrumbs, EmptyState, IconButton, StatCard.

Landing components: `Reveal`, `Faq`, `ProductMockup`.

## 13. Duplicate Implementations

1. Dashboard shell and platform shell both implement collapsible sidebar + mobile drawer separately.
2. Many API routes repeat identical `try/catch` blocks for `UnauthorizedError` / generic 500.
3. Contact identifier fallback logic is centralized in `channel-reachability.ts` but some pages may still inline checks.

## 14. Technical Debt

1. No middleware defense-in-depth for auth.
2. Large JSON config columns (`BusinessProfile`, `IndustryTemplate`, `Automation`) sacrifice type safety/queryability.
3. Two overlapping invoice concepts: legacy `Invoice` and newer SaaS billing tables.
4. Worker logic is not tested.
5. No centralized API request logger beyond audit logs.
6. `global-error.tsx` is basic.

## 15. Risks

1. **Tenant isolation:** Enforced at application layer only; no RLS. A bug in any API could leak cross-tenant data.
2. **Realtime gaps:** Polling is simple but not scalable for live queue updates under high concurrency.
3. **Notification preference gap:** Stored preferences are not wired into send path; risk of sending unwanted messages.
4. **Automation engine gap:** `Automation`/`AutomationExecution` models exist but no runtime executes triggers/actions.
5. **Industry vertical depth:** Only Real Estate has rich starter content; other industries feel generic.
6. **Public surface limitations:** No public queue join or customer portal limits the core customer-flow value proposition.

## 16. Missing Functionality

| Capability | Status |
|------------|--------|
| Real-time customer portal | Missing |
| Public queue join / walk-in kiosk | Missing |
| QR codes for check-in/booking/queue | Missing (only MFA QR exists) |
| Real-time push (WebSockets/SSE/pub-sub) | Missing |
| SMS channel | Missing |
| Push notifications | Missing |
| Automation execution engine | Missing |
| Industry-specific data models (vehicles, tables, courses, batches, matters, deals) | Mapped to generic modules |
| Customer-facing appointment/queue status tracking | Missing |
| Multi-location / branch support | Missing |
| Notification preference enforcement | Missing |
| Vertical presets for industries 2-10 | Missing |

## 17. Recommended Migration Strategy

1. **Phase 0 — Audit (this document):** Establish baseline. ✅
2. **Phase 1 — Target architecture:** Define shared engines, realtime architecture, customer portal, QR system, and industry config extensions.
3. **Phase 2 — Data model:** Add only necessary schema changes (e.g., customer-flow session/token table, realtime event log). Extend existing models rather than replace.
4. **Phase 3 — Shared engines:** Refactor queue-service and appointment-service into the core customer-flow engine; add status engine.
5. **Phase 4 — Realtime:** Implement SSE or Redis pub/sub for queue/appointment updates; keep polling fallback.
6. **Phase 5 — Customer portal:** Build `/business/[slug]/queue`, `/business/[slug]/track`, and secure token-based status pages.
7. **Phase 6 — QR engine:** Generate QR codes for queue join, booking, review, and service discovery.
8. **Phase 7 — Notifications:** Wire `NotificationPreference` into send path; add event-driven notifications for queue/appointment lifecycle.
9. **Phase 8 — Industry integration:** Connect each of the 10 industries to shared engines without rebuilding them; populate vertical presets.
10. **Phase 9 — Automation & analytics:** Enable automation execution engine and operational analytics.
11. **Phase 10 — Hardening:** Tenant-isolation tests, load tests, mobile polish, accessibility, production monitoring.
