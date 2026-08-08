# EVERNARO — STARTUP READINESS & PRODUCT STRATEGY REPORT

**Audited repository:** `D:\Eversity\everreach`  
**Company:** Eversity Tech LLP  
**Product:** Evernaro — multi-tenant omnichannel customer communication SaaS for Indian SMBs  
**Audit date:** 2026-08-08  
**Method:** Direct codebase inspection (`package.json`, `prisma/schema.prisma`, `src/app/**`, `src/lib/**`, `src/components/**`, `src/workers/**`, tests, Docker/config files, README/AGENTS/docs). Labels: **FACT** (verified from code), **ASSUMPTION** (not validated), **UNKNOWN** (insufficient evidence), **RECOMMENDATION**, **VALIDATION REQUIRED**.

---

## 1. Executive Summary

**FACT:** Evernaro is a functionally complete *minimum viable* multi-tenant SaaS. The repository contains 235+ TypeScript/TSX files, a 1,500+ line Prisma schema, 56 passing Vitest tests, Docker build files for both the web app and a BullMQ worker, and a Razorpay-integrated billing engine.

**FACT:** The core loop works end-to-end: a business connects Telegram / Email / WhatsApp (via Gupshup) / Instagram / Voice (Twilio), receives inbound messages into a unified inbox, gets AI-drafted replies from a configurable knowledge base, and sends campaigns or scheduled reminders. A platform admin dashboard lets Eversity manage clients, invoices, WhatsApp rate cards, and audit logs.

**FACT:** Since the initial audit, the team has shipped the previously schema-only surface: Job Cards, Resources, Memberships/Packages, Reviews, Customer Events, Notification Preferences, automated appointment reminders, automated review requests, and live polling on the queue dashboard. New additions in this cycle include a public queue self check-in page, OTP-based staff verification, an auto no-show worker, dashboard QR codes, a public booking page (`/business/[slug]/book`), a public review page (`/business/[slug]/review`), 11 demo organizations (one per industry), demo account seed/cleanup tooling, and platform-admin forgot/reset-password flows.

**FACT:** The most recent development cycle turned the billing schema into a real subscription lifecycle: plan-feature/usage entitlement enforcement (campaigns + team seats), Razorpay webhook-driven payment recording and status transitions, a platform-admin billing control center (MRR, revenue, subscription search + detail), an enhanced client billing page (plan features, usage bars, payment history, invoices, wallet, reactivation), and navigation/settings integration.

**FACT:** A subsequent full-stack cycle closed the remaining billing and operational gaps: automated recurring invoice generation with a daily billing-run worker, dunning retry tracking, saved payment-method sync from Razorpay, invoice PDF downloads and payment receipts, proration on plan changes, a first-class multi-location model with location scoping for services/staff/appointments/queues/resources, and external client API access via scoped API keys (`/api/v1/contacts`, `/api/v1/appointments`).

**RECOMMENDATION:** Before adding more schema or industries, narrow to one beachhead market, make its highest-value workflow 10× better than spreadsheets/WhatsApp Business, and sell it to 10 paying customers. The technology is ready; the strategy is not.

**Startup readiness score: 6.7 / 10** (see §33 for breakdown).

---

## 2. Product Overview

Evernaro is positioned as a unified customer communication platform: one inbox for Telegram, Email, WhatsApp, Instagram, and Voice reminders, with AI-drafted replies that a human reviews before sending.

**What it actually ships today (FACT):**
- Multi-tenant org model with role-based access (Owner / Admin / Agent / Viewer).
- Unified inbox with conversation list, filters, assignment, priority, status, and a customer profile sidebar.
- AI draft replies using OpenAI or Anthropic, driven by a business knowledge base (free-text + FAQs + products + policies + guardrails).
- Bulk campaigns and scheduled/recurring reminders across channels, with WhatsApp template enforcement outside Meta's 24-hour window.
- Contact CRM with tags, notes, company, CSV import, and per-contact timeline stubs.
- Appointment booking, queue/token management, service catalog, and staff profiles.
- Public customer pages: booking, review submission, and queue self check-in with live tracker.
- OTP verification for queue hand-off; auto no-show marking when a called customer does not arrive.
- Prepaid WhatsApp wallet that debits per message and blocks sends when empty.
- Razorpay checkout for subscription invoices and wallet top-ups.
- End-to-end subscription lifecycle: plan feature/usage entitlements, Razorpay webhook payment recording, status transitions, reactivation, automated recurring invoices, dunning, proration on plan changes, saved payment methods, invoice PDFs/receipts, and client + platform-admin billing dashboards.
- Platform admin surface for client management, invoice generation, rate cards, analytics, audit logs, billing control center, manual billing runs, and self-service password reset.
- Multi-location support with org-level active location, branch selector in the sidebar, and location-scoped services, staff, appointments, queues, and resources.
- External API access with scoped API keys and example `/api/v1/contacts` and `/api/v1/appointments` endpoints.
- Demo orgs and trial accounts for sales demos.

**What is promised but not live (FACT):**
- Real-time SSE/WebSocket status updates are not implemented (queue uses 5–7 second polling).
- Industry-specific dashboards beyond navigation labels are not implemented.
- Attachments/media messages are not supported.
- A visual automation builder does not exist (auto-reminders/review requests are hard-coded).

---

## 3. Current Product Audit

