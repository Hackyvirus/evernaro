import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button, Card, Logo, ThemeToggle } from "@/components/ui";
import { ProductMockup } from "@/components/landing/product-mockup";
import { Reveal } from "@/components/landing/reveal";
import { Faq } from "@/components/landing/faq";
import {
  Bell,
  Bot,
  Camera,
  Check,
  Eye,
  LineChart,
  Mail,
  Megaphone,
  MessageSquare,
  PhoneCall,
  PlugZap,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";

const CHANNELS = [
  { icon: MessageSquare, label: "Telegram" },
  { icon: Mail, label: "Email" },
  { icon: Send, label: "WhatsApp" },
  { icon: Camera, label: "Instagram" },
  { icon: PhoneCall, label: "Voice reminders" },
];

const STATS = [
  { value: "5", label: "channels unified" },
  { value: "1", label: "shared inbox" },
  { value: "AI", label: "drafted replies" },
  { value: "24h", label: "compliance guard" },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI drafts, you decide",
    description:
      "Every reply starts as an AI-drafted suggestion pulled from your business knowledge base — a person reviews, edits, and sends. Nothing goes out on its own.",
  },
  {
    icon: MessageSquare,
    title: "A real unified inbox",
    description:
      "Telegram, email, WhatsApp, Instagram and voice all land in one thread list with the channel tagged — your team stops tab-hopping to answer customers.",
  },
  {
    icon: Megaphone,
    title: "Campaigns and reminders",
    description:
      "Send one message to every reachable contact on a channel, or schedule one-off and recurring reminders — appointments, payments, follow-ups.",
  },
  {
    icon: ShieldCheck,
    title: "Built for compliance",
    description:
      "WhatsApp template enforcement outside the 24-hour window, and Voice calling scoped only to individually-scheduled reminders — never bulk or cold calling.",
  },
  {
    icon: Wallet,
    title: "No surprise WhatsApp bills",
    description:
      "A prepaid wallet meters real Meta send cost per message. A connected channel can never silently rack up unbounded spend.",
  },
  {
    icon: LineChart,
    title: "Analytics you can act on",
    description:
      "See volumes by channel, campaign and reminder performance, and where your attention actually needs to go.",
  },
];

const HOW_IT_WORKS = [
  {
    icon: PlugZap,
    title: "Connect your channels",
    description:
      "Link Telegram, email, WhatsApp, Instagram, and voice reminders in a few minutes — no code, no IT ticket.",
  },
  {
    icon: Bot,
    title: "AI drafts every reply",
    description:
      "Incoming messages get an AI-drafted response pulled from your business knowledge base, waiting in your inbox.",
  },
  {
    icon: Eye,
    title: "Your team reviews and sends",
    description:
      "Nothing goes out unapproved. Edit it, approve it, or write your own — you're always the one who hits send.",
  },
];

const PRICING_TIERS = [
  {
    name: "Starter",
    price: "₹1,499",
    tagline: "For a single team getting started.",
    features: [
      "Up to 2 channels",
      "1 team seat",
      "AI-drafted replies",
      "Up to 500 sends/day",
      "Email support",
    ],
    highlighted: false,
  },
  {
    name: "Growth",
    price: "₹3,999",
    tagline: "For teams running campaigns and reminders daily.",
    features: [
      "All 5 channels",
      "Up to 5 team seats",
      "AI-drafted replies",
      "Up to 2,000 sends/day",
      "WhatsApp template management",
      "Priority support",
    ],
    highlighted: true,
  },
  {
    name: "Scale",
    price: "₹8,999",
    tagline: "For multi-location or high-volume businesses.",
    features: [
      "Everything in Growth",
      "Unlimited team seats",
      "Custom send limits",
      "Vertical starter packs (e.g. real estate)",
      "Dedicated onboarding",
    ],
    highlighted: false,
  },
];

const FAQ_BLURB =
  "Answers to the questions we get most. Anything else — support@evernaro.com.";

