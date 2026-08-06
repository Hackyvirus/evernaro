# Evernaro Multi-Industry Transformation — Phase 1 Audit

## 1. Executive Summary

Evernaro is currently a **multi-tenant omnichannel customer communication platform** built around a unified inbox. It already has strong foundations for a multi-industry pivot:

- Multi-tenant `Organization` model with user roles.
- Unified contact/customer model.
- Messaging across WhatsApp, Telegram, Email, Instagram, Voice.
- Campaigns, reminders, and AI-drafted replies.
- Razorpay payments, WhatsApp wallet, invoices.
- Audit logs and platform admin controls.

However, it currently lacks operational modules required by service businesses:

- Services/catalogue
- Staff/resource management
- Appointments
- Queue/waitlist
- Job/service status tracking
- Public customer-facing booking/status pages
- Industry-specific terminology and workflows

The existing `BusinessProfile.industry` field is a free-form string, so there is no formal industry template system yet.

## 2. Framework & Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16.3.0 (App Router) |
| React | 19.2.4 |
| Language | TypeScript 5.x |
| Styling | Tailwind CSS v4 + `@tailwindcss/postcss` |
| ORM | Prisma 6.19.3 (PostgreSQL) |
| Auth | next-auth v5 beta (`next-auth/react`) |
| Queue/BG jobs | BullMQ + Redis (ioredis) |
| Email | Resend |
| AI | OpenAI / Anthropic SDK |
| Payments | Razorpay |
| Observability | Sentry Next.js SDK |
| Build output | Standalone (Docker) |

### App structure

- `src/app/(auth)/` — login, signup, forgot/reset password, verify email
- `src/app/(dashboard)/` — authenticated org dashboard (inbox, contacts, campaigns, reminders, analytics, etc.)
- `src/app/(platform-protected)/platform/` — platform admin shell
- `src/app/page.tsx` — marketing landing page
- `src/app/contact/page.tsx` — contact page
- `src/app/api/**` — API routes
- `src/components/ui/` — design system components
- `src/components/landing/` — landing page sections
- `src/lib/` — business logic, auth, Prisma client, channel integrations
- `prisma/schema.prisma` — data model
- `src/workers/index.ts` — BullMQ worker process

## 3. Database Model Audit

### Existing core entities (reusable for multi-industry)

| Model | Purpose | Multi-industry fit |
|-------|---------|---------------------|
| `Organization` | Tenant root: name, slug, status, billing | ✅ Reuse as-is |
| `User` | Org members with roles OWNER/ADMIN/AGENT/VIEWER | ✅ Reuse; add industry-specific labels via config |
| `Contact` | Customer/lead: name, phone, email, tags, notes | ✅ Becomes the universal customer profile core |
| `Conversation` / `Message` | Omnichannel thread + messages | ✅ Reuse for all industries |
| `Channel` | Telegram/Email/WhatsApp/Instagram/Voice credentials | ✅ Reuse |
| `Campaign` / `CampaignRecipient` | Bulk outbound messages | ✅ Reuse as marketing/growth engine |
| `Reminder` | Scheduled one-off/recurring messages | ✅ Reuse for reminders/follow-ups |
| `Invoice` / `WhatsAppWallet` / `WalletTransaction` | Razorpay + WhatsApp metering | ✅ Reuse |
| `BusinessProfile` | Org info + AI knowledge base + `industry` string | ⚠️ Need to formalize `industry` into template FK |
| `AuditLog` | Operational audit trail | ✅ Reuse |
| `PlatformAdmin` | Eversity staff | ✅ Reuse |

### Missing entities required for multi-industry

| Needed model | Why |
|--------------|-----|
| `IndustryTemplate` | Canonical list of supported industries + default config |
| `OrganizationIndustryConfig` | Per-org overrides of terminology, enabled features, workflows |
| `Service` | Catalogue of services/treatments/classes/vehicles/etc. |
| `StaffProfile` | Staff/resource details, availability, assignments |
| `Resource` | Physical resources: tables, rooms, bays, machines |
| `Appointment` | Booked slot: service + staff/resource + customer + time |
| `Queue` | Live waitlist per service/location |
| `QueueEntry` | Customer in queue: token, position, status, timestamps |
| `JobCard` / `ServiceOrder` | Operational job tracking (auto, home services) |
| `Membership` / `Package` | Prepaid sessions/plans |
| `Review` | Customer feedback |
| `CustomerEvent` | Lifecycle events for analytics/automation |
| `Automation` / `AutomationExecution` | Trigger/condition/action rules |
| `NotificationPreference` | Per-customer/channel opt-ins |
| Industry extension tables | `Property`, `Vehicle`, `Table`, `Course`, `Batch`, `Matter`, etc. |

