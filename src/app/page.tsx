import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button, Card, Logo, ThemeToggle } from "@/components/ui";
import { FlowMockup } from "@/components/landing/flow-mockup";
import { Reveal } from "@/components/landing/reveal";
import { Faq } from "@/components/landing/faq";
import {
  ArrowRight,
  Bell,
  Bot,
  CalendarClock,
  Camera,
  Check,
  ChevronRight,
  Clock,
  Eye,
  LineChart,
  Mail,
  MessageSquare,
  PhoneCall,
  QrCode,
  ScanLine,
  Send,
  Sparkles,
  Users,
} from "lucide-react";

const DEMO_URL =
  process.env.NEXT_PUBLIC_DEMO_BOOKING_URL ??
  "mailto:contact@evernaro.com?subject=Book%20a%20demo";

const CHANNELS = [
  { icon: Send, label: "WhatsApp" },
  { icon: Mail, label: "Email" },
  { icon: MessageSquare, label: "Telegram" },
  { icon: Camera, label: "Instagram" },
  { icon: PhoneCall, label: "Voice reminders" },
];

const JOURNEY_STEPS = [
  {
    number: "01",
    title: "Join or book",
    description: "Customer scans a QR code, opens a link, or books online.",
  },
  {
    number: "02",
    title: "Get your place",
    description: "Receive a token, appointment, position, and estimated wait.",
  },
  {
    number: "03",
    title: "Track in real time",
    description: "Position and status update automatically.",
  },
  {
    number: "04",
    title: "Get notified",
    description: "Evernaro lets customers know when their turn is approaching.",
  },
  {
    number: "05",
    title: "Get served",
    description: "Your team sees exactly who needs attention next.",
  },
  {
    number: "06",
    title: "Bring them back",
    description: "Send follow-ups, collect feedback, and make rebooking easy.",
  },
];

const INDUSTRIES = [
  {
    title: "Salon & Beauty",
    flow: ["Join queue", "Track position", "Get notified", "Get served"],
    description: "Manage walk-ins, appointments, stylists, queues, payments and rebooking.",
  },
  {
    title: "Healthcare / Clinics",
    flow: ["Register", "Wait", "Get called", "Consultation", "Follow-up"],
    description: "Manage patient queues, appointments, doctors and follow-ups.",
  },
  {
    title: "Restaurants",
    flow: ["Join waitlist", "Track position", "Table ready", "Notify", "Seat"],
    description: "Replace uncertain waiting with a live digital waitlist.",
  },
  {
    title: "Auto Service",
    flow: ["Vehicle received", "Service", "Progress", "Ready", "Pickup"],
    description: "Keep customers informed from vehicle drop-off to pickup.",
  },
  {
    title: "Home Services",
    flow: ["Book", "Assign", "On the way", "Arrive", "Complete"],
    description: "Electrician, plumbing, cleaning, appliance repair dispatch.",
  },
  {
    title: "Real Estate",
    flow: ["Lead", "Contact", "Site visit", "Follow-up", "Booking"],
    description: "Never lose a lead between first message and site visit.",
  },
  {
    title: "Education",
    flow: ["Enquiry", "Counselling", "Demo", "Admission"],
    description: "Enquiries, counselling, admissions, batches and fee tracking.",
  },
  {
    title: "Legal",
    flow: ["Request", "Consultation", "Matter", "Follow-up"],
    description: "Client intake, consultations, matters, tasks and billing.",
  },
  {
    title: "Dental",
    flow: ["Book", "Wait", "Consultation", "Treatment", "Follow-up"],
    description: "Dental appointments, treatments, and patient follow-ups.",
  },
  {
    title: "Wellness",
    flow: ["Book", "Arrive", "Session", "Payment", "Rebook"],
    description: "Appointments, memberships, packages, and retention.",
  },
];