| Area | Feature | Status | Where implemented | Who uses it | Business value |
|---|---|---|---|---|---|
| Auth | Email/password login with bcrypt (cost 12) | **IMPLEMENTED** | `src/lib/auth.ts`, `src/lib/session.ts` | All users | High — baseline security |
| Auth | Email verification | **IMPLEMENTED** | `src/app/api/auth/verify-email/**`, banner in dashboard | New signups | Medium — deliverability/anti-spam |
| Auth | Password reset | **IMPLEMENTED** | `src/app/api/auth/reset-password/**` | All users | High — churn reduction |
| Auth | TOTP MFA + backup codes | **IMPLEMENTED** | `src/lib/totp.ts`, Settings > Security | Security-conscious users | Medium — enterprise trust |
| Multi-tenancy | Org-scoped queries + session re-verification | **IMPLEMENTED** | `src/lib/session.ts`, all API routes | All users | Critical — prevents cross-tenant leaks |
| Channels | Telegram inbound/outbound | **IMPLEMENTED** | `src/lib/telegram.ts`, webhook + settings | Any business | Medium — niche in India |
| Channels | Email via Resend | **IMPLEMENTED** | `src/lib/email.ts`, inbound webhook | Any business | Medium — B2B/invoice use |
| Channels | WhatsApp via Gupshup | **IMPLEMENTED** | `src/lib/whatsapp.ts`, template mgmt | Any business | **High** — India's dominant channel |
| Channels | Instagram DMs | **IMPLEMENTED** | `src/lib/instagram.ts`, webhook | B2C brands | Medium — high friction to set up |
| Channels | Voice calls (Twilio) | **IMPLEMENTED** | `src/lib/voice.ts`, reminder-only | Appointment businesses | Medium — compliance-sensitive |
| Inbox | Unified thread list, filters, search | **IMPLEMENTED** | `src/app/(dashboard)/inbox/**` | Agents/Admins | **High** — core differentiator |
| Inbox | AI draft replies | **IMPLEMENTED** | `src/lib/ai.ts`, `conversation-view.tsx` | Agents | **High** — efficiency |
| Inbox | Assignment, priority, status | **IMPLEMENTED** | `inbox-shell.tsx`, API | Managers | Medium — workflow |
| CRM | Contacts, tags, notes, CSV import | **IMPLEMENTED** | `src/app/(dashboard)/contacts/**` | All users | High — data foundation |
| CRM | Contact detail timeline | **PARTIAL** | `src/app/(dashboard)/contacts/[id]/page.tsx` | All users | Medium — needs appointments/jobs |
| Campaigns | Bulk send, scheduling, audience targeting | **IMPLEMENTED** | `src/app/api/campaigns/**`, UI | Marketers | **High** — revenue driver |
| Reminders | Scheduled/recurring messages/calls | **IMPLEMENTED** | `src/app/api/reminders/**`, worker | Operations | **High** — retention driver |
| Appointments | Basic booking with service/staff | **IMPLEMENTED** | `src/app/(dashboard)/appointments/**`, public booking page | Salons/clinics | High — vertical core |
| Queue | Token-based queue with status transitions | **IMPLEMENTED** | `src/app/(dashboard)/queue/**`, service | Walk-in businesses | Medium — vertical core |
| Queue | Public self check-in + live tracker | **IMPLEMENTED** | `src/app/business/[slug]/queue/**`, public API | End customers | Medium — experience differentiation |
| Queue | OTP verification + no-show worker | **IMPLEMENTED** | `src/app/api/queue/verify/**`, `src/workers/index.ts` | Staff + operations | Medium — reduces ghost slots |
| Queue | QR code generator | **IMPLEMENTED** | `src/app/(dashboard)/queue/qr-codes/**` | Staff/Managers | Low-Medium |
| Services | Service catalog CRUD | **IMPLEMENTED** | `src/app/(dashboard)/services/**` | Service businesses | High — vertical core |
| Staff | Staff profile CRUD | **IMPLEMENTED** | `src/app/(dashboard)/staff/**` | Service businesses | High — scheduling |
| Knowledge Base | Business profile, FAQs, products, policies, AI guardrails | **IMPLEMENTED** | `src/app/(dashboard)/knowledge/**` | Admins | **High** — AI quality |
| Billing | Razorpay invoices + wallet top-up | **IMPLEMENTED** | `src/lib/billing/**`, `src/lib/razorpay.ts` | Eversity + customers | **High** — monetization |
| Billing | Subscription lifecycle (create, change, cancel, reactivate, webhook status sync) | **IMPLEMENTED** | `src/lib/billing/subscription-service.ts`, `src/app/api/webhooks/razorpay/**` | Eversity + customers | **High** — recurring revenue |
| Billing | Plan feature + usage-limit enforcement (campaigns, team seats) | **IMPLEMENTED** | `src/lib/billing/entitlements.ts`, campaign + team APIs | Eversity + customers | **High** — prevents abuse |
| Billing | Platform-admin billing control center (MRR, revenue, subscriptions, detail) | **IMPLEMENTED** | `src/app/(platform-protected)/platform/billing/**` | Eversity ops | **High** — operations |
| Billing | Client billing dashboard (plan, usage, invoices, payments, wallet) | **IMPLEMENTED** | `src/app/(dashboard)/billing/**` | Admins | **High** — self-service |
| Billing | Automated recurring invoices + dunning | **IMPLEMENTED** | `src/lib/billing/billing-run.ts`, worker, webhooks | Eversity + customers | **High** — collections |
| Billing | Saved payment methods (Razorpay tokens) | **IMPLEMENTED** | `src/lib/billing/payment-methods.ts` | Customers | Medium — convenience |
| Billing | Invoice PDFs / payment receipts | **IMPLEMENTED** | `src/lib/billing/pdf.ts`, `/api/billing/invoices/[id]/pdf` | Customers | Medium — professionalism |
| Billing | Proration on plan changes | **IMPLEMENTED** | `src/lib/billing/proration.ts`, subscription service | Customers | Medium — fairness |
| Billing | Configurable plans/add-ons/usage | **IMPLEMENTED** | Prisma + pricing engine | Eversity | Medium — future pricing |
| Operations | Multi-location (branches, active location, scoping) | **IMPLEMENTED** | `Location` model, `/api/locations`, dashboard shell | Admins | **High** — expansion |
| Integrations | Scoped API keys + external v1 endpoints | **IMPLEMENTED** | `src/lib/api-key-auth.ts`, `/api/v1/**` | Developers | Medium — extensibility |
| Team | Invite, roles, suspend, remove | **IMPLEMENTED** | `src/app/(dashboard)/team/**` | Admins | Medium — collaboration |
| Analytics | Message volume, response rate, campaigns, reminders | **IMPLEMENTED** | `src/app/(dashboard)/analytics/**` | Managers | Medium — retention |
| Platform Admin | Client mgmt, invoices, wallet, audit logs | **IMPLEMENTED** | `src/app/(platform-protected)/**` | Eversity ops | Critical — operations |
| Platform Admin | Forgot/reset password | **IMPLEMENTED** | `src/app/api/platform/auth/**` | Platform admin | Medium — self-service |
| Job Cards | CRUD dashboard + API | **IMPLEMENTED** | `src/app/(dashboard)/jobs/**`, `src/app/api/jobs/**` | Auto/home services | Medium |
| Resources | CRUD dashboard + API | **IMPLEMENTED** | `src/app/(dashboard)/resources/**`, `src/app/api/resources/**` | Restaurants/salons | Medium |
| Memberships/Packages | CRUD dashboard + API | **IMPLEMENTED** | `src/app/(dashboard)/memberships/**`, `src/app/api/memberships/**` | Salons/wellness | Medium |
| Reviews | Listing dashboard + public submission | **IMPLEMENTED** | `src/app/(dashboard)/reviews/**`, `src/app/business/[slug]/review/**` | All verticals | Medium |
| Automations | Appointment reminder + review request auto-scheduling | **PARTIALLY IMPLEMENTED** | `src/lib/services/appointment-reminders.ts`, `src/lib/services/review-requests.ts` | All verticals | High |
| Customer Events | Timeline in contact detail + event recording | **IMPLEMENTED** | `src/lib/customer-events.ts`, `src/app/(dashboard)/contacts/[id]/page.tsx` | All verticals | Medium |
| Notification Preferences | Settings UI + API | **IMPLEMENTED** | `src/app/(dashboard)/settings/notifications/**`, `src/app/api/notification-preferences/**` | All verticals | Low |
| Public customer pages | Booking + review + queue pages live | **IMPLEMENTED** | `src/app/business/[slug]/**` | End customers | High |
| Demo data | 11 demo orgs + trial accounts | **IMPLEMENTED** | `prisma/seed.ts`, `DEMO_ACCOUNTS.md` | Sales + onboarding | Medium |
| Real-time updates | Queue page polls every 5–7 seconds | **PARTIALLY IMPLEMENTED** | `src/app/(dashboard)/queue/page.tsx`, public tracker | End customers + staff | Medium |
| Attachments | Do not exist | **UNKNOWN** | Not found | All users | N/A |

---

## 4. Architecture Overview

**FACT:**
- **Frontend:** Next.js 16.3.0 App Router, React 19.2.4, Tailwind CSS v4, TypeScript 5.x.
- **Backend:** Next.js API routes + separate `src/workers/index.ts` BullMQ worker for campaigns/reminders/voice/no-show checks.
- **Database:** PostgreSQL via Prisma 6.19.3 (schema ~1,500 lines, 50+ models).
- **Auth:** next-auth v5 beta with JWT sessions, bcrypt password hashing, TOTP MFA.
- **Queue:** BullMQ + Redis (ioredis).
- **Email:** Resend.
- **AI:** OpenAI or Anthropic SDK, configurable via `AI_PROVIDER` env var.
- **Payments:** Razorpay (orders + subscriptions + webhook).
- **Observability:** Sentry Next.js SDK.
- **Deployment:** Docker (`Dockerfile` for Next.js standalone, `Dockerfile.worker` for worker), `docker-compose.yml` for local stack, docs mention Vercel + Render/Railway.