## 4. Authentication & Authorization

- **Auth library**: next-auth v5 beta (`next-auth/react` `SessionProvider`).
- **Session strategy**: JWT-based (auth config in `src/lib/auth.config.ts` + `src/lib/auth.ts`).
- **Roles**: `OWNER`, `ADMIN`, `AGENT`, `VIEWER`.
- **Enforcement**:
  - API routes use `auth()` and check `session.user.orgId`.
  - Layouts use `auth()` and `redirect()`.
  - `RoleProvider` + `useRole()` in dashboard for UI gating.
- **Tenant isolation**: Most queries filter by `orgId`.

### Gaps

- No fine-grained permissions beyond roles.
- No organization-level feature flags for enabling/disabling modules per industry.
- `VIEWER` role is recent; permission matrix is simple.

## 5. Existing Dashboards

### Dashboard shell (`src/app/(dashboard)/dashboard-shell.tsx`)

Navigation items:

- Overview
- Inbox
- Contacts
- Campaigns
- Reminders
- Analytics
- Channels
- Knowledge Base
- Team (admin/owner only)
- Billing (admin/owner only)
- Settings

### Platform admin shell

- Clients
- Add client
- Billing
- WhatsApp rates
- Analytics
- Audit logs

### Gaps

- No Services, Staff, Appointments, Queue, Jobs, Tables, Reviews, Memberships.
- Navigation is static; not driven by industry config.

## 6. Customer/CRM Module

- `Contact` is the customer record.
- Fields: name, email, phone, telegramChatId, instagramUserId, company, tags, notes.
- Contacts are linked to `Conversation`, `CampaignRecipient`, `Reminder`, `CallLog`.
- Tags and notes are the only segmentation/follow-up tooling today.

### Gaps

- No 360-degree view page combining appointments, queue history, payments, reviews.
- No custom fields / industry-specific extensions.
- No membership/package tracking.

## 7. Messaging & Notifications

- **Channels**: Telegram, Email (Resend), WhatsApp (Gupshup + Meta templates), Instagram (Graph API), Voice (Twilio).
- **Inbox**: AI-drafted replies from business knowledge base; human approves.
- **Campaigns**: Bulk sends via WhatsApp templates.
- **Reminders**: Scheduled calls/messages.
- **Wallet**: Prepaid WhatsApp cost metering.

### Multi-industry fit

- Notification engine is largely reusable.
- Templates need to be industry-aware (appointment reminders, queue turn ready, table ready, service status updates).
- Real-time updates currently rely on inbound webhooks; customer-facing live status needs a publish/subscribe mechanism.

## 8. Appointments/Scheduling

- **Current**: `Reminder` model with `APPOINTMENT` type. This is a notification, not an appointment booking record.
- **Missing**: Proper `Appointment` entity with service, staff/resource, datetime, duration, status, cancellations, deposits.

## 9. Real Estate Functionality

- The schema has `BusinessProfile.industry` (free text) and `BusinessProfile.knowledgeBase` / `faqs` / `products` / `policies`.
- There is no dedicated `Property`, `Lead`, or `SiteVisit` model.
- The landing page targets “service businesses” generally.
- **Conclusion**: Real Estate features are currently minimal/knowledge-base only. There is little to break, but the industry template must be built from scratch.

## 10. Payments

- Razorpay one-time invoices.
- WhatsApp wallet top-ups.
- `Invoice` model reused for subscription and wallet top-up.
- Webhook verification in `src/app/api/webhooks/razorpay/route.ts`.

### Multi-industry extension

- Add service payments, deposits, membership/package purchases, refunds.
- Existing Razorpay plumbing is reusable.

## 11. Integrations

| Integration | Usage |
|-------------|-------|
| Sentry | Error tracking (client + server) |
| Redis | BullMQ job queue |
| Meta/Gupshup | WhatsApp Business API |
| Telegram Bot API | Inbound/outbound messages |
| Resend | Transactional/outbound email |
| Twilio | Voice reminder calls |
| Instagram Graph API | DMs |
| OpenAI/Anthropic | AI draft replies |
| Razorpay | Payments |

