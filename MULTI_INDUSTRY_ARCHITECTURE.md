# Evernaro Multi-Industry Transformation — Phase 2 Architecture

## 1. Guiding Principles

1. **One platform, many industries.** All industries share the same core modules. Industry differences are expressed through configuration, terminology, and workflow statuses.
2. **Do not break existing Real Estate / inbox functionality.** Existing `Organization`, `User`, `Contact`, `Conversation`, `Campaign`, `Reminder`, `Invoice`, and `WhatsAppWallet` models remain unchanged in purpose.
3. **Tenant isolation by default.** Every new module filters by `orgId` and respects the current user's organization.
4. **Mobile-first customer experience.** Public pages must work without an app download (web/PWA/QR).
5. **Real-time by design.** Status updates publish events that customer pages consume.
6. **Feature flags per industry.** Not every module is shown to every business.
7. **Phased delivery.** Build reusable engines before industry-specific skins.

## 2. High-Level Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                     EVERNARO CORE                           │
├─────────────────────────────────────────────────────────────┤
│  Identity    │  Org / User / Role / Session / Platform Admin │
├─────────────────────────────────────────────────────────────┤
│  Customers   │  Contact / CustomerEvent / Review / NotificationPreference │
├─────────────────────────────────────────────────────────────┤
│  Operations  │  Service / StaffProfile / Resource / Appointment / Queue / QueueEntry / JobCard │
├─────────────────────────────────────────────────────────────┤
│  Comms       │  Conversation / Message / Campaign / Reminder / Channel / Template │
├─────────────────────────────────────────────────────────────┤
│  Payments    │  Invoice / Wallet / Membership / Package │
├─────────────────────────────────────────────────────────────┤
│  Automation  │  Automation / AutomationExecution │
├─────────────────────────────────────────────────────────────┤
│  Real-time   │  Event bus → SSE / WebSocket / Polling fallback │
├─────────────────────────────────────────────────────────────┤
│  Analytics   │  Aggregates over core models │
├─────────────────────────────────────────────────────────────┤
│  AI          │  Insights + draft replies + suggestions │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              INDUSTRY TEMPLATES (configuration)             │
│  Real Estate │ Salon │ Clinic │ Dental │ Restaurant │ Auto   │
│  Home Svcs   │ Ed    │ Legal  │ Wellness                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              ORGANIZATION INDUSTRY CONFIG                   │
│  Enabled features • Terminology • Workflows • Dashboard     │
└─────────────────────────────────────────────────────────────┘
```

## 3. Database Schema Additions

### 3.1 Industry Template Registry

```prisma
enum IndustryCode {
  REAL_ESTATE
  SALON
  CLINIC
  DENTAL
  RESTAURANT
  AUTO_SERVICE
  HOME_SERVICES
  EDUCATION
  LEGAL
  WELLNESS
  OTHER
}

