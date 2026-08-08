# Evernaro — Target Architecture

**Date:** 2026-08-08  
**Goal:** Evolve Evernaro into a multi-industry, multi-tenant, real-time Customer Flow & Operations Platform.

---

## 1. Guiding Principles

1. **Do not rebuild.** Reuse existing auth, tenant isolation, billing, messaging, and dashboard modules.
2. **One core, many industries.** All industries share the same customer-flow engines; only terminology, feature flags, and workflow states differ.
3. **Realtime by default.** Business and customer interfaces update automatically when state changes.
4. **Mobile-first customer experience.** No app install required; QR + shareable URLs.
5. **Safety first.** Every change must preserve existing data, auth, payments, and deployments.

---

## 2. High-Level Architecture

```
                    EVERNARO
                       |
                EVERNARO CORE
        +----------------+----------------+
        |                |                |
   Customer Engine   Operations Engine   Communication Engine
        |                |                |
   Contact/CRM        Queue/Booking      Email/WhatsApp/Telegram
   Service            Staff/Resources    Instagram/Voice/SMS*
   Appointment        Status Engine      Push*
   Queue              Notification       In-app
   Timeline           Automation
        |                |
        +----------------+
                |
         INDUSTRY CONFIG
                |
   +------+------+------+------+------+
   |      |      |      |      |      |
 Salon  Clinic  Restaurant  Auto  Real Estate  ...
```

\* SMS and push are future channels; architecture should allow them to plug in without refactoring.

---

## 3. Core Engines

### 3.1 Customer Engine

Single `Contact` model extended with:

- Source/channel of registration.
- Activity timeline (`CustomerEvent`).
- Last visit / next appointment.
- Membership/package balance.
- Communication preferences.

### 3.2 Service Engine

Existing `Service` model enhanced with:

- `queueEnabled`, `bookingEnabled`, `onlineRegistrationEnabled`.
- Required resources.
- Eligible staff roles.
- Availability rules.

### 3.3 Staff Engine

Existing `StaffProfile` model enhanced with:

- Current status: `AVAILABLE`, `BUSY`, `BREAK`, `OFFLINE`.
- Working hours and breaks.
- Services qualified for.
- Current assignment.

### 3.4 Resource Engine

Existing `Resource` model (TABLE, BAY, ROOM, MACHINE, DESK, OTHER) enhanced with:

- Availability/capacity.
- Assignment to appointments/queue entries.

### 3.5 Appointment Engine

Existing appointment service extended to:

- Support deposits.
- Send status updates to customers.
- Coexist with queue engine.
- Provide public status lookup.

### 3.6 Queue Engine (highest priority)

Reusable real-time queue:

- `Queue` + `QueueEntry` (existing).
- Token, position, estimated wait, status timestamps.
- Statuses: `WAITING`, `CALLED`, `APPROACHING`, `IN_PROGRESS`, `COMPLETED`, `SKIPPED`, `CANCELLED`, `NO_SHOW`.
- Actions: call next, notify, start, pause, complete, skip, cancel.
- Public join endpoint.

### 3.7 Status Engine

Reusable state machine:

- Status definitions stored per industry config.
- Transitions validated server-side.
- Events emitted on every transition.

### 3.8 Notification Engine

Event-driven notifications:

- Map lifecycle events (`QUEUE_JOINED`, `QUEUE_POSITION_CHANGED`, `TURN_APPROACHING`, `SERVICE_STARTED`, etc.) to channels.
- Respect `NotificationPreference`.
- Reuse `sendViaChannel` and worker infrastructure.

### 3.9 Automation Engine

Execute `Automation` records:

- Triggers: lifecycle events.
- Conditions: simple rules.
- Actions: send message, create reminder, request review, notify staff.

### 3.10 Payment Engine

Preserve existing Razorpay/wallet implementation. Add:

- Booking deposits when configured.
- Service payments linked to appointments/job cards.

### 3.11 Review Engine

Existing review model + signed links. Add:

- Automated review requests on completion.
- Industry-specific follow-up timing.