// This page reads the session, so it must be rendered dynamically.
export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await auth();
  if (session) redirect("/dashboard");

  return (
    <div className="flex flex-1 flex-col bg-surface">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <Logo width={150} />
          <nav className="flex items-center gap-3">
            <Link href="/login" className="cursor-pointer text-sm text-text-secondary hover:text-text">
              Log in
            </Link>
            <Link href="/signup">
              <Button size="sm">Get started</Button>
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-20 px-6 pt-14 pb-24">
        {/* Hero */}
        <section className="grid items-center gap-10 text-center sm:items-start sm:text-start lg:grid-cols-[1fr_1.05fr] lg:gap-12">
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
              <h1 className="text-3xl leading-[1.1] font-extrabold tracking-tight text-text sm:text-4xl lg:text-[2.75rem]">
                Stop juggling tabs. <br className="hidden sm:block" />
                <span className="inline-block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  One inbox for every customer.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={160}>
              <p className="max-w-lg text-base leading-relaxed text-text-secondary">
                Telegram, Email, WhatsApp, Instagram, and Voice reminders — all in one place. AI drafts every reply; your team reviews and sends. No message goes out unsupervised.
              </p>
            </Reveal>
            <Reveal delay={240}>
              <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-start">
                <Link href="/signup">
                  <Button size="lg" className="w-full sm:w-auto">Start free</Button>
                </Link>
                <Link href="/login">
                  <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                    Log in
                  </Button>
                </Link>
                <a
                  href={process.env.NEXT_PUBLIC_DEMO_BOOKING_URL ?? "mailto:contact@evernaro.com?subject=Book%20a%20demo"}
                  className="flex h-12 items-center justify-center px-4 text-sm font-medium text-text-secondary hover:text-text sm:justify-start"
                >
                  Book a demo 
                </a>
              </div>
            </Reveal>
            <Reveal delay={320}>
              <div className="flex flex-wrap items-center gap-4 text-xs text-text-muted">
                <span className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
                  Free 14-day trial
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
            <Reveal delay={400}>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span className="text-xs text-text-muted">Trusted by teams in:</span>
                {["Real estate", "Healthcare", "Salons", "Education", "Services"].map((t) => (
                  <span
                    key={t}
                    className="rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-medium text-text-secondary"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal delay={200} className="min-w-0 overflow-hidden lg:pl-4">
            <ProductMockup />
          </Reveal>
        </section>

        {/* Stats bar */}
        <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-1 bg-card px-4 py-6">
              <p className="text-3xl font-extrabold text-primary">{s.value}</p>
              <p className="text-center text-xs text-text-secondary">{s.label}</p>
            </div>
          ))}
        </section>

        {/* Trust badges */}
        <section className="flex flex-col items-center gap-4 rounded-xl border border-border bg-card p-6">
          <p className="text-center text-xs font-medium tracking-wide text-text-muted uppercase">
            Built for trust and compliance
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6">
            {[
              { label: "WhatsApp Business API", icon: ShieldCheck },
              { label: "Prepaid wallet — no surprise bills", icon: Wallet },
              { label: "Human-in-the-loop AI", icon: Eye },
              { label: "Voice only for reminders", icon: PhoneCall },
            ].map((badge) => (
              <div key={badge.label} className="flex items-center gap-2 text-sm text-text-secondary">
                <badge.icon className="h-4 w-4 text-primary" aria-hidden="true" />
                {badge.label}
              </div>
            ))}
          </div>
        </section>

        {/* Channels */}
        <section className="flex flex-col items-center gap-6">
          <Reveal>
            <h2 className="text-center text-2xl font-extrabold text-text">
              The channels your customers already use
            </h2>
          </Reveal>
          <Reveal delay={100}>
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

        {/* Features */}
        <section className="flex flex-col gap-10">
          <Reveal className="flex flex-col items-center gap-2 text-center">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Features</p>
            <h2 className="text-3xl font-extrabold text-text">Everything a small business inbox needs.</h2>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <Card className="flex h-full flex-col gap-3 p-5 transition-shadow duration-200 hover:shadow-[var(--shadow-elevated)]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-lighter">
                    <f.icon className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="text-sm font-bold text-text">{f.title}</h3>
                  <p className="text-sm text-text-secondary">{f.description}</p>
                </Card>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="flex flex-col gap-8">
          <Reveal className="flex flex-col items-center gap-2 text-center">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">How it works</p>
            <h2 className="text-3xl font-extrabold text-text">
              From new message to sent reply, in three steps.
            </h2>
          </Reveal>
          <div className="grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <Reveal key={step.title} delay={i * 80}>
                <div className="flex flex-col items-center gap-3 text-center sm:items-start sm:text-start">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-lighter">
                    <step.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                  </div>
                  <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Step {i + 1}</p>
                  <h3 className="text-base font-bold text-text">{step.title}</h3>
                  <p className="text-sm text-text-secondary">{step.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="flex flex-col gap-8">
          <Reveal className="flex flex-col items-center gap-2 text-center">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Pricing</p>
            <h2 className="text-3xl font-extrabold text-text">Simple pricing that grows with you.</h2>
            <p className="max-w-md text-sm text-text-secondary">
              Prices in INR, billed monthly. Start free, no credit card required, cancel anytime.
            </p>
          </Reveal>
          <div className="grid gap-6 lg:grid-cols-3">
            {PRICING_TIERS.map((tier, i) => (
              <Reveal key={tier.name} delay={i * 80}>
                <Card
                  className={`relative flex h-full flex-col gap-5 p-6 ${
                    tier.highlighted ? "border-primary shadow-[var(--shadow-elevated)]" : ""
                  }`}
                >
                  {tier.highlighted && (
                    <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-white">
                      Most popular
                    </span>
                  )}
                  <div>
                    <h3 className="text-base font-bold text-text">{tier.name}</h3>
                    <p className="mt-1 text-sm text-text-secondary">{tier.tagline}</p>
                  </div>
                  <p className="text-3xl font-extrabold text-text">
                    {tier.price}
                    <span className="text-sm font-medium text-text-muted">/month</span>
                  </p>
                  <ul className="flex flex-1 flex-col gap-2">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-text-secondary">
                        <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link href={tier.name === "Scale" ? "mailto:contact@evernaro.com?subject=Evernaro%20Scale%20plan" : "/signup"}>
                    <Button variant={tier.highlighted ? "primary" : "secondary"} className="w-full">
                      {tier.name === "Starter" && "Start free"}
                      {tier.name === "Growth" && "Start free trial"}
                      {tier.name === "Scale" && "Contact sales"}
                    </Button>
                  </Link>
                </Card>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="text-center text-sm text-text-muted">
              WhatsApp send costs billed separately at Meta&apos;s per-conversation rates, capped by your
              prepaid wallet. Need a custom plan?{" "}
              <a href="mailto:contact@evernaro.com" className="cursor-pointer text-primary hover:text-primary-hover">
                Talk to us
              </a>
              .
            </p>
          </Reveal>
        </section>

        {/* FAQ */}
        <section className="flex flex-col gap-8">
          <Reveal className="flex flex-col items-center gap-2 text-center">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">FAQ</p>
            <h2 className="text-3xl font-extrabold text-text">Questions, answered.</h2>
            <p className="max-w-md text-sm text-text-secondary">{FAQ_BLURB}</p>
          </Reveal>
          <Reveal>
            <Faq />
          </Reveal>
        </section>

        {/* Final CTA */}
        <section>
          <Reveal>
            <Card className="relative flex flex-col items-center gap-3 overflow-hidden p-6 text-center sm:flex-row sm:items-center sm:justify-between sm:text-start sm:p-8">
              <div className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full bg-primary-lighter blur-2xl" aria-hidden="true" />
              <div className="relative flex flex-col items-center sm:items-start">
                <h2 className="text-xl font-bold text-text sm:text-2xl">
                  Ready to bring every channel into one inbox?
                </h2>
                <p className="mt-1 flex flex-col items-center gap-1.5 text-sm text-text-secondary sm:flex-row sm:items-center">
                  <Bell className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
                  <span>Set up takes a few minutes — connect your first channel right after signing up.</span>
                </p>
              </div>
              <div className="relative flex flex-col items-center gap-2 sm:flex-row">
                <Link href="/signup" className="relative">
                  <Button size="lg">Start free</Button>
                </Link>
                <a
                  href={process.env.NEXT_PUBLIC_DEMO_BOOKING_URL ?? "mailto:contact@evernaro.com?subject=Book%20a%20demo"}
                  className="relative"
                >
                  <Button variant="secondary" size="lg">Book a demo</Button>
                </a>
              </div>
            </Card>
          </Reveal>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <Logo height={24} />
            <div className="flex flex-wrap justify-center gap-2">
              {CHANNELS.map((c) => (
                <span
                  key={c.label}
                  className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-text-muted"
                >
                  <c.icon className="h-3 w-3" aria-hidden="true" />
                  {c.label}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border pt-4 text-xs text-text-muted sm:flex-row">
            <span>&copy; 2026 Eversity Tech LLP</span>
            <div className="flex items-center gap-4">
              <Link href="/terms" className="cursor-pointer hover:text-text-secondary">
                Terms
              </Link>
              <Link href="/privacy" className="cursor-pointer hover:text-text-secondary">
                Privacy
              </Link>
              <a href="mailto:contact@evernaro.com" className="cursor-pointer hover:text-text-secondary">
                Contact
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