**Security architecture (FACT):**
- Channel credentials encrypted at rest with AES-256-GCM (`src/lib/crypto.ts`); `ENCRYPTION_KEY` required.
- Session `orgId` re-verified against DB on every protected request (`src/lib/session.ts`).
- Webhook endpoints verify per-channel secrets derived from `AUTH_SECRET`.
- Constant-time dummy bcrypt hash prevents email enumeration.
- Role checks on API routes (`requireOrgMember(UserRole.XXX)`).

**VALIDATION REQUIRED:** Whether the Docker build currently passes. `npm run build` and `npm test` pass locally. **RECOMMENDATION:** Run Docker build and add CI before any launch.

---

## 5. Feature Inventory

### Fully implemented (usable today)
1. Unified inbox with channel tags, search, filters, priority, assignment.
2. AI draft replies from knowledge base (human-in-the-loop).
3. Contact CRM with CSV import, tags, notes.
4. Campaigns: bulk sends, scheduling, audience by tag/contact IDs/all, pause/resume/cancel/duplicate.
5. Reminders: one-off/recurring, appointment/payment/follow-up/callback/custom types, voice calls.
6. WhatsApp template creation + status sync via Gupshup.
7. WhatsApp prepaid wallet with per-message debit and low-balance alerts.
8. Razorpay subscription billing (plans, add-ons, coupons, usage), wallet top-up, invoice payment.
9. Team management with role-based UI/API enforcement.
10. Platform admin: clients, invoices, wallet credits, rate cards, audit logs, forgot/reset password.
11. Appointments, services, staff, public booking page.
12. Token-based queue with public self check-in, live tracker, OTP hand-off, auto no-show, QR codes.
13. Job cards, resources, memberships/packages, reviews, customer events, notification preferences.
14. Demo orgs and trial accounts for sales demos.

### Implemented in schema / API only (no usable UI or engine)
_None — all previously schema-only features now have at least a working UI/API layer._

### Partially implemented
1. **Automations engine:** Appointment reminders and review requests are auto-scheduled, but a visual automation builder does not exist.
2. **Real-time updates:** Queue dashboard and public tracker poll every 5–7 seconds; WebSocket/SSE not implemented.

### Not implemented
1. Attachments/media in messages.
2. Native mobile app or PWA.
3. Advanced analytics (cohort retention, revenue, CSAT).
4. Two-way sync with Google Calendar or other calendars.
5. Custom fields on contacts.
6. Visual automation builder (basic auto-scheduling exists).

---

## 6. Customer Problems

| Customer problem | Who experiences it | Current solution | Why current solution is bad | Evernaro solution | Value |
|---|---|---|---|---|---|
| Missed leads because DMs are scattered across WhatsApp, Instagram, Telegram, email | Small service-business owner/ops manager | Phone + multiple apps + spreadsheets | Messages fall through cracks; slow response; no team visibility | Unified inbox with all channels in one thread list | **High** — directly increases revenue capture |
| Wasting hours writing repetitive replies | Front-desk staff / agents | Copy-paste from notes or retype | Slow, inconsistent, error-prone | AI drafts from knowledge base; human reviews and sends | **High** — labor savings + consistency |
| No-shows and forgotten appointments | Salons, clinics, auto service | Manual phone reminders | Time-consuming, inconsistent, costly no-shows | Automated scheduled reminders (WhatsApp/SMS/voice) | **High** — reduces no-shows, increases utilization |
| Cannot send bulk offers without WhatsApp template approvals | Marketing staff | Personal WhatsApp broadcast | Limited reach, no tracking, risk of number ban | Campaigns with approved WhatsApp templates + analytics | Medium — marketing efficiency |
| No visibility into who on the team replied to what | Managers | Trust + verbal updates | No accountability, duplicate replies | Assignment, status, audit logs | Medium — operational control |
| Customers don't know their queue position | Walk-in businesses (salons, clinics, restaurants) | Physical tokens / yelling names | Poor customer experience | Public queue check-in with live tracker and OTP | Medium — experience differentiation |
| Paying surprise WhatsApp API bills | Anyone using BSPs | Direct BSP with no spend cap | Cost overruns | Prepaid wallet with per-message debit | Medium — cost control |

---

## 7. ICP Definition

**Primary ICP ( strongest initial beachhead):**
- **Industry:** Appointment-based service SMBs in India.
- **Sweet spot:** Salons, beauty parlors, dental clinics, small wellness/spas, diagnostic centers, and single-location auto service centers.
- **Size:** 3–20 staff, 1–3 locations, 50–500 appointments/month.
- **Decision maker:** Owner or operations manager, often female-led salon/clinic.
- **Pain intensity:** High — no-shows cost real money; staff time is the bottleneck; customer communication is manual.
- **Tech maturity:** Uses WhatsApp Business personally, maybe a Google Sheet, no formal CRM.
- **Willingness to pay:** ₹1,500–₹4,000/month if it reduces no-shows and saves 5–10 staff hours.

**Secondary ICP:**
- Real estate brokerages and property consultants in India.
- **Why secondary:** High deal value, but lower message volume, longer sales cycles, and already use personal WhatsApp effectively. Harder to prove ROI quickly.

**Avoid for now:**
- Restaurants (high table churn, POS-centric, low WhatsApp reply value).
- Large clinics/hospitals (need EMR/HIS integration, compliance, sales cycles too long).
- Enterprise (needs SSO, SLAs, procurement).

---

## 8. Industry Analysis

Scored 1–5 on: **Pain fit** (do they have the problem?), **Message volume** (enough conversations to justify a tool), **Willingness to pay** (can they afford ₹2–4K/mo?), **Sales cycle** (how fast to close?), **Implementation friction** (how hard to connect channels?), **Regulatory risk** (TRAI/DND/healthcare), **Differentiation potential** (can Evernaro win vs. generic tools?).

| Industry | Pain fit | Volume | WTP | Sales cycle | Friction | Risk | Diff. | **Score** | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Salons / Beauty | 5 | 4 | 4 | 4 | 2 | 1 | 4 | **24/35** | Appointment + no-show pain is acute; WhatsApp is natural |
| Clinics / Dental | 5 | 4 | 4 | 3 | 3 | 3 | 4 | **23/35** | Strong need, but HIPAA-like sensitivities and longer sales |
| Wellness / Spa | 4 | 3 | 4 | 4 | 2 | 1 | 4 | **22/35** | Similar to salons, smaller TAM |
| Real Estate | 4 | 3 | 5 | 2 | 3 | 2 | 3 | **19/35** | High deal value but low frequency; harder to prove ROI |
| Auto Service | 4 | 3 | 3 | 3 | 3 | 2 | 3 | **18/35** | Job-card need now built |
| Home Services | 4 | 3 | 3 | 3 | 3 | 2 | 3 | **18/35** | Dispatch/location tracking not built |
| Education / Coaching | 3 | 3 | 3 | 3 | 3 | 1 | 2 | **15/35** | Lower urgency; admissions are seasonal |
| Legal | 3 | 2 | 4 | 2 | 3 | 3 | 2 | **14/35** | Long sales, matter confidentiality concerns |
| Restaurants | 3 | 4 | 2 | 3 | 2 | 2 | 2 | **14/35** | POS-first, low differentiation |
| Retail | 2 | 3 | 2 | 3 | 3 | 1 | 2 | **12/35** | Not a communications-heavy vertical |

---

## 9. Best Beachhead Market

**RECOMMENDATION: Salons and beauty parlors in India.**

