# Evernaro — Salon / Clinic Pilot Kit

Everything needed to sign and onboard the first 5 paying pilots. Beachhead: appointment-based
Indian SMBs (salons, beauty parlours, dental/derma/physio clinics), 3–20 staff, 1–2 locations.

Pitch one outcome: **fewer no-shows and a calmer front desk.** Nothing else.

---

## 1. One-page pitch

**Headline:** Stop losing money to no-shows.

**The problem they feel every day:**
- 15–25% of booked appointments don't show up. Each empty chair is revenue you can't get back.
- The front desk spends hours every day on WhatsApp — confirming, rescheduling, answering "are you open?", chasing reviews.
- Walk-in customers crowd the waiting area and ask "how long?" every five minutes.

**What Evernaro does:**
1. **Automated WhatsApp reminders** go out 24 hours and 2 hours before every appointment, from your salon's own number. Customer replies land in one shared inbox.
2. **One inbox** for WhatsApp, Instagram, and Telegram — the whole front desk sees every conversation, nothing gets missed, AI drafts the reply and your staff just approves it.
3. **Digital walk-in queue** — customer scans a QR code, joins from their phone, watches their position, gets a WhatsApp when it's their turn. No crowding, no shouting names.
4. **Automatic review requests** after every completed visit.

**Proof offer:** We measure your no-show rate for 2 weeks before and 4 weeks after. If it doesn't drop, you don't continue.

**Price:** ₹1,999/month, month-to-month, cancel anytime. We set it up for you. WhatsApp message
costs (~₹0.30–1.20 each) are billed from a prepaid wallet you top up — no surprise bills.

**Ask:** "Can I set this up for your salon this week and show you the numbers in a month?"

---

## 2. WhatsApp message templates

These are the customer-facing messages. In Evernaro every template's `{{1}}` is the customer's
first name — the rest are filled per the variable order below. Submit each through
**Settings → WhatsApp → Templates**; approval by Meta takes a few hours to ~2 days.

> After a template is approved in Gupshup, open it in Evernaro and press **Sync** so the app
> marks it `APPROVED`. The reminder/campaign senders only use a template the app has synced —
> otherwise they fall back to plain text, which WhatsApp blocks outside a 24-hour window.

### 2.1 Appointment reminder — `appt_reminder` (UTILITY)
Variables: `{{1}}` name · `{{2}}` service · `{{3}}` business · `{{4}}` date · `{{5}}` time

```
Hi {{1}}, a reminder for your {{2}} appointment at {{3}} on {{4}} at {{5}}.
Reply YES to confirm, or reply here to reschedule.
```

### 2.2 Appointment confirmation — `appt_confirmed` (UTILITY)
Variables: `{{1}}` name · `{{2}}` service · `{{3}}` business · `{{4}}` date · `{{5}}` time

```
Hi {{1}}, your {{2}} at {{3}} is booked for {{4}} at {{5}}. See you then!
Need to change it? Just reply to this message.
```

### 2.3 Walk-in "your turn" — `queue_yourturn` (UTILITY)
Variables: `{{1}}` name · `{{2}}` business · `{{3}}` token · `{{4}}` verification code

```
Hi {{1}}, it's your turn at {{2}}. Your token is {{3}}.
Please come to the counter and show code {{4}}.
```

### 2.4 Review request — `review_request` (MARKETING)
Variables: `{{1}}` name · `{{2}}` service · `{{3}}` review link

```
Hi {{1}}, thank you for visiting us for your {{2}}. How did we do?
Leave a quick review here: {{3}}
```

### 2.5 Festival / slow-week offer — `promo_offer` (MARKETING)
Variables: `{{1}}` name · `{{2}}` offer detail · `{{3}}` valid-until date

```
Hi {{1}}, a treat from us: {{2}}. Valid until {{3}}.
Reply BOOK and we'll hold a slot for you.
```

Send offers only to contacts who have messaged you before or opted in. Never buy lists — it gets
the WhatsApp number banned.

---

## 3. Onboarding runbook (run on a 30–45 min call)

Do this with the owner on a video/phone call, screen shared. Target: first real reminder
scheduled within the call.