## 12. API Architecture

- REST API routes under `src/app/api/**`.
- Common pattern: `auth()` → validate org → Prisma query → response.
- Some endpoints use Zod validation.
- Webhook routes for Telegram, WhatsApp, Instagram, email, Razorpay, voice status.

### Gaps

- No centralized tenant-isolation middleware (repeated `orgId` checks).
- No standardized CRUD scaffolding for new modules.

## 13. Design System

- Custom UI components in `src/components/ui/`: Button, Card, Input, Badge, Avatar, Toast, Tabs, Table, etc.
- Tailwind v4 with CSS variables for theming (`bg-bg`, `text-text`, `border-border`, etc.).
- Dark/light theme via `data-theme` attribute.
- Mobile-first landing pages.

### Gaps

- No industry-specific dashboard layouts.
- No reusable data table with pagination/sorting.
- No kanban/status board component.
- No public/customer-facing UI kit.

## 14. Deployment

- `Dockerfile` for Next.js app (standalone output).
- `Dockerfile.worker` for background worker.
- `docker-compose.yml` for local orchestration.
- Prisma migrations committed.
- Environment variables in `.env` / `.env.local`.

## 15. Testing

- Vitest for unit tests.
- Existing tests: crypto, TOTP, session, subscription, WhatsApp wallet, template validation, Razorpay signature, phone.
- No E2E or integration tests for dashboard/API.

## 16. Technical Debt & Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| `BusinessProfile.industry` is free text | Can't reliably determine industry behavior | Migrate to FK `IndustryTemplate` |
| No formal service/appointment/queue models | Core requirement missing | Add reusable core models |
| Static dashboard nav | Won't scale to 10 industries | Make nav driven by org config |
| Manual tenant isolation in every API | Security risk, boilerplate | Centralize via middleware/helpers |
| Customer-facing pages don't exist | Self-service queue/booking not possible | Build public `/business/[slug]` routes |
| Real-time engine absent | Live status updates not possible | Add SSE/WebSocket/polling layer |
| `next-auth` v5 beta | Potential instability | Pin version, test auth flows after changes |
| Large scope | High risk of breaking existing flows | Phased delivery, tests after each phase |

## 17. Recommended Architecture Direction

Build **Evernaro Core + Industry Templates**:

```text
Evernaro Core
├── Organizations / Users / Roles
├── Contacts (360° customer profile)
├── Services (catalogue)
├── StaffProfiles + Resources
├── Appointments
├── Queue + QueueEntries
├── Conversations / Messages
├── Campaigns / Reminders / Notifications
├── Payments / Invoices / Memberships / Packages
├── Automations
├── Reviews
├── Analytics
└── Industry Templates
       ├── Real Estate
       ├── Salon / Beauty
       ├── Clinic
       ├── Dental
       ├── Restaurant
       ├── Auto Service
       ├── Home Services
       ├── Education
       ├── Legal
       └── Wellness
```

Each industry template defines:

- Enabled features
- Terminology mapping
- Default services
- Default dashboard navigation
- Default workflows/statuses
- Recommended automations

## 18. Implementation Phasing Recommendation

1. **Phase 1 — Audit** ✅ (this document)
2. **Phase 2 — Architecture** — schema + module design
3. **Phase 3 — Core Models** — `IndustryTemplate`, `Service`, `StaffProfile`, `Resource`, `Appointment`, `Queue`, `QueueEntry`, `Review`, `CustomerEvent`
4. **Phase 4 — Industry Config** — template registry + org onboarding industry selector
5. **Phase 5 — Appointments & Queue Engines** — booking, token, status, real-time position
6. **Phase 6 — Customer 360° View** — unified customer profile page
7. **Phase 7 — Public Pages** — `/business/[slug]/book`, `/queue`, `/status`
8. **Phase 8 — Industry Dashboards** — dynamic nav + industry-specific overview pages
9. **Phase 9 — Real-Time Engine** — SSE/polling for status updates
10. **Phase 10 — Automations** — trigger/condition/action engine
11. **Phase 11 — AI Insights** — demand/wait/follow-up predictions
12. **Phase 12 — Billing Tiers** — feature limits per plan
13. **Phase 13 — QA & Production Hardening**

---

*Audit produced as input for `MULTI_INDUSTRY_ARCHITECTURE.md`.*