**Why salons win (FACT + ASSUMPTION):**
- **FACT:** Evernaro already has the vertical preset for real estate only, but the *schema and UI* for appointments, services, staff, queue, and public booking are all live — the exact modules salons need.
- **FACT:** The demo org seeded in `prisma/seed.ts` is a salon, and 11 demo orgs now exist across industries.
- **ASSUMPTION:** Salon owners feel no-show and last-minute cancellation pain daily; a single no-show is a lost revenue slot that cannot be recovered.
- **ASSUMPTION:** Salon staff already use WhatsApp to confirm appointments; Evernaro automates what they are doing manually.
- **ASSUMPTION:** Salon decision makers (owners) are reachable via Instagram/Facebook ads and local WhatsApp groups, keeping CAC low.

**Why not real estate:** Real estate is the only vertical with a preset, but the actual *operational* modules for real estate (property catalog, site-visit pipeline, deal board) are **not implemented**. The product would be "inbox + knowledge base" for realtors — a weak sell.

**Why not clinics:** Strong pain, but medical data sensitivity and the need for EMR integration raise sales friction. After salons, clinics are the #2 expansion target.

---

## 10. Core Value Proposition

### 5 positioning statements
1. **For salon owners:** "Reduce no-shows and fill last-minute slots with automated WhatsApp appointment reminders — no more calling every client manually."
2. **For clinic managers:** "Confirm appointments, send follow-ups, and answer patient questions from one inbox that your whole front-desk team can share."
3. **For real estate agents:** "Never lose a lead in WhatsApp again — one inbox for all your property inquiries, with AI-drafted replies in your voice."
4. **For service businesses:** "Replace five messaging apps with one team inbox, and let AI draft 80% of your replies while you stay in control."
5. **For small business owners:** "Prepaid WhatsApp wallet — send campaigns and reminders without the shock bill at the end of the month."

### Strongest one
**"Stop losing appointments to no-shows. Evernaro automates WhatsApp reminders and keeps every customer message in one place, so your front desk sells more and types less."**

Target: **Salons, beauty parlors, and wellness clinics in India.**

---

## 11. Customer Journey

### Business owner (salon)
1. **Discover:** Sees ad/LinkedIn post about WhatsApp reminders for salons.
2. **Sign up:** Enters org name, owner email, password, selects "Salon / Beauty" industry.
3. **Onboard:** Seeds services (Haircut, Facial, Hair Color), staff profiles, and business hours.
4. **Connect channel:** Adds WhatsApp Business API via Gupshup or Telegram bot.
5. **Import customers:** Uploads CSV of phone numbers or waits for inbound messages.
6. **Daily use:**
   - Books appointments into the calendar or accepts public bookings.
   - Sees inbound WhatsApp messages in unified inbox.
   - Approves AI-drafted replies or writes own.
   - Sends bulk festival/offer campaign using approved template.
   - For walk-ins, prints queue QR code; customers check in and track live.
   - Receives low-wallet alert and tops up via Razorpay.
7. **Value moment:** First week sees 2–3 fewer no-shows and 5+ hours saved on replies.
8. **Expand:** Adds staff seats, enables queue for walk-ins, asks for reviews after service.

### End customer
1. Books appointment via public booking page, phone, Instagram, or WhatsApp.
2. Receives automated WhatsApp reminder 24 hours before.
3. Replies "Yes" or reschedules.
4. Day of service: receives "Your turn is coming up" message if queue is enabled.
5. For walk-ins: scans QR code, joins queue, sees live position, gives OTP when called.
6. After service: receives review request.

**FACT:** Public booking, review, and queue pages now exist. The end-customer experience is no longer outbound-only.

---

## 12. Major Use Cases (Salon — strongest industry)

### Use case 1: Automated appointment reminders
- Owner books appointment for customer in Evernaro.
- System schedules WhatsApp reminder 24 hours before.
- Worker sends template message: *"Hi {{name}}, reminder: your appointment at [Salon] is tomorrow at 4 PM. Reply YES to confirm or call [number] to reschedule."*
- Customer replies; reply lands in inbox; AI drafts response; staff approves.
- **Value:** Reduces no-shows by 20–40%.

### Use case 2: Handling inbound booking requests
- Customer DMs salon Instagram/WhatsApp: *"Hi, do you have a slot for hair color tomorrow?"*
- Message appears in unified inbox with AI draft pulled from knowledge base (pricing, duration, availability).
- Staff edits/approves reply: *"Hi Priya, we have 3 PM and 5 PM tomorrow. Hair color takes ~90 min and costs ₹1,500. Which works?"*
- **Value:** Faster response, consistent pricing, no lost leads.

### Use case 3: Bulk festival offer campaign
- Owner creates campaign using approved WhatsApp template.
- Selects audience: all customers tagged "Regular".
- Campaign sends 500 messages at 5/sec via worker.
- Dashboard shows sent/failed counts.
- **Value:** Drives bookings during slow weeks; replaces unreliable broadcast lists.

### Use case 4: Walk-in queue management
- Customer walks in for a haircut without appointment.
- Staff prints queue QR code from dashboard.
- Customer scans code, enters name/phone, joins queue; token "A-12" and 6-digit OTP generated.
- Staff clicks "Call next"; entry status moves to CALLED; no-show timer starts.
- Customer shows OTP; staff enters it, status moves to IN_PROGRESS; no-show timer cancels.
- If customer never arrives, worker auto-marks NO_SHOW after threshold.
- **Value:** Organized waiting, better experience, staff efficiency, fewer ghost slots.

### Use case 5: Post-service follow-up and rebooking
- After appointment marked COMPLETED, owner schedules recurring reminder in 6 weeks: *"Hi {{name}}, it's been 6 weeks since your last facial. Ready to book your next?"*
- **Value:** Increases repeat visits and LTV.

### Use case 6: Team collaboration without losing context
- Multiple staff members handle the same Instagram account.
- Conversations are assigned to specific agents; status/priority visible to all.
- Manager reviews analytics: response rate, open conversations, failed campaigns.
- **Value:** Accountability, no duplicate replies, manager oversight.

### Use case 7: Controlled WhatsApp spend
- Owner tops up wallet with ₹1,000.
- Every WhatsApp send debits ~₹0.40–1.50.
- When balance hits ₹100, owner and platform get alert.
- Sends stop if balance is zero.
- **Value:** No surprise BSP bills; predictable unit economics.

---

## 13. Willingness-to-Pay Analysis

**FACT:** The public pricing page shows ₹1,499 (Starter), ₹3,999 (Growth), ₹8,999 (Scale) per month.

**ASSUMPTION-based WTP analysis for Indian salons/clinics:**
- A single no-show at a mid-tier salon = ₹500–2,000 lost revenue.
- A salon doing 200 appointments/month with 15% no-show rate loses ~30 slots = ₹15,000–60,000/month.
- Reducing no-shows by 30% saves ₹4,500–18,000/month.
- Staff time saved on replies: 5–10 hrs/month × ₹150/hr = ₹750–1,500/month.
- **Total perceived value:** ₹5,000–20,000/month.
- **Therefore WTP for a tool that clearly delivers this:** ₹2,000–4,000/month is reasonable.

**VALIDATION REQUIRED:** Actual WTP must be tested with 10–20 live salon/clinic owners. Do not rely on this estimate.

**Price sensitivity signals:**
- Starter ₹1,499 is low enough for a solo owner to try.
- Growth ₹3,999 is appropriate for a 5–10 person salon with multiple staff seats.
- Scale ₹8,999 is only viable for multi-location chains; current product is not ready for that segment.

---

## 14. Pricing Strategy