const CAPABILITIES = [
  {
    icon: Clock,
    title: "Live Queues",
    description: "Let customers join remotely and see their live position.",
  },
  {
    icon: CalendarClock,
    title: "Appointments",
    description: "Manage bookings, availability, staff and scheduling.",
  },
  {
    icon: Bell,
    title: "Real-Time Notifications",
    description: "Keep customers informed through the channels you configure — WhatsApp, email, Telegram and voice reminders.",
  },
  {
    icon: QrCode,
    title: "QR Customer Entry",
    description: "Customers scan a QR code to join your queue or book a service.",
  },
  {
    icon: Users,
    title: "Customer Management",
    description: "Keep customer history, appointments, conversations and interactions together.",
  },
  {
    icon: MessageSquare,
    title: "Unified Inbox",
    description: "Connect WhatsApp, Email, Telegram and Instagram in one thread list.",
  },
  {
    icon: Sparkles,
    title: "Reviews & Rebooking",
    description: "Turn completed services into repeat customers with follow-ups.",
  },
  {
    icon: LineChart,
    title: "Analytics",
    description: "Understand waiting time, service volume, cancellations and no-shows.",
  },
  {
    icon: Bot,
    title: "AI Assistance",
    description: "AI drafts replies, summarizes information and assists your team.",
  },
];

const CUSTOMER_FLOW = [
  "Join remotely",
  "See position",
  "Track estimated wait",
  "Receive notification",
  "Arrive at the right time",
  "Get served",
  "Review / Rebook",
];

const BUSINESS_FLOW = [
  "See who's waiting",
  "Manage staff",
  "Call next customer",
  "Update status",
  "Automate notifications",
  "Complete service",
  "Follow up",
];

const HOW_IT_WORKS = [
  {
    icon: ScanLine,
    title: "Set up your business",
    description: "Add services, staff, working hours and customer-flow preferences.",
  },
  {
    icon: Users,
    title: "Let customers join or book",
    description: "Customers scan your QR code, use your booking link, or contact your business.",
  },
  {
    icon: Eye,
    title: "Manage the flow",
    description: "Your team sees appointments, queues, staff availability and customer status in real time.",
  },
  {
    icon: Bell,
    title: "Keep customers informed",
    description: "Evernaro updates customers about their queue position, appointment and service status.",
  },
  {
    icon: Check,
    title: "Complete the journey",
    description: "Collect payment, request feedback, send follow-ups and encourage rebooking.",
  },
];

