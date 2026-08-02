import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Button, Card } from "@/components/ui";
import {
  BarChart3,
  Bell,
  Bot,
  Camera,
  Check,
  CheckCircle2,
  Mail,
  MessageSquare,
  PhoneCall,
  PlugZap,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const CHANNELS = [
  { icon: MessageSquare, label: "Telegram" },
  { icon: Mail, label: "Email" },
  { icon: Send, label: "WhatsApp" },
  { icon: Camera, label: "Instagram" },
  { icon: PhoneCall, label: "Voice reminders" },
];

const FEATURES = [
  {
    icon: Sparkles,
    title: "AI drafts, you decide",
    description:
      "Every reply starts as an AI-drafted suggestion pulled from your business knowledge base — a person reviews, edits, and sends. Nothing goes out on its own.",
  },
  {
    icon: BarChart3,
    title: "Campaigns and reminders",
    description:
      "Send a message to every reachable contact on a channel, or schedule one-off and recurring reminders — appointments, payments, follow-ups.",
  },
  {
    icon: ShieldCheck,
    title: "Built for compliance",
    description:
      "WhatsApp template enforcement outside the 24-hour window, and Voice calling scoped only to individually-scheduled reminders — never bulk or cold calling.",
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
    icon: CheckCircle2,
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

export default async function Home() {
  const session = await auth();
  if (session) redirect("/inbox");

  return (
    <div className="flex flex-1 flex-col bg-surface">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="text-base font-extrabold tracking-tight text-primary">EverReach</span>
        <nav className="flex items-center gap-3">
          <Link href="/login" className="cursor-pointer text-sm text-text-secondary hover:text-text">
            Log in
          </Link>
          <Link href="/signup">
            <Button size="sm">Get started</Button>
          </Link>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-6 pt-8 pb-20">
        <section className="flex flex-col items-start gap-5">
          <p className="text-xs font-medium tracking-wide text-primary uppercase">By Eversity Tech LLP</p>
          <h1 className="max-w-2xl text-5xl font-extrabold text-text sm:text-6xl">
            One inbox for every customer conversation.
          </h1>
          <p className="max-w-xl text-lg text-text-secondary">
            Telegram, Email, WhatsApp, Instagram, and Voice reminders — in one place, with
            AI-drafted replies your team reviews before they go out.
          </p>
          <div className="flex items-center gap-3 pt-2">
            <Link href="/signup">
              <Button>Create your account</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary">Log in</Button>
            </Link>
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            {CHANNELS.map((c) => (
              <span
                key={c.label}
                className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs text-text-secondary"
              >
                <c.icon className="h-3.5 w-3.5" aria-hidden="true" />
                {c.label}
              </span>
            ))}
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="flex flex-col gap-3 p-5">
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary-lighter">
                <f.icon className="h-[18px] w-[18px] text-primary" aria-hidden="true" />
              </div>
              <h2 className="text-sm font-bold text-text">{f.title}</h2>
              <p className="text-sm text-text-secondary">{f.description}</p>
            </Card>
          ))}
        </section>

        <section className="flex flex-col gap-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">How it works</p>
            <h2 className="text-3xl font-extrabold text-text">From new message to sent reply, in three steps.</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {HOW_IT_WORKS.map((step, i) => (
              <div key={step.title} className="flex flex-col items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-lighter">
                  <step.icon className="h-5 w-5 text-primary" aria-hidden="true" />
                </div>
                <p className="text-xs font-semibold tracking-wide text-text-muted uppercase">Step {i + 1}</p>
                <h3 className="text-base font-bold text-text">{step.title}</h3>
                <p className="text-sm text-text-secondary">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-xs font-medium tracking-wide text-primary uppercase">Pricing</p>
            <h2 className="text-3xl font-extrabold text-text">Simple pricing that grows with you.</h2>
            <p className="max-w-md text-sm text-text-secondary">
              Prices in INR, billed monthly. No setup fees, cancel anytime.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {PRICING_TIERS.map((tier) => (
              <Card
                key={tier.name}
                className={`relative flex flex-col gap-5 p-6 ${
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
                <Link href="/signup">
                  <Button variant={tier.highlighted ? "primary" : "secondary"} className="w-full">
                    Get started
                  </Button>
                </Link>
              </Card>
            ))}
          </div>
        </section>

        <section>
          <Card className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-text">Ready to bring every channel into one inbox?</h2>
              <p className="mt-1 text-sm text-text-secondary">
                <Bell className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
                Set up takes a few minutes — connect your first channel right after signing up.
              </p>
            </div>
            <Link href="/signup">
              <Button>Get started</Button>
            </Link>
          </Card>
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center justify-between gap-3 text-xs text-text-muted sm:flex-row">
          <span>© 2026 Eversity Tech LLP</span>
          <div className="flex items-center gap-4">
            <Link href="/terms" className="cursor-pointer hover:text-text-secondary">
              Terms
            </Link>
            <Link href="/privacy" className="cursor-pointer hover:text-text-secondary">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