model IndustryTemplate {
  id          String      @id @default(cuid())
  code        IndustryCode @unique
  name        String
  description String
  isActive    Boolean     @default(true)
  config      Json        // full default configuration object
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  organizations Organization[]
}
```

`IndustryTemplate.config` JSON shape:

```ts
{
  "terminology": {
    "customer": "Customer",
    "staff": "Staff",
    "appointment": "Appointment",
    "queue": "Queue",
    "job": "Job",
    "resource": "Resource"
  },
  "features": {
    "queue": true,
    "appointments": true,
    "services": true,
    "staff": true,
    "resources": false,
    "memberships": false,
    "packages": false,
    "vehicles": false,
    "tables": false,
    "courses": false,
    "batches": false,
    "matters": false,
    "reviews": true
  },
  "workflows": {
    "queueStatuses": ["WAITING", "CALLED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
    "appointmentStatuses": ["BOOKED", "CONFIRMED", "ARRIVED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"],
    "jobStatuses": ["RECEIVED", "INSPECTION", "ESTIMATE", "APPROVED", "IN_PROGRESS", "QUALITY_CHECK", "READY", "DELIVERED"]
  },
  "dashboard": {
    "nav": ["overview", "queue", "appointments", "customers", "services", "staff", "inbox", "reviews", "analytics", "settings"],
    "overviewCards": ["waiting", "inService", "appointmentsToday", "revenueToday"]
  },
  "defaultServices": [...],
  "defaultAutomations": [...]
}
```

### 3.2 Organization Industry Config

```prisma
model OrganizationIndustryConfig {
  id        String           @id @default(cuid())
  orgId     String           @unique
  org       Organization     @relation(fields: [orgId], references: [id], onDelete: Cascade)
  templateId String
  template  IndustryTemplate @relation(fields: [templateId], references: [id])
  config    Json             // org-specific overrides (terminology, enabled features, workflows)
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt
}
```

Add to `Organization`:

```prisma
model Organization {
  ...
  industryTemplateId String?
  industryTemplate   IndustryTemplate?         @relation(fields: [industryTemplateId], references: [id])
  industryConfig     OrganizationIndustryConfig?
}
```

### 3.3 Services Catalogue

```prisma
model Service {
  id          String       @id @default(cuid())
  orgId       String
  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  name        String
  description String?
  durationMin Int?         // default duration in minutes
  priceInr    Int?         // optional default price in paise? or whole rupees? Use smallest currency unit.
  color       String?      // UI color
  isActive    Boolean      @default(true)
  metadata    Json         @default("{}") // industry-specific extras (e.g. treatment category)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  appointments Appointment[]
  queueEntries QueueEntry[]
  staff        ServiceStaff[]

  @@index([orgId, isActive])
}
```

### 3.4 Staff & Resources

```prisma
model StaffProfile {
  id          String       @id @default(cuid())
  orgId       String
  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  userId      String?      @unique // optional link to User account
  user        User?        @relation(fields: [userId], references: [id], onDelete: SetNull)
  name        String
  role        String       // industry label: Stylist / Doctor / Technician / Lawyer etc.
  phone       String?
  email       String?
  color       String?
  isActive    Boolean      @default(true)
  workingHours Json        @default("[]") // [{ day: 0, start: "09:00", end: "18:00" }]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  appointments Appointment[]
  services     ServiceStaff[]
  queueEntries QueueEntry[]   @relation("AssignedStaff")
  jobCards     JobCard[]

  @@index([orgId, isActive])
}

model ServiceStaff {
  id        String       @id @default(cuid())
  serviceId String
  service   Service      @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  staffId   String
  staff     StaffProfile @relation(fields: [staffId], references: [id], onDelete: Cascade)

  @@unique([serviceId, staffId])
}

model Resource {
  id          String       @id @default(cuid())
  orgId       String
  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  name        String       // Table 5 / Bay 2 / Room A
  type        String       // TABLE / BAY / ROOM / MACHINE
  capacity    Int          @default(1)
  isActive    Boolean      @default(true)
  metadata    Json         @default("{}")
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  appointments Appointment[]

  @@index([orgId, type, isActive])
}
```

### 3.5 Appointments

```prisma
enum AppointmentStatus {
  BOOKED
  CONFIRMED
  ARRIVED
  IN_PROGRESS
  COMPLETED
  CANCELLED
  NO_SHOW
}

model Appointment {
  id              String            @id @default(cuid())
  orgId           String
  org             Organization      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  contactId       String
  contact         Contact           @relation(fields: [contactId], references: [id], onDelete: Cascade)
  serviceId       String?
  service         Service?          @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  staffId         String?
  staff           StaffProfile?     @relation(fields: [staffId], references: [id], onDelete: SetNull)
  resourceId      String?
  resource        Resource?         @relation(fields: [resourceId], references: [id], onDelete: SetNull)
  startsAt        DateTime
  endsAt          DateTime
  status          AppointmentStatus @default(BOOKED)
  notes           String?           @db.Text
  depositInr      Int?              // amount paid as deposit
  reminderSentAt  DateTime?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@index([orgId, startsAt])
  @@index([orgId, status])
  @@index([contactId])
}
```

### 3.6 Queue / Waitlist

```prisma
enum QueueEntryStatus {
  WAITING
  CALLED
  IN_PROGRESS
  COMPLETED
  CANCELLED
  NO_SHOW
}

model Queue {
  id          String       @id @default(cuid())
  orgId       String
  org         Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  name        String       // Main Queue / Walk-ins
  serviceId   String?
  service     Service?     @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  isActive    Boolean      @default(true)
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  entries QueueEntry[]

  @@index([orgId, isActive])
}

model QueueEntry {
  id              String           @id @default(cuid())
  orgId           String
  org             Organization     @relation(fields: [orgId], references: [id], onDelete: Cascade)
  queueId         String
  queue           Queue            @relation(fields: [queueId], references: [id], onDelete: Cascade)
  contactId       String
  contact         Contact          @relation(fields: [contactId], references: [id], onDelete: Cascade)
  serviceId       String?
  service         Service?         @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  staffId         String?
  staff           StaffProfile?    @relation("AssignedStaff", fields: [staffId], references: [id], onDelete: SetNull)
  token           String           // e.g. A-12
  position        Int              // computed, updated on changes
  estimatedWaitMin Int?
  status          QueueEntryStatus @default(WAITING)
  calledAt        DateTime?
  startedAt       DateTime?
  completedAt     DateTime?
  cancelledAt     DateTime?
  noShowAt        DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@index([queueId, status])
  @@index([queueId, position])
  @@index([contactId])
}
```

### 3.7 Job Cards (Auto / Home Services)

```prisma
enum JobCardStatus {
  RECEIVED
  INSPECTION
  ESTIMATE
  APPROVED
  IN_PROGRESS
  QUALITY_CHECK
  READY
  DELIVERED
}

model JobCard {
  id            String        @id @default(cuid())
  orgId         String
  org           Organization  @relation(fields: [orgId], references: [id], onDelete: Cascade)
  contactId     String
  contact       Contact       @relation(fields: [contactId], references: [id], onDelete: Cascade)
  serviceId     String?
  service       Service?      @relation(fields: [serviceId], references: [id], onDelete: SetNull)
  staffId       String?
  staff         StaffProfile? @relation(fields: [staffId], references: [id], onDelete: SetNull)
  title         String
  description   String?       @db.Text
  status        JobCardStatus @default(RECEIVED)
  estimateInr   Int?
  approvedAt    DateTime?
  completedAt   DateTime?
  deliveredAt   DateTime?
  metadata      Json          @default("{}") // vehicle info, address, etc.
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([orgId, status])
  @@index([contactId])
}
```

### 3.8 Memberships & Packages

```prisma
enum MembershipStatus {
  ACTIVE
  EXPIRED
  CANCELLED
}

model Membership {
  id             String           @id @default(cuid())
  orgId          String
  org            Organization     @relation(fields: [orgId], references: [id], onDelete: Cascade)
  contactId      String
  contact        Contact          @relation(fields: [contactId], references: [id], onDelete: Cascade)
  name           String
  sessionsTotal  Int?
  sessionsUsed   Int              @default(0)
  expiresAt      DateTime?
  status         MembershipStatus @default(ACTIVE)
  createdAt      DateTime         @default(now())
  updatedAt      DateTime         @updatedAt

  @@index([orgId, contactId, status])
}
```

### 3.9 Reviews

```prisma
model Review {
  id        String       @id @default(cuid())
  orgId     String
  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  contactId String
  contact   Contact      @relation(fields: [contactId], references: [id], onDelete: Cascade)
  rating    Int          // 1-5
  comment   String?      @db.Text
  metadata  Json         @default("{}") // service, staff
  createdAt DateTime     @default(now())

  @@index([orgId, createdAt])
  @@index([contactId])
}
```

### 3.10 Customer Events

```prisma
enum CustomerEventType {
  REGISTERED
  APPOINTMENT_BOOKED
  APPOINTMENT_CHANGED
  QUEUE_JOINED
  QUEUE_CALLED
  SERVICE_STARTED
  SERVICE_COMPLETED
  PAYMENT_RECEIVED
  REVIEW_RECEIVED
  FOLLOW_UP_DUE
  MEMBERSHIP_EXPIRING
}

model CustomerEvent {
  id          String          @id @default(cuid())
  orgId       String
  org         Organization    @relation(fields: [orgId], references: [id], onDelete: Cascade)
  contactId   String
  contact     Contact         @relation(fields: [contactId], references: [id], onDelete: Cascade)
  type        CustomerEventType
  entityType  String?         // "appointment", "queueEntry", "jobCard", "invoice"
  entityId    String?
  metadata    Json            @default("{}")
  createdAt   DateTime        @default(now())

  @@index([orgId, contactId, createdAt])
  @@index([orgId, type, createdAt])
}
```

### 3.11 Automations

```prisma
enum AutomationTrigger {
  APPOINTMENT_CREATED
  APPOINTMENT_DUE_SOON
  APPOINTMENT_CANCELLED
  QUEUE_JOINED
  QUEUE_POSITION_CHANGED
  QUEUE_TURN_READY
  SERVICE_COMPLETED
  PAYMENT_OVERDUE
  CUSTOMER_INACTIVE
  FOLLOW_UP_DUE
}

enum AutomationAction {
  SEND_MESSAGE
  SEND_EMAIL
  CREATE_TASK
  CREATE_REMINDER
  NOTIFY_STAFF
  REQUEST_REVIEW
}

model Automation {
  id        String            @id @default(cuid())
  orgId     String
  org       Organization      @relation(fields: [orgId], references: [id], onDelete: Cascade)
  name      String
  trigger   AutomationTrigger
  conditions Json             @default("[]") // [{ field, operator, value }]
  actions   Json             // [{ type, config }]
  isActive  Boolean          @default(true)
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt

  executions AutomationExecution[]

  @@index([orgId, isActive])
}

model AutomationExecution {
  id            String       @id @default(cuid())
  automationId  String
  automation    Automation   @relation(fields: [automationId], references: [id], onDelete: Cascade)
  status        String       // SUCCESS / FAILED / SKIPPED
  error         String?
  metadata      Json         @default("{}")
  createdAt     DateTime     @default(now())

  @@index([automationId, createdAt])
}
```

### 3.12 Notification Preferences

```prisma
model NotificationPreference {
  id        String       @id @default(cuid())
  orgId     String
  org       Organization @relation(fields: [orgId], references: [id], onDelete: Cascade)
  contactId String
  contact   Contact      @relation(fields: [contactId], references: [id], onDelete: Cascade)
  channel   String       // WHATSAPP / EMAIL / SMS
  enabled   Boolean      @default(true)
  events    String[]     // e.g. ["APPOINTMENT_REMINDER", "QUEUE_TURN_READY"]

  @@unique([orgId, contactId, channel])
}
```

## 4. Industry Template Defaults

### 4.1 Real Estate

```ts
{
  terminology: { customer: "Lead", staff: "Agent", appointment: "Site Visit", queue: "Walk-ins", job: "Deal" },
  features: { queue: false, appointments: true, services: true, resources: false, memberships: false, reviews: true },
  workflows: {
    appointmentStatuses: ["BOOKED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"],
    jobStatuses: ["NEW", "CONTACTED", "QUALIFIED", "SITE_VISIT", "NEGOTIATION", "BOOKED", "CLOSED"]
  },
  dashboard: {
    nav: ["overview", "leads", "siteVisits", "deals", "customers", "inbox", "analytics", "settings"],
    overviewCards: ["newLeads", "hotLeads", "followUpsToday", "siteVisitsToday", "closedDeals"]
  }
}
```

### 4.2 Salon / Beauty

```ts
{
  terminology: { customer: "Customer", staff: "Stylist", appointment: "Appointment", queue: "Waiting List", job: "Service" },
  features: { queue: true, appointments: true, services: true, resources: false, memberships: true, packages: true, reviews: true },
  workflows: {
    queueStatuses: ["WAITING", "CALLED", "IN_SERVICE", "COMPLETED", "CANCELLED", "NO_SHOW"],
    appointmentStatuses: ["BOOKED", "CONFIRMED", "ARRIVED", "IN_SERVICE", "COMPLETED", "CANCELLED", "NO_SHOW"]
  }
}
```

### 4.3 Clinic

```ts
{
  terminology: { customer: "Patient", staff: "Doctor", appointment: "Appointment", queue: "Queue", job: "Consultation" },
  features: { queue: true, appointments: true, services: true, resources: false, reviews: true },
  workflows: {
    queueStatuses: ["WAITING", "CALLED", "IN_CONSULTATION", "COMPLETED", "CANCELLED", "NO_SHOW"],
    appointmentStatuses: ["BOOKED", "CONFIRMED", "ARRIVED", "IN_CONSULTATION", "COMPLETED", "CANCELLED", "NO_SHOW"]
  }
}
```

(Similar condensed blocks for Dental, Restaurant, Auto Service, Home Services, Education, Legal, Wellness.)

## 5. API & Module Architecture

### 5.1 Tenant Isolation Helper

Create `src/lib/with-org.ts`:

```ts
export async function withOrg(handler: (ctx: { orgId: string; userId?: string; role?: string }) => Promise<Response>) {
  const session = await auth();
  if (!session?.user?.orgId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return handler({ orgId: session.user.orgId, userId: session.user.id, role: session.user.role });
}
```

Use in every new API route.

### 5.2 Core Services (server-only)

Create `src/lib/services/`:

- `appointment-service.ts` — CRUD + availability + status transitions
- `queue-service.ts` — join queue, position calculation, call next, status updates
- `staff-service.ts` — staff CRUD + availability
- `service-catalogue.ts` — services CRUD
- `job-card-service.ts` — job card lifecycle
- `notification-service.ts` — dispatch across channels using existing send lib
- `customer-event-service.ts` — record events, feed analytics
- `automation-service.ts` — evaluate triggers and run actions
- `industry-config.ts` — resolve effective config for org

### 5.3 Real-Time Engine

**Chosen approach: Server-Sent Events (SSE) + Redis Pub/Sub fallback.**

Why SSE:
- One-way server → client is sufficient for status updates.
- Works over HTTP, easy with Next.js App Router Route Handlers.
- Automatic reconnection built into browser `EventSource`.

Architecture:

```text
Staff updates status
  ↓
Service writes to DB
  ↓
Service publishes event to Redis channel "org:{orgId}:public"
  ↓
SSE route subscribes to Redis channel
  ↓
Client EventSource receives event
```

For single-instance deployments without Redis, use an in-memory event bus.

Create:
- `src/lib/realtime.ts` — publish/subscribe abstraction
- `src/app/api/realtime/route.ts` — SSE endpoint
- `src/lib/use-realtime.ts` — React hook for customer + staff UIs

### 5.4 Public Customer Pages

Routes under `src/app/(public)/business/[slug]/`:

- `page.tsx` — business profile + services
- `book/page.tsx` — book appointment
- `queue/page.tsx` — join queue + live status
- `status/[token]/page.tsx` — customer status tracker

Use contact identification by phone/email OTP or magic link.

### 5.5 Dynamic Dashboard Navigation

Replace static nav in `dashboard-shell.tsx` with config-driven nav:

```ts
const nav = useIndustryNav(); // reads org config, returns nav items
```

Each nav item maps to a route. Hidden items are filtered by enabled features and role.

## 6. Customer 360° Profile

Create `src/app/(dashboard)/contacts/[id]/page.tsx` enhanced with tabs:

- Overview (info + tags + notes)
- Appointments
- Queue History
- Job Cards
- Memberships / Packages
- Payments / Invoices
- Reviews
- Conversation History
- Customer Events / Timeline

## 7. AI Engine Integration

Leverage existing OpenAI/Anthropic integration:

- **Conversation summaries** — summarize long threads.
- **Suggested replies** — extend existing AI draft to use customer context.
- **Daily business summary** — query analytics, generate natural language summary.
- **Follow-up recommendations** — based on `CustomerEvent` gaps.
- **Demand prediction** — simple statistical forecasting from historical appointments/queue.

## 8. Security & Compliance

- Keep tenant isolation helper on every API route.
- Add org-scoped indexes.
- Encrypt sensitive metadata at rest where appropriate.
- Healthcare/legal data: avoid storing medical records or legal advice; keep only operational info.
- Webhook verification preserved.

## 9. Implementation Phasing

### Phase 1 — Audit ✅
Produce `MULTI_INDUSTRY_AUDIT.md`.

### Phase 2 — Architecture ✅
Produce `MULTI_INDUSTRY_ARCHITECTURE.md`.

### Phase 3 — Core Schema Migration
1. Add `IndustryTemplate`, `OrganizationIndustryConfig`, `Service`, `StaffProfile`, `Resource`, `Appointment`, `Queue`, `QueueEntry`, `Review`, `CustomerEvent`.
2. Seed default industry templates.
3. Migration strategy: additive only, no data destruction.

### Phase 4 — Industry Config & Onboarding
1. Industry selector during signup/onboarding.
2. `useIndustryConfig()` hook.
3. Dynamic dashboard nav.

### Phase 5 — Appointments & Queue Engines
1. Service catalog CRUD.
2. Staff profiles CRUD.
3. Appointment booking + availability.
4. Queue join + token + position.
5. Status transitions.

### Phase 6 — Customer 360°
1. Enhanced contact detail page.
2. Timeline/events view.

### Phase 7 — Public Pages
1. `/business/[slug]` landing.
2. Booking page.
3. Queue join page.
4. Status tracker.

### Phase 8 — Real-Time
1. SSE endpoint.
2. Redis pub/sub.
3. React hook.
4. Status update publishing.

### Phase 9 — Automations
1. Automation model + UI.
2. Trigger evaluation.
3. Action runners (message, reminder, task, review request).

### Phase 10 — AI Insights
1. Daily summary.
2. Follow-up alerts.
3. Demand/busy period stats.

### Phase 11 — Billing Tiers
1. Feature limits per plan.
2. Enforce limits in services.

### Phase 12 — QA & Hardening
1. Tests for new services.
2. Tenant isolation tests.
3. Build/lint/test passes.
4. Verify existing Real Estate/inbox flows.

---

*Architecture document ready for Phase 3 implementation.*