function formatPrice(amount: number, currency: string) {
  if (amount === 0) return "Free";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

// This page reads the session, so it must be rendered dynamically.
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");

  const plans = await prisma.subscriptionPlan.findMany({
    where: { isActive: true, isCustom: false },
    include: { features: { orderBy: { key: "asc" } } },
    orderBy: { displayOrder: "asc" },
  });

  return (
    <div className="flex flex-1 flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Logo width={150} className="w-[130px] sm:w-[150px]" />
          <nav className="flex items-center gap-3">
            <Link href="/pricing" className="cursor-pointer text-sm text-text-secondary hover:text-text">
              Pricing
            </Link>
            <Link href="/contact" className="cursor-pointer text-sm text-text-secondary hover:text-text">
              Contact
            </Link>
            <Link
              href="/login"
              className="hidden cursor-pointer text-sm text-text-secondary hover:text-text sm:block"
            >
              Log in
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-24 px-6 pt-14 pb-24">
        {/* Hero */}
        <section className="grid items-center gap-10 text-center sm:items-start sm:text-start lg:grid-cols-[1fr_1.1fr] lg:gap-12">
          <div className="flex flex-col items-center gap-5 pt-2 sm:items-start lg:pt-8">
            <Reveal>
              <p className="inline-flex items-center gap-2 rounded-full border border-primary-light bg-primary-lighter px-3 py-1 text-xs font-medium text-primary">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-live-pulse absolute inline-flex h-full w-full rounded-full bg-primary" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                </span>
                Built by Eversity Tech LLP
              </p>
            </Reveal>
            <Reveal delay={80}>
              <h1 className="text-4xl leading-[1.05] font-extrabold tracking-tight text-text sm:text-5xl lg:text-[3.25rem]">
                Stop making customers
                <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  wait blindly.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="max-w-lg text-lg font-medium text-text">
                The real-time customer flow platform for modern businesses.
              </p>
            </Reveal>
            <Reveal delay={200}>
              <p className="max-w-lg text-base leading-relaxed text-text-secondary">
                Let customers join queues, book appointments, track their status, and get notified when
                it&apos;s their turn — while your team manages the entire customer journey from one place.
              </p>
            </Reveal>
            <Reveal delay={260}>
              <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                <Link href="/signup">
                  <Button size="lg" className="w-full sm:w-auto">
                    Start free
                  </Button>
                </Link>
                <a href={DEMO_URL}>
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                    Book a demo
                  </Button>
                </a>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-text-muted sm:justify-start">
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  14-day free trial
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  No credit card required
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  Setup in minutes
                </span>
              </div>
            </Reveal>
          </div>

          <Reveal delay={200} className="min-w-0 overflow-hidden lg:pl-4">
            <FlowMockup />
          </Reveal>
        </section>

        {/* Problem */}
        <section className="flex flex-col gap-10">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">The problem</p>
            <h2 className="mt-2 text-3xl font-extrabold text-text">
              Waiting shouldn&apos;t be a guessing game.
            </h2>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-2">
            <Reveal delay={80}>
              <Card className="h-full p-6">
                <h3 className="mb-4 text-base font-bold text-text">For customers</h3>
                <ul className="flex flex-col gap-3 text-sm text-text-secondary">
                  {[
                    "Sit in crowded waiting areas",
                    "Call repeatedly asking for updates",
                    "Wonder when their appointment will start",
                    "Wait for tables, vehicles, technicians or consultations",
                    "Wait without knowing their position",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-warning" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
            <Reveal delay={160}>
              <Card className="h-full p-6">
                <h3 className="mb-4 text-base font-bold text-text">For businesses</h3>
                <ul className="flex flex-col gap-3 text-sm text-text-secondary">
                  {[
                    "Manage queues manually",
                    "Call customers one by one",
                    "Track appointments in spreadsheets",
                    "Coordinate staff manually",
                    "Lose customers because of long waits",
                    "Forget follow-ups",
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-danger" />
                      {item}
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          </div>

          <Reveal delay={240}>
            <div className="mx-auto max-w-2xl rounded-xl border border-primary-light bg-primary-lighter p-6 text-center">
              <p className="text-lg font-semibold text-text">
                Customers know what&apos;s happening. Your team knows what to do next.
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Evernaro keeps both sides synchronized.
              </p>
            </div>
          </Reveal>
        </section>

        {/* Journey */}
        <section className="flex flex-col gap-10">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Customer journey</p>
            <h2 className="mt-2 text-3xl font-extrabold text-text">
              From waiting to served — without the uncertainty.
            </h2>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {JOURNEY_STEPS.map((step, i) => (
              <Reveal key={step.title} delay={i * 60}>
                <Card className="relative h-full p-5">
                  <span className="mb-3 inline-block text-2xl font-extrabold text-primary/30">
                    {step.number}
                  </span>
                  <h3 className="mb-1 text-base font-bold text-text">{step.title}</h3>
                  <p className="text-sm text-text-secondary">{step.description}</p>
                  {i !== JOURNEY_STEPS.length - 1 && (
                    <ArrowRight className="absolute top-5 right-5 hidden h-4 w-4 text-text-muted lg:block" />
                  )}
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Industries */}
        <section className="flex flex-col gap-10">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Industries</p>
            <h2 className="mt-2 text-3xl font-extrabold text-text">
              One platform. Built for different customer flows.
            </h2>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {INDUSTRIES.map((industry, i) => (
              <Reveal key={industry.title} delay={i * 40}>
                <Card className="flex h-full flex-col p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)]">
                  <h3 className="mb-2 text-base font-bold text-text">{industry.title}</h3>
                  <p className="mb-4 text-sm text-text-secondary">{industry.description}</p>
                  <div className="mt-auto flex flex-wrap items-center gap-1.5">
                    {industry.flow.map((item, idx) => (
                      <span key={item} className="flex items-center text-xs text-text-muted">
                        {item}
                        {idx !== industry.flow.length - 1 && (
                          <ChevronRight className="mx-1 h-3 w-3 text-text-muted/60" />
                        )}
                      </span>
                    ))}
                  </div>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Capabilities */}
        <section className="flex flex-col gap-10">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Capabilities</p>
            <h2 className="mt-2 text-3xl font-extrabold text-text">
              Everything you need to manage customer flow.
            </h2>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((cap, i) => (
              <Reveal key={cap.title} delay={i * 50}>
                <Card className="flex h-full flex-col gap-3 p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-lighter">
                    <cap.icon className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-bold text-text">{cap.title}</h3>
                  <p className="text-sm text-text-secondary">{cap.description}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Customer + Business split */}
        <section className="flex flex-col gap-10">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Synchronized</p>
            <h2 className="mt-2 text-3xl font-extrabold text-text">
              Customers know. Your team knows. Everyone stays synchronized.
            </h2>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-2">
            <Reveal delay={80}>
              <Card className="h-full p-6">
                <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-text">
                  <Users className="h-4 w-4 text-primary" aria-hidden="true" />
                  Customer side
                </h3>
                <div className="flex flex-col gap-3">
                  {CUSTOMER_FLOW.map((item, i) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-lighter text-[10px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="text-sm text-text-secondary">{item}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>
            <Reveal delay={160}>
              <Card className="h-full p-6">
                <h3 className="mb-5 flex items-center gap-2 text-base font-bold text-text">
                  <Eye className="h-4 w-4 text-primary" aria-hidden="true" />
                  Business side
                </h3>
                <div className="flex flex-col gap-3">
                  {BUSINESS_FLOW.map((item, i) => (
                    <div key={item} className="flex items-center gap-3">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary-lighter text-[10px] font-bold text-primary">
                        {i + 1}
                      </span>
                      <span className="text-sm text-text-secondary">{item}</span>
                    </div>
                  ))}
                </div>
              </Card>
            </Reveal>
          </div>
        </section>

        {/* Unified Inbox */}
        <section className="flex flex-col gap-10">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <p className="text-xs font-medium tracking-wide text-primary uppercase">Connect</p>
              <h2 className="mt-2 text-3xl font-extrabold text-text">
                Connect with customers wherever they already are.
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <p className="mt-3 text-base text-text-secondary">
                WhatsApp · Email · Telegram · Instagram · Voice reminders
              </p>
            </Reveal>
          </div>

          <Reveal delay={120}>
            <Card className="mx-auto max-w-3xl overflow-hidden p-0">
              <div className="border-b border-border bg-surface px-5 py-3">
                <p className="text-sm font-bold text-text">Ananya Sharma</p>
                <p className="text-xs text-text-muted">Customer journey at a glance</p>
              </div>
              <div className="grid gap-4 p-5 sm:grid-cols-2">
                <div className="space-y-3">
                  <div className="rounded-lg bg-surface p-3">
                    <p className="text-xs text-text-muted">WhatsApp</p>
                    <p className="text-sm text-text">&ldquo;Can I come at 5 PM?&rdquo;</p>
                  </div>
                  <div className="rounded-lg bg-surface p-3">
                    <p className="text-xs text-text-muted">Appointment</p>
                    <p className="text-sm font-medium text-text">Today · 5:00 PM</p>
                  </div>
                  <div className="rounded-lg bg-surface p-3">
                    <p className="text-xs text-text-muted">Queue</p>
                    <p className="text-sm font-medium text-text">#A105</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-lg bg-surface p-3">
                    <p className="text-xs text-text-muted">Service</p>
                    <p className="text-sm font-medium text-text">Haircut</p>
                  </div>
                  <div className="rounded-lg bg-surface p-3">
                    <p className="text-xs text-text-muted">Payment</p>
                    <p className="text-sm font-medium text-text">₹500</p>
                  </div>
                  <div className="rounded-lg border border-dashed border-primary bg-primary-lighter p-3">
                    <p className="text-xs font-medium text-primary">Follow-up</p>
                    <p className="text-sm text-text">&ldquo;Book your next appointment&rdquo;</p>
                  </div>
                </div>
              </div>
            </Card>
          </Reveal>

          <Reveal delay={180}>
            <div className="flex flex-wrap justify-center gap-3">
              {CHANNELS.map((c) => (
                <span
                  key={c.label}
                  className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-text-secondary shadow-[var(--shadow-card)]"
                >
                  <c.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                  {c.label}
                </span>
              ))}
            </div>
          </Reveal>
        </section>

        {/* AI */}
        <section className="flex flex-col gap-10">
          <div className="mx-auto max-w-2xl text-center">
            <Reveal>
              <p className="text-xs font-medium tracking-wide text-primary uppercase">AI</p>
              <h2 className="mt-2 text-3xl font-extrabold text-text">
                AI helps your team respond faster. Your team stays in control.
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <p className="mt-3 text-base text-text-secondary">
                AI drafts replies, summarizes conversations and helps with repetitive work. Human
                approval remains essential — your team reviews, edits and sends every message.
              </p>
            </Reveal>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {[
              { title: "AI drafts", description: "Suggested replies pulled from your knowledge base." },
              { title: "Your team reviews", description: "Edit, approve or rewrite before sending." },
              { title: "Your team decides", description: "Nothing goes out without human approval." },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 80}>
                <Card className="h-full p-6 text-center">
                  <h3 className="mb-2 text-base font-bold text-text">{item.title}</h3>
                  <p className="text-sm text-text-secondary">{item.description}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="flex flex-col gap-10">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">How it works</p>
            <h2 className="mt-2 text-3xl font-extrabold text-text">How Evernaro works</h2>
          </Reveal>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <Reveal key={step.title} delay={i * 80}>
                <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-start">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-lighter">
                    <step.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">
                    Step {i + 1}
                  </p>
                  <h3 className="text-base font-bold text-text">{step.title}</h3>
                  <p className="text-sm text-text-secondary">{step.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="flex flex-col gap-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Pricing</p>
            <h2 className="mt-2 text-3xl font-extrabold text-text">Simple pricing that grows with you.</h2>
            <p className="mt-2 text-base text-text-secondary">
              Prices in INR, billed monthly. Start with a 14-day free trial — no credit card required,
              cancel anytime.
            </p>
          </Reveal>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {plans.map((plan, i) => {
              const highlighted = plan.slug === "growth";
              return (
                <Reveal key={plan.id} delay={i * 80}>
                  <Card
                    className={`relative flex h-full flex-col gap-5 p-6 ${
                      highlighted ? "border-primary shadow-[var(--shadow-elevated)]" : ""
                    }`}
                  >
                    {highlighted && (
                      <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                        Most popular
                      </span>
                    )}
                    <div>
                      <h3 className="text-base font-bold text-text">{plan.name}</h3>
                      <p className="mt-1 text-sm text-text-secondary">{plan.description}</p>
                    </div>
                    <div>
                      {plan.trialDays > 0 && (
                        <p className="text-xs font-medium text-success">
                          Free {plan.trialDays}-day trial starts automatically, then
                        </p>
                      )}
                      <p className="text-3xl font-extrabold text-text">
                        {formatPrice(plan.monthlyPriceInr, plan.currency)}
                        <span className="text-sm font-medium text-text-muted">/month</span>
                      </p>
                    </div>
                    <ul className="flex flex-1 flex-col gap-2">
                      {plan.features.map((feature) => (
                        <li
                          key={feature.id}
                          className="flex items-start gap-2 text-sm text-text-secondary"
                        >
                          <Check
                            className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                              feature.included ? "text-primary" : "text-text-muted"
                            }`}
                            aria-hidden="true"
                          />
                          <span className={feature.included ? "" : "line-through opacity-60"}>
                            {feature.label}
                            {feature.value ? `: ${feature.value}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                    <Link href="/signup">
                      <Button variant={highlighted ? "primary" : "secondary"} className="w-full">
                        {plan.monthlyPriceInr === 0 ? "Start for free" : "Start free trial"}
                      </Button>
                    </Link>
                  </Card>
                </Reveal>
              );
            })}
          </div>

          <Reveal>
            <p className="text-center text-sm text-text-muted">
              WhatsApp send costs billed separately at Meta&apos;s per-conversation rates, capped by your
              prepaid wallet. Need a custom plan?{" "}
              <a
                href="mailto:contact@evernaro.com"
                className="cursor-pointer text-primary hover:text-primary-hover"
              >
                Talk to us
              </a>
              .
            </p>
          </Reveal>
        </section>

        {/* FAQ */}
        <section className="flex flex-col gap-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">FAQ</p>
            <h2 className="mt-2 text-3xl font-extrabold text-text">Questions, answered.</h2>
          </Reveal>
          <Reveal>
            <Faq />
          </Reveal>
        </section>

        {/* Final CTA */}
        <section>
          <Reveal>
            <Card className="relative flex flex-col items-center gap-5 overflow-hidden p-8 text-center">
              <div
                className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary-lighter blur-2xl"
                aria-hidden="true"
              />
              <div className="relative">
                <h2 className="text-2xl font-bold text-text sm:text-3xl">
                  Stop making customers guess when they&apos;ll be served.
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
                  Give your customers a better way to wait, book and stay informed.
                </p>
              </div>
              <div className="relative flex flex-col items-center gap-3 sm:flex-row">
                <Link href="/signup">
                  <Button size="lg">Start free</Button>
                </Link>
                <a href={DEMO_URL}>
                  <Button variant="secondary" size="lg">
                    Book a demo
                  </Button>
                </a>
              </div>
              <div className="relative flex flex-wrap items-center justify-center gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  14-day free trial
                </span>
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  No credit card required
                </span>
              </div>
            </Card>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Logo width={130} className="w-[120px]" />
              <p className="mt-3 max-w-xs text-sm leading-relaxed text-text-secondary">
                Real-time customer flow management for modern businesses.
              </p>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold tracking-wide text-text-muted uppercase">
                Product
              </p>
              <ul className="flex flex-col gap-2 text-sm text-text-secondary">
                {[
                  { label: "Queue Management", href: "/signup" },
                  { label: "Appointments", href: "/signup" },
                  { label: "Customer Management", href: "/signup" },
                  { label: "Notifications", href: "/signup" },
                  { label: "Unified Inbox", href: "/signup" },
                  { label: "Analytics", href: "/signup" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link href={item.href} className="hover:text-text">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold tracking-wide text-text-muted uppercase">
                Industries
              </p>
              <ul className="flex flex-col gap-2 text-sm text-text-secondary">
                {[
                  "Salon",
                  "Healthcare",
                  "Restaurant",
                  "Auto Service",
                  "Home Services",
                  "Real Estate",
                  "Education",
                  "Legal",
                  "Dental",
                  "Wellness",
                ].map((item) => (
                  <li key={item}>
                    <Link href="/signup" className="hover:text-text">
                      {item}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold tracking-wide text-text-muted uppercase">
                Company
              </p>
              <ul className="flex flex-col gap-2 text-sm text-text-secondary">
                <li>
                  <Link href="/" className="hover:text-text">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-text">
                    Contact
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-text">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/privacy" className="hover:text-text">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="hover:text-text">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between gap-4 border-t border-border pt-6 text-xs text-text-muted sm:flex-row">
            <span>Built by Eversity Tech LLP</span>
            <div className="flex items-center gap-4">
              <Link href="/terms" className="cursor-pointer hover:text-text-secondary">
                Terms
              </Link>
              <Link href="/privacy" className="cursor-pointer hover:text-text-secondary">
                Privacy
              </Link>
              <Link href="/contact" className="cursor-pointer hover:text-text-secondary">
                Contact
              </Link>
              <ThemeToggle />
            </div>
          </div>

          <p className="text-center text-xs text-text-muted sm:text-start">
            &copy; 2026 Eversity Tech LLP
          </p>
        </div>
      </footer>
    </div>
  );
}