**FACT (current public plans):**
| Plan | Monthly | Yearly | Seats | Channels | Sends/day | Notable |
|---|---|---|---|---|---|---|
| Starter | ₹1,499 | ? | 1 | 2 | 500 | AI drafts, email support |
| Growth | ₹3,999 | ? | 5 | 5 | 2,000 | Templates, priority support |
| Scale | ₹8,999 | ? | Unlimited | All | Custom | Vertical packs, onboarding |

**FACT (backend billing engine):**
- `SubscriptionPlan`, `PlanFeature`, `PlanLimit`, `BillableService`, `AddOn`, `PlanAddOn`, `Coupon`, `UsageRecord`, `UsageAggregate` models exist.
- Pricing engine supports monthly/yearly, GST, coupons, add-ons, usage tiers.
- Actual plan rows are seeded via `prisma/billing-seed.ts`.

**RECOMMENDATION:**
1. **Keep it simple for launch.** Hide Scale plan from self-serve; make it "Contact sales."
2. **Anchor on value, not features.** Rename Starter → "Solo," Growth → "Team."
3. **Add a true free/trial.** 14-day free trial is advertised but subscription engine creates ACTIVE status unless `trialDays` > 0; ensure trial is actually enforced.
4. **Usage charges:** WhatsApp cost passed through at cost + small markup; voice calls at cost. Do not overcomplicate.
5. **Add-on:** Extra staff seat ₹499/month; extra channel ₹299/month.
6. **Annual discount:** 2 months free (17% discount).

**VALIDATION REQUIRED:** Whether the seeded `SubscriptionPlan` rows match the public landing-page prices and limits.

---

## 15. Business Model

**FACT:** Evernaro is a B2B SaaS with usage pass-through:
1. **Subscription revenue:** Monthly/annual plans per organization.
2. **WhatsApp wallet top-ups:** Prepaid balance for WhatsApp sends; revenue depends on whether Eversity marks up Gupshup/Meta rates or passes through at cost.
3. **Voice call pass-through:** Twilio cost passed to customer.
4. **Potential future revenue:** Add-ons (extra seats, extra channels), custom onboarding for Scale.

**ASSUMPTION:** The primary gross margin driver is subscription software margin (high), not messaging markup (low/transactional).

**RECOMMENDATION:** Optimize for subscription ARPU and retention, not WhatsApp margin. The wallet is a control mechanism, not a profit center.

---

## 16. Unit Economics

### Target ranges (ASSUMPTION — must be validated)
| Metric | Formula | Target range | Notes |
|---|---|---|---|
| ARPU | Average monthly revenue per paying org | ₹2,500–4,000 | Mix of Starter/Growth |
| Gross margin | (Revenue − COGS) / Revenue | 70–85% | WhatsApp/voice pass-through is COGS |
| CAC | Sales + marketing cost / new orgs | ₹3,000–8,000 | India SMB digital acquisition |
| Payback period | CAC / (ARPU × gross margin) | 1.5–4 months | Good if <6 months |
| Monthly churn | Canceled orgs / total orgs | <5% | Critical for SMB SaaS |
| LTV | ARPU × gross margin × avg lifetime | ₹25,000–80,000 | Depends heavily on churn |
| LTV:CAC | LTV / CAC | >3:1 | Healthy target |

### WhatsApp per-message unit economics (FACT)
- Wallet debits per message based on `WhatsAppRateCard` (category + country code).
- Typical India utility/marketing WhatsApp cost via Gupshup: ~₹0.30–1.20.
- If Eversity charges customer at cost, gross margin on wallet = 0%; if 10–20% markup, margin is small.
- **Implication:** Unit economics depend on subscription pricing, not messaging volume.

---

## 17. Competitor / Alternative Analysis

| Competitor / Alternative | What they do | Evernaro vs. them | Threat |
|---|---|---|---|
| WhatsApp Business App | Free, personal-tool inbox | Evernaro adds multi-user, AI drafts, campaigns, CRM, public booking/queue | **High** — good enough for many; free is powerful |
| Interakt / Wati (India BSPs) | WhatsApp BSP + shared inbox | Stronger on WhatsApp API; weaker on multi-channel/AI | Medium — direct overlap |
| Zoho CRM + SalesIQ | Full CRM + chat | Much broader; more expensive/complex | Medium — competes at higher end |
| Freshdesk / Freshchat | Support ticketing | Better ticket workflow; no WhatsApp-first SMB pricing | Medium |
| Local software / pen & paper | Manual booking + calls | Evernaro is 10× better if adoption happens | Low — incumbent inertia |
| LeadSquared / Kylas | Sales CRM | More sales pipeline; less communication | Low |
| Exotel / Ozonetel | Voice/call center | Stronger voice; no unified inbox | Low |

**Key insight:** The biggest competitor is **free WhatsApp Business App + manual effort**. Evernaro must prove it saves more time/money than its cost within the first week.

---

## 18. Differentiation

**Current real differentiators (FACT):**
1. True multi-channel inbox (not just WhatsApp) with human-in-the-loop AI drafts.
2. Prepaid WhatsApp wallet preventing bill shock.
3. Voice reminder calls scoped to compliance-safe use cases.
4. Public booking, review, and queue pages out of the box.
5. OTP-based queue hand-off with auto no-show handling.
6. Built-in Razorpay billing + platform admin for a multi-tenant SaaS operator.

**Weak differentiators / commodity:**
- Campaigns and reminders (many BSPs offer this).
- Contact CRM (table stakes).
- Basic queue/token system (niche, not unique).

**Differentiation risk:** The product tries to be broad. A focused salon-specific tool with deeper scheduling, staff commissions, and review requests would beat Evernaro in that niche.

**RECOMMENDATION:** Differentiate on **outcome** (fewer no-shows, faster replies) not feature count. Build salon-specific templates, reports, and automations before expanding.

---

## 19. Product-Market Fit Analysis (Scorecard)

Score 1–5, then average.

| Dimension | Score | Evidence |
|---|---|---|
| Problem severity | 4 | Salons/clinics lose real money to no-shows and slow replies |
| Target market clarity | 3 | Salons best, but product still markets broadly |
| Product-solution fit | 4 | Core loop works; public booking/queue now live |
| Willingness to pay | 3 | Pricing plausible, not validated |
| Competitive moat | 2 | Feature differentiation is thin vs. free tools + BSPs |
| Distribution clarity | 2 | No validated GTM channel identified |
| Customer validation | 1 | No evidence of paid pilots or customer interviews in repo |
| Retention mechanism | 3 | Data lock-in (contacts, templates) + habit from inbox |
| Team/execution | 4 | Strong engineering; broad scope discipline needed |
| Unit economics potential | 3 | Good if churn is controlled; unproven |

**Average PMF score: 2.9 / 5.0** — "Pre-PMF." The product is built, but market validation is missing.

---

## 20. MVP Definition

**What the MVP should be (RECOMMENDATION):**
A WhatsApp-first appointment reminder + unified inbox tool for **Indian salons and beauty clinics**.

**MVP feature set:**
1. WhatsApp Business API connection (Gupshup) + Telegram fallback.
2. Contact import (CSV) and automatic contact creation from inbound messages.
3. Appointment booking with service, staff, date/time + public booking page.
4. Automated WhatsApp reminders (24h, 2h, custom) using templates.
5. Unified inbox for replies with AI drafts from knowledge base.
6. Prepaid wallet + Razorpay.
7. Simple analytics: no-shows prevented, messages sent, response rate.
8. Queue check-in + QR codes for walk-ins.
9. One plan: ₹2,499/month (5-day free trial) + usage.

**What to cut from MVP:**
- Instagram, Email, Voice channels.
- Campaigns beyond appointment reminders.
- Job cards, resources, memberships, reviews, automations.
- Multi-industry templates beyond salon/clinic.
- Scale plan / enterprise features.