| # | Step | Where | Done when |
|---|------|-------|-----------|
| 1 | Create the account, choose **Salon/Beauty** or **Clinic** | `/signup` | Owner can log in |
| 2 | Verify email | inbox link | Banner gone |
| 3 | Set business name, public slug, timezone, business hours | `/settings` | Hours saved |
| 4 | Add 3–8 real services with duration + price | `/services` | Services list populated |
| 5 | Add each staff member | `/staff` | All staff present |
| 6 | Connect WhatsApp (Gupshup number) + Meta App ID | `/channels` | Channel shows Connected |
| 7 | Top up WhatsApp wallet (₹500 to start) | `/billing` → wallet | Balance > 0 |
| 8 | Submit templates 2.1–2.4 above | `/settings` → Templates | Status Pending/Approved |
| 9 | Import existing customers (CSV: name, phone) | `/contacts` → Import | Contacts imported |
| 10 | Book one real appointment for tomorrow | `/appointments` | Appointment shows |
| 11 | Confirm the reminder is scheduled for it | `/reminders` | Reminder queued |
| 12 | Print the queue QR code, stick it at the desk | `/queue` → QR codes | QR on the desk |
| 13 | Send owner a test reminder to their own number | book test appt | Owner gets the WhatsApp |
| 14 | Set the AI knowledge base: hours, prices, policies, tone | `/knowledge` | Draft replies sound right |

**Day-2 follow-up:** call, confirm reminders went out, watch them handle one inbound reply live.

**Week-1 check-in:** review the numbers with them (section 4). Fix anything blocking daily use.

---

## 4. No-show baseline tracker

Fill this per pilot. The 4-week delta is the entire sales case for continuing and for the next
pilot's testimonial.

| Field | Value |
|---|---|
| Salon / clinic name | |
| City | |
| Owner name + WhatsApp | |
| Staff count | |
| Avg appointments / week | |
| **Baseline no-show rate** (2 weeks before, count by hand) | ____ % |
| Go-live date | |
| Week 1 no-show rate | ____ % |
| Week 2 no-show rate | ____ % |
| Week 3 no-show rate | ____ % |
| Week 4 no-show rate | ____ % |
| **Change** | ____ pp |
| Front-desk hours saved / week (ask the owner) | |
| Reminders sent (from `/analytics`) | |
| Reply rate (from `/analytics`) | |
| Continuing after pilot? | Y / N |
| Testimonial quote | |

How to get the baseline: before go-live, have the desk mark every appointment
BOOKED → COMPLETED / NO_SHOW for 2 weeks. No-show rate = no-shows ÷ (completed + no-shows).
After go-live the same numbers come from `/analytics`.

---

## 5. Pilot agreement (plain terms — put on one page, both sign)

- **Service:** Evernaro platform access + hands-on setup by Eversity Tech LLP.
- **Price:** ₹1,999 / month, billed monthly in advance via Razorpay. Month-to-month.
- **WhatsApp costs:** separate, pay-as-you-go from a prepaid wallet the customer tops up. Rates
  are Meta's per-conversation rates, passed through. Unused balance refundable on close.
- **Term:** rolling monthly. Either side can stop with notice before the next renewal. No
  lock-in, no cancellation fee.
- **Refunds:** governed by the published Refund & Cancellation Policy (`/refunds`) — including
  the 7-day first-charge satisfaction refund.
- **Data:** the customer owns their contact and conversation data and can export or delete it at
  any time. Eversity does not sell it or train models on it (see `/privacy`).
- **Support during pilot:** direct WhatsApp line to a founder, response same business day.
- **What we ask in return:** you actually use it daily for 30 days, you give us the no-show
  numbers, and if it works you give us a short testimonial and one referral.

---

## 6. First-week failure modes to watch

| Symptom | Likely cause | Fix |
|---|---|---|
| Reminders not delivering | Template not synced to `APPROVED` in-app, or wallet empty | Sync template; top up wallet |
| Reminder text shows raw `{{2}}` | Template body variables ≠ sender's param order | Re-check section 2 order, resubmit |
| "Your turn" WhatsApp never arrives | `queue_yourturn` not approved/synced | Approve + sync; until then it's plain text only |
| Owner not opening the inbox | No habit yet | Daily check-in call week 1; turn on notification emails |
| Customers reply but staff miss it | Nobody assigned / no notification | Assign conversations; set notification prefs |
| No-show rate not moving | Reminders going out too late, or wrong number format | Confirm 24h+2h schedule; check numbers have country code |

---

## 7. Do NOT do during the pilot

Freeze everything not on this page. No new industries, no automation-builder UI, no realtime
websockets, no new channels, no attachments. If a pilot asks for something, write it down and
keep selling. Ship changes only when they unblock a paying salon's daily use.