### 3.12 QR Engine

Reusable QR generator:

- Types: `JOIN_QUEUE`, `BOOK_APPOINTMENT`, `VIEW_SERVICES`, `TRACK_STATUS`, `REGISTER`, `REVIEW`.
- Tenant-safe URLs under `/business/[slug]/...`.

### 3.13 Public Customer Portal

Secure, mobile-first pages:

- `/business/[slug]` — business landing.
- `/business/[slug]/services` — list services.
- `/business/[slug]/book` — existing + queue-aware.
- `/business/[slug]/queue` — join queue and view live position.
- `/business/[slug]/track?t=...` — token-based status tracker.

### 3.14 Realtime Engine

Chosen approach: **SSE (Server-Sent Events)** over a dedicated `/api/realtime` route, backed by Redis pub/sub.

Why SSE:

- Fits existing HTTP-based architecture.
- Works through most proxies/CDNs.
- Lower complexity than WebSockets for one-way push (business → customer).
- Redis pub/sub enables multi-instance deployments.

Fallback: retain polling for unsupported clients.

---

## 4. Industry Configuration Architecture

Extend `IndustryTemplate.config` and `OrganizationIndustryConfig.config` to include:

```ts
{
  terminology: { customer, staff, appointment, queue, job, resource, deal?, matter?, enquiry? },
  features: { queue, appointments, payments, memberships, vehicles, tables, courses, batches, matters, reviews, jobCards },
  workflows: {
    appointmentStatuses: [...],
    queueStatuses: [...],
    jobStatuses: [...]
  },
  dashboard: { nav, overviewCards },
  services: [...],
  automations: [...],
  publicFlows: ["QUEUE", "APPOINTMENT", "REVIEW"]
}
```

No industry gets its own data model. Industry differences are expressed through config only.

---

## 5. Data Model Changes (Minimal)

1. Add `CustomerFlowSession` (or extend `QueueEntry`/`Appointment`) with a public token for anonymous tracking.
2. Add `RealtimeEvent` table for durable event stream (optional; Redis pub/sub can be ephemeral).
3. Extend `Service` with `queueEnabled`, `bookingEnabled`.
4. Extend `StaffProfile` with `currentStatus`, `currentCustomerId?`.
5. Ensure `NotificationPreference` is read by send path.
6. Add `AutomationExecution` runtime trigger index.

Avoid creating duplicate Customer/User/Organization/Appointment/Service/Queue models.

---

## 6. Realtime Architecture

```
Business action
   |
   v
API route updates DB
   |
   v
Publish event to Redis channel: "org:<id>:flow:<token>"
   |
   +--> SSE handler for token pushes to customer browser
   +--> Dashboard SSE handler pushes to business UI
```

Events are idempotent and include a sequence number/timestamp. Clients reconnect with `Last-Event-ID`.

---

## 7. Security & Tenant Isolation

- Continue org-scoped queries via `requireOrgMember`.
- Public routes validate org slug and token signatures.
- No public endpoint returns PII beyond first name + token/position.
- Consider Postgres RLS as a future hardening step, not a prerequisite.

---

## 8. Implementation Phases

1. **Phase 0:** Audit ✅
2. **Phase 1:** Target architecture ✅
3. **Phase 2:** Shared customer-flow service layer (queue + appointment unified).
4. **Phase 3:** Realtime SSE + Redis pub/sub.
5. **Phase 4:** Public customer portal (queue join, tracking).
6. **Phase 5:** QR engine.
7. **Phase 6:** Notification engine integration.
8. **Phase 7:** Automation execution.
9. **Phase 8:** Connect all 10 industries through config.
10. **Phase 9:** Analytics + AI insights.
11. **Phase 10:** Production hardening.

---

## 9. Definition of Done for This Milestone

- Existing 10 industries still work.
- Existing Real Estate, auth, payments, messaging remain intact.
- Customer can join queue, book, track live position without refresh.
- Business dashboard updates automatically.
- QR flow works.
- Tenant isolation verified.
- Production build passes.