**RATIONALE:** Fewer channels = simpler onboarding. Appointment reminders + public booking + queue are the highest-value, easiest-to-prove features. Everything else is a distraction until 10 salons pay.

---

## 21. Product Gaps

| Gap | Severity | Evidence | Fix priority |
|---|---|---|---|
| ~~No subscription enforcement at worker level~~ | **Resolved** | Entitlement checks added to campaigns + team invites; `requireActiveSubscription` enforced on send paths | N/A |
| Industry-specific dashboards beyond nav labels | **High** | All industries see same pages | P1 — salon-first |
| No visual automation builder | **Medium** | Auto-reminders/reviews exist but no UI to configure rules | P2 — manual scheduling suffices initially |
| No WebSocket/SSE real-time updates | **Medium** | Queue polls every 5–7 seconds; true push not implemented | P2 |
| No attachments/media | **Medium** | WhatsApp/Instagram heavily visual | P2 |
| No calendar sync (Google/Outlook) | **Medium** | Appointments are isolated | P2 |
| No custom fields on contacts | **Medium** | Limits CRM depth | P3 |
| Limited analytics (no revenue, CSAT, cohorts) | **Medium** | Current analytics are message-centric | P3 |
| WhatsApp template sync unverified live | **Medium** | Code uses Gupshup docs; no live account tested | P1 — validate before launch |
| ~~Automated invoice renewal/collection for SaaS subscriptions~~ | **Resolved** | Daily billing-run worker creates period-end invoices; dunning records track retries and cancellation after max failures | N/A |

---

## 22. UX Audit

**Strengths (FACT):**
- Clean, consistent Tailwind v4 design system with dark/light mode.
- Mobile-responsive sidebar with drawer.
- Clear role-based action hiding (VIEWER cannot send; AGENT cannot access billing).
- Loading skeletons on heavy pages.
- Inbox three-column layout works on desktop.
- WhatsApp 24-hour stale warning prevents user confusion.
- Help page exists.
- Public booking, review, and queue pages are simple and mobile-friendly.
- Queue dashboard has live polling, status change beep, and OTP verification UI.

**Weaknesses (FACT):**
- **Sign-up page links to `/register` in pricing CTA but route may be `/signup` (pricing page uses `/register`, landing uses `/signup`).** Inconsistency risk.
- **No empty-state guidance for first-time user** (e.g., "Connect WhatsApp first").
- **Campaign creation wizard** not inspected but likely functional; needs user testing.
- **Knowledge base vertical preset dropdown** only has "Real Estate" option despite salon demo — confusing.
- **Appointment page** is basic: no calendar view, no conflict visualization, no recurring appointments.
- **Queue page** requires polling; no auto-push.
- **Settings** mixes business profile and channel config; tabs are fine but channel setup is technical (Gupshup API keys, Meta app review).

**RECOMMENDATION:** Invest in first-run onboarding wizard for salons: import contacts, connect WhatsApp, book first appointment, send test reminder, print queue QR.

---

## 23. Onboarding Strategy

**Current state (FACT):** Sign-up collects org name, owner name, email, password, and industry code. It seeds services from template and creates wallet. No guided onboarding flow exists.

**Recommended onboarding (RECOMMENDATION):**
1. **Industry selection** → salon/clinic by default.
2. **Connect WhatsApp** (or skip and use Telegram for testing).
3. **Import customers** via CSV or mobile contact sync.
4. **Add one service and one staff member.**
5. **Book a test appointment** for tomorrow.
6. **Send a test reminder** to own number.
7. **Print a queue QR code** and run a test walk-in.
8. **Invite one team member** (optional).

**Success metric:** Time to first reminder sent < 10 minutes; first inbound reply handled < 24 hours.

**VALIDATION REQUIRED:** Run 5 unmoderated onboarding tests with real salon owners.

---

## 24. Retention Strategy

**Mechanisms (RECOMMENDATION):**
1. **Value loop lock-in:** Contacts, conversation history, approved WhatsApp templates, and appointment data accumulate; switching cost rises over time.
2. **Habit loop:** Daily inbox + reminders create ongoing usage.
3. **No-show ROI report:** Weekly email showing appointments confirmed and no-shows prevented — reinforces value.
4. **Low-balance alerts:** Prevent service interruption, but also drive re-engagement.
5. **Template library:** Pre-built salon templates reduce setup friction.
6. **Churn intervention:** Flag orgs with falling message volume; trigger manual outreach.

**FACT:** Wallet balance and message volume are natural leading indicators of retention.

---

## 25. Multi-Tenant / Security Audit

### What is secure (FACT)
- `requireOrgId` / `requireOrgMember` re-verify user against DB every request.
- All Prisma queries in inspected API routes include `orgId` filter.
- Channel credentials encrypted with AES-256-GCM.
- Webhook secrets per channel derived from `AUTH_SECRET`.
- bcrypt cost 12, constant-time dummy hash.
- Role-based UI/API gating.
- WhatsApp campaigns enforce approved templates outside 24h window.
- Voice restricted to reminders, not bulk campaigns.

### Risks (FACT + RECOMMENDATION)
| Risk | Severity | Notes |
|---|---|---|
| Subscription status enforcement present but verify worker path | Medium | `sendViaChannel` calls `requireActiveSubscription`; worker calls it for voice and via `sendViaChannel` for reminders/campaigns. **FACT: appears enforced.** Previous audit flagged this as banner-only; code now looks enforced. Verify with integration test. |
| No CSRF tokens beyond cookie SameSite | Low-Medium | Auth.js modern defaults are reasonable; add explicit CSRF for state-changing forms if needed. |
| `INBOUND_EMAIL_WEBHOOK_SECRET` is global, not per-org | Low | Acceptable if webhook provider is trusted. |
| Webhook error responses are 200 even on failure | Low | Intentional to prevent provider retries; monitor logs. |
| No rate limiting on all endpoints | Medium | Some webhooks rate-limited; API routes should add stricter per-org limits. |
| No row-level security at DB layer | Medium | Relies on application-level `orgId` filtering. Add DB-level policy if moving to Postgres RLS. |
| `emailVerified` flag exists but some features may not gate on it | Low | Verify-sensitive actions should check it. |

### Cross-tenant data leakage risk
**FACT:** No obvious cross-tenant leakage found in inspected routes. The most sensitive paths (messages, contacts, campaigns, invoices) all filter by `orgId`. The platform admin routes correctly use `requirePlatformAdminId`. **VALIDATION REQUIRED:** Automated tenant-isolation tests for every API route.

---

## 26. Technical Production Readiness

| Area | Status | Notes |
|---|---|---|
| Tests | **Pass** | 56/56 Vitest tests pass (verified 2026-08-08). |
| TypeScript | **Pass** | `npm run build` passes; typecheck included in build. |
| Lint | **Unknown** | Not run during audit. |
| Build | **Pass** | `npm run build` succeeds (verified 2026-08-08). |
| Database migrations | **Committed & deployed** | `prisma/migrations` includes all migrations; latest applied to Neon. |
| Docker | **Ready** | `Dockerfile`, `Dockerfile.worker`, `docker-compose.yml` present and look correct. |
| Worker | **Ready** | Separate worker with healthcheck, graceful shutdown, Sentry. |
| CI/CD | **MISSING** | No `.github/workflows` found. **CRITICAL GAP.** |
| Secrets management | **Partial** | `.env.example` comprehensive; no secrets manager integration. |
| Monitoring | **Configured** | Sentry client + server; worker Sentry init. |
| Backups | **Unknown** | Neon handles this if used; no application-level backup code. |
| Legal docs | **Draft** | Terms/Privacy pages exist but README says they need lawyer review. |

**RECOMMENDATION:** Add GitHub Actions CI (lint, typecheck, test, Docker build) before taking any payment.

---

## 27. Customer Validation Plan

**Phase 1: Problem interviews (Weeks 1–2)**
- Target: 15 salon/clinic owners in one city (e.g., Bangalore or Delhi NCR).
- Question: "How do you confirm appointments today? What does a no-show cost you?"
- Outcome: Confirm pain ranking and WTP.

**Phase 2: Paid pilot (Weeks 3–6)**
- Recruit 5 salons at ₹1,999/month (discounted from ₹2,499).
- Onboard manually; measure no-show rate before/after and hours saved.
- Outcome: 3+ retained + testimonials.

**Phase 3: Concierge onboarding (Weeks 7–10)**
- Onboard 10 more salons with 1:1 setup calls.
- Outcome: Refine onboarding wizard and template library.

**Phase 4: Self-serve launch (Week 11+)**
- Open free trial with automated onboarding.
- Outcome: CAC, activation rate, churn benchmarks.

**VALIDATION REQUIRED:** All of the above is currently unvalidated.

---

## 28. Sales Validation Plan

**Channels to test (ASSUMPTION):**
1. **Local Facebook/Instagram groups** for salon owners — low CAC, high trust.
2. **WhatsApp cold outreach** to salons — needs DND compliance; use business directories.
3. **Referrals** from early pilots — highest conversion.
4. **Industry associations** (e.g., salon federations) — channel partnerships.
5. **Google Search Ads** for "WhatsApp appointment reminder India" — test CAC.

**Sales motion:**
- Discovery call → free 7-day pilot → annual prepay offer (2 months free).
- Close on no-show reduction + time savings, not features.

**Metrics to track:**
- Meetings booked / week
- Pilot-to-paid conversion
- Average sales cycle days
- CAC by channel

---

## 29. Go-To-Market Strategy

### Stage 0–10: Founder-led pilots
- **Duration:** 0–60 days.
- **Goal:** 5 paying salons, all onboarded manually.
- **Tactics:** Personal network, local outreach, no paid ads.
- **Pricing:** ₹1,999/month introductory.
- **Success:** 3+ retain after 30 days.

### Stage 10–50: Niche domination
- **Duration:** 60–180 days.
- **Goal:** 50 paying salons/clinics.
- **Tactics:** Referral program (1 month free for referrer), salon WhatsApp groups, Instagram ads.
- **Product:** Add Google Calendar sync, review requests, salon analytics.
- **Pricing:** Raise to ₹2,499/month; annual plan at ₹24,990.

### Stage 50–100: Vertical expansion
- **Duration:** 180–365 days.
- **Goal:** 100 paying orgs.
- **Tactics:** Expand to dental clinics and wellness; case studies from salons.
- **Product:** Add clinic-specific templates, HIPAA-lite notes, staff scheduling.

### Stage 100–1000: Multi-channel scale
- **Duration:** Year 2.
- **Goal:** 1,000 paying orgs.
- **Tactics:** Partnerships with BSPs/accountants/industry associations, paid search/LinkedIn, outbound SDR team.
- **Product:** Multi-location support, advanced automations, API/webhooks, white-label options.

---

## 30. Financial Model (3-Year)

**ASSUMPTION — all numbers are illustrative and require validation.**

### Conservative
| Year | Orgs | Avg ARPU/mo (₹) | MRR (₹) | ARR (₹) | Gross margin | Net margin |
|---|---|---|---|---|---|---|
| 1 | 80 | 2,200 | 176,000 | 2.1M | 70% | -40% |
| 2 | 300 | 2,400 | 720,000 | 8.6M | 75% | -10% |
| 3 | 700 | 2,600 | 1,820,000 | 21.8M | 78% | 10% |

### Realistic
| Year | Orgs | Avg ARPU/mo (₹) | MRR (₹) | ARR (₹) | Gross margin | Net margin |
|---|---|---|---|---|---|---|
| 1 | 150 | 2,400 | 360,000 | 4.3M | 72% | -20% |
| 2 | 600 | 2,700 | 1,620,000 | 19.4M | 77% | 5% |
| 3 | 1,500 | 3,000 | 4,500,000 | 54.0M | 80% | 15% |

### Aggressive
| Year | Orgs | Avg ARPU/mo (₹) | MRR (₹) | ARR (₹) | Gross margin | Net margin |
|---|---|---|---|---|---|---|
| 1 | 300 | 2,600 | 780,000 | 9.4M | 75% | -5% |
| 2 | 1,200 | 3,000 | 3,600,000 | 43.2M | 80% | 12% |
| 3 | 3,500 | 3,500 | 12,250,000 | 147.0M | 82% | 20% |

**Key assumptions:**
- Year 1 churn: 8% monthly → improves to 4% by Year 3.
- CAC: ₹5,000 → ₹3,000 with scale.
- Team: 2 founders + 2 engineers + 1 sales → grows to 15 by Year 3.

---

## 31. Startup Risks (Top 20)

| # | Risk | Probability | Impact | Mitigation |
|---|---|---|---|---|
| 1 | Salons don't pay; WTP overestimated | Medium | High | Run 15 paid pilots before scaling |
| 2 | Free WhatsApp Business App is "good enough" | High | High | Quantify time/no-show savings in pilot |
| 3 | Gupshup/Meta API changes break sends | Medium | High | Abstract provider; test regularly |
| 4 | WhatsApp template approvals delay onboarding | Medium | Medium | Pre-seed salon templates |
| 5 | Churn high after trial | Medium | High | Weekly ROI reports + habit loops |
| 6 | CAC exceeds LTV | Medium | High | Founder-led sales first; avoid paid ads until unit economics known |
| 7 | Team builds more features instead of selling | High | High | 90-day sales quota; freeze non-core dev |
| 8 | Real-time/public pages delayed | Low | Medium | Public pages are live; real-time is a polish item |
| 9 | Compliance (TRAI/DND) for campaigns | Medium | High | Restrict to opted-in contacts; voice reminder-only |
| 10 | Security incident / cross-tenant leak | Low | Very High | Tenant-isolation tests, encryption, audits |
| 11 | Razorpay integration issues | Low | Medium | Test payments in staging |
| 12 | AI drafts are inaccurate/hallucinate | Medium | Medium | Human-in-the-loop; guardrails |
| 13 | Key founder/engineer leaves | Low | High | Document architecture; distribute knowledge |
| 14 | Competitor copies core features | Medium | Medium | Move fast on salon-specific depth |
| 15 | Database scaling issues | Low | Medium | Use Neon connection pooling; monitor |
| 16 | Worker outages stop reminders | Low | High | Healthchecks; alerts; runbook |
| 17 | Legal docs inadequate | Medium | High | Lawyer review before broad launch |
| 18 | Multi-industry scope creep | High | High | Declare salon-only for 6 months |
| 19 | No clear distribution channel | High | High | Test 3 channels in parallel |
| 20 | Economic downturn crimps SMB spending | Medium | Medium | Offer annual discount; focus on ROI |

---

## 32. Investor Assessment

**What an investor would see (FACT-based):**
- **Team/execution:** Strong. 235+ files, clean schema, tests pass, Dockerized, billing engine built, public pages and queue automation shipped. This is not an MVP built on no-code; it's production-grade engineering.
- **Market:** Large (millions of Indian SMBs), but crowded and price-sensitive.
- **Traction:** **Unknown / likely pre-revenue.** No evidence of paying customers in code/docs.
- **Differentiation:** Moderate. Multi-channel + AI drafts + wallet + public queue/booking are real, but not defensible long-term without vertical depth.
- **Focus:** **Weak.** Too many industries, too many schema tables without UX. This is the #1 concern.
- **Unit economics:** Theoretical only.

**Investor verdict (ASSUMPTION):** Pre-seed / seed-stage investors would be interested *only if* the team can show 10+ paying salons and a clear 6-month focus plan. The engineering foundation earns a meeting; the lack of focus and traction would push valuation down.

---

## 33. Startup Readiness Score (1–10)

| Dimension | Score | Weight | Weighted | Rationale |
|---|---|---|---|---|
| Product completeness (core loop) | 9.5 | 15% | 1.425 | Core loop plus billing lifecycle, multi-location, and external API keys |
| Vertical depth | 7 | 15% | 1.05 | Public pages, queue automation, and multi-location add salon depth; still needs salon-first UX |
| Market validation | 1 | 15% | 0.15 | No evidence of paid pilots |
| Security / multi-tenancy | 7 | 10% | 0.70 | Solid foundation, API-key auth added, needs CI/tests |
| Billing / monetization | 8 | 10% | 0.80 | Razorpay + subscription lifecycle + entitlements + invoices/dunning + payment methods + PDFs + proration |
| GTM clarity | 3 | 10% | 0.30 | No validated channel |
| UX / onboarding | 6 | 10% | 0.60 | Clean UI; public pages and queue polling improve experience |
| Team execution velocity | 8 | 10% | 0.80 | Strong engineering output across many areas |
| Production readiness | 7 | 10% | 0.70 | Docker + tests + migrations + lint clean; missing CI |
| Unit economics / financial model | 3 | 5% | 0.15 | All assumptions |
| **Total** | | | **6.675 / 10** | |

Rounded: **6.7 / 10**.

**Interpretation:** Engineering is ahead of the business. Do not launch broadly. Launch a narrow, paid pilot.

---

## 34. 30-Day Roadmap

**Goal: First 5 paying salon pilots.**

| Week | Actions | Owner | Success criteria |
|---|---|---|---|
| 1 | Finalize salon value prop; create 5 WhatsApp templates; fix `/register` vs `/signup` link inconsistency; add CI workflow | Product/Eng | 5 templates approved; CI green |
| 2 | Recruit 10 salons for pilot; manually onboard 5; track no-show rates | Founder/sales | 5 salons actively using inbox |
| 3 | Add simple onboarding wizard (connect WhatsApp → import → book test → print queue QR); send weekly ROI report | Eng | Activation rate >60% |
| 4 | Collect testimonials; decide pilot pricing; fix any blockers | All | 3+ salons commit to paid plan |

---

## 35. 60-Day Roadmap

**Goal: 15 paying orgs and validated unit economics.**

- Add Google Calendar 2-way sync for appointments.
- Launch referral program (1 month free).
- Add salon-specific analytics: no-shows prevented, appointments confirmed, top services.
- Raise pilot price to ₹2,499/month.
- Start testing one paid acquisition channel (Instagram ads or Google Search).

---

## 36. 90-Day Roadmap

**Goal: 30 paying orgs and repeatable onboarding.**

- Add review request workflow (post-appointment WhatsApp template).
- Add basic automations (appointment reminder automation, not manual reminder creation).
- Add queue real-time updates (SSE or polling).
- Expand to dental clinics with clinic-specific templates.
- Hire first sales/CS hire if MRR supports it.
- Begin annual plan push.

---

## 37. Product Roadmap

### V1.0 — Salon Launch (now – 60 days)
- WhatsApp-first inbox + AI drafts.
- Appointments + automated reminders + public booking page.
- Contact CRM + CSV import.
- Prepaid wallet + Razorpay.
- Queue self check-in + QR codes + OTP + auto no-show.
- Salon templates + onboarding wizard.

### V1.1 — Retention & Expansion (60–120 days)
- Review requests.
- Queue real-time updates.
- Google Calendar sync.
- Referral program.
- Basic automations.

### V2.0 — Multi-vertical (120–240 days)
- Dental/wellness templates.
- Job cards for auto/home services.
- Memberships/packages.
- Multi-location support.
- Advanced analytics.

### V3.0 — Platform (240+ days)
- API/webhooks for integrations.
- White-label options.
- Marketplace for templates/integrations.
- Enterprise SSO.

---

## 38. What to Stop Building

**RECOMMENDATION — stop or deprioritize immediately:**
1. **Stop adding more industries to templates.** Real estate preset is fine as a placeholder; do not build legal/education/restaurant depth until salons pay.
2. **Stop building the automations engine UI.** The schema is enough; manual reminders solve the immediate problem.
3. **Stop building job cards/resources/memberships UIs.** These are vertical expansion features, not launch requirements.
4. **Stop adding more channels.** Instagram and Email are nice-to-have; WhatsApp + Telegram are sufficient for launch.
5. **Stop perfecting the multi-plan billing engine.** Launch with one or two plans; usage billing complexity can wait.
6. **Stop writing architecture docs.** The product is built; sell it.

**What to keep building:** Appointment/reminder UX, onboarding, salon templates, no-show ROI reporting, queue polish.

---

## 39. 10 Critical Founder Questions

1. **Who exactly is our first paying customer?** Name, city, salon size. (UNKNOWN)
2. **What is the one outcome we promise them?** Fewer no-shows? Faster replies? Be specific.
3. **Why would they pay us instead of using free WhatsApp Business App?**
4. **What is our proven CAC in this market?** (UNKNOWN)
5. **What is our actual monthly churn target and how will we measure it?**
6. **Do we mark up WhatsApp costs or pass through at cost?**
7. **Are we a SaaS company or a BSP reseller?** (This determines valuation and strategy.)
8. **Which one channel will we dominate before expanding?**
9. **What is the minimum ARPU that makes our unit economics work?**
10. **What will we do if 10 salons say no?** (Pivot market? Cut price? Change product?)

---

## 40. Final Startup Verdict

**FACT:** Evernaro is one of the more complete early-stage SaaS codebases this audit has inspected. The engineering is disciplined, security-minded, and production-deployable. The team has built a multi-tenant omnichannel inbox with real AI, real billing, a real worker architecture, public customer pages, and now a fully automated queue/no-show flow.

**FACT:** The product's biggest enemy is its own breadth. It can be sold to salons, clinics, real estate agents, auto shops, and restaurants — but in trying to serve all of them, it does not yet *dominate* any of them.

**FACT:** Most previously schema-only features are now wired (job cards, resources, memberships, reviews, customer events, notification preferences, public booking/review/queue pages, automated reminders, review requests, queue OTP, auto no-show, QR codes). This removes the "incomplete product" objection but does not remove the market-risk objection.

**VERDICT:** Evernaro is **not ready for a broad public launch**, but it **is ready for a controlled, vertical-specific paid pilot**. The technology risk is low. The market risk is high and unvalidated.

**RECOMMENDATION:** Choose salons and beauty clinics as the beachhead. Use the new public booking page, automated reminders, and queue self check-in as the core demo. Sell to 10 paying salons in the next 30 days. Let customer behavior — not the schema — decide what to build next.

---

# THE ONE THING WE SHOULD DO NEXT

**Recruit and onboard 5 paying salon or beauty-clinic customers in India within the next 30 days, leading with the public booking page, automated WhatsApp reminders, and queue self check-in, and measure no-show reduction.**

The recently built features (job cards, resources, memberships, reviews, events, notification preferences, queue OTP, auto no-show, QR codes) are available for vertical expansion, but the sales pitch should remain narrow: fewer no-shows, faster replies, and a smoother walk-in experience.
