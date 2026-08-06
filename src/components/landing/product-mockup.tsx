import {
  BarChart3,
  Bell,
  Check,
  Megaphone,
  MessageSquare,
  Receipt,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import { Logo } from "@/components/ui";

const NAV = [
  { icon: MessageSquare, label: "Inbox", active: true },
  { icon: Users, label: "Contacts" },
  { icon: Megaphone, label: "Campaigns" },
  { icon: Bell, label: "Reminders" },
  { icon: BarChart3, label: "Analytics" },
  { icon: Receipt, label: "Billing" },
  { icon: Settings, label: "Settings" },
];

const CONVERSATIONS = [
  {
    name: "Ananya Sharma",
    channel: "WhatsApp",
    preview: "Is the 2 BHK at Skyline still available?",
    time: "2m",
  },
  {
    name: "Rajesh Verma",
    channel: "Telegram",
    preview: "AI draft ready — Thanks for reaching out...",
    time: "9m",
  },
  {
    name: "Priya Nair",
    channel: "Email",
    preview: "Can I reschedule my consultation to Friday?",
    time: "1h",
  },
  {
    name: "Arjun Mehta",
    channel: "Instagram",
    preview: "What are your rates for bulk orders?",
    time: "3h",
  },
];

export function ProductMockup() {
  return (
    <div className="relative min-w-0">
      <div className="animate-hero overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-elevated)]">
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
          <div className="mx-auto flex w-full max-w-xs items-center justify-center gap-1.5 rounded-md bg-card px-3 py-1 text-xs text-text-muted">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            evernaro.com/inbox
          </div>
        </div>

        <div className="flex min-w-0">
          {/* Sidebar */}
          <div className="hidden min-w-0 w-40 flex-col border-r border-border bg-surface p-3 lg:flex">
            <div className="mb-4 flex flex-col gap-0.5 px-1">
              <Logo height={20} />
              <p className="text-[10px] text-text-muted">Skyline Realty</p>
            </div>
            <nav className="flex flex-col gap-0.5">
              {NAV.map((item) => (
                <span
                  key={item.label}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
                    item.active
                      ? "bg-primary-light font-medium text-primary"
                      : "text-text-secondary"
                  }`}
                >
                  <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {item.label}
                </span>
              ))}
            </nav>
          </div>

          {/* Main */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-bold text-text">Inbox</p>
                <p className="text-[11px] text-text-muted">Every channel, one thread list.</p>
              </div>
              <span className="rounded-full bg-primary-light px-2 py-0.5 text-[10px] font-medium text-primary">
                5 channels live
              </span>
            </div>

            <div className="flex min-h-0 flex-1">
              {/* Conversation list */}
              <ul className="hidden min-w-0 w-44 flex-col divide-y divide-border border-r border-border lg:flex">
                {CONVERSATIONS.map((c, i) => (
                  <li
                    key={c.name}
                    className={`flex flex-col gap-0.5 px-3 py-2.5 ${i === 0 ? "bg-hover" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-text">{c.name}</span>
                      <span className="text-[10px] text-text-muted">{c.time}</span>
                    </div>
                    <span
                      className={`truncate text-[11px] ${
                        c.preview.startsWith("AI draft") ? "font-medium text-warning" : "text-text-secondary"
                      }`}
                    >
                      {c.preview}
                    </span>
                    <span className="text-[10px] text-text-muted">{c.channel}</span>
                  </li>
                ))}
              </ul>

              {/* Chat panel */}
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-1 flex-col gap-2 overflow-hidden px-4 py-3">
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-lg bg-surface px-3 py-1.5 text-[11px] text-text shadow-[var(--shadow-card)]">
                      Hi! Is the 2 BHK at Skyline Heights still available for visit this weekend?
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-lg bg-surface px-3 py-1.5 text-[11px] text-text shadow-[var(--shadow-card)]">
                      What are the exact prices for the 3rd floor?
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-lg bg-primary px-3 py-1.5 text-[11px] text-white">
                      Hi Ananya, yes — both the 2 BHK and 3rd-floor 3 BHK are open this weekend.
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="w-full max-w-[85%] rounded-lg border border-dashed border-warning bg-warning-light px-3 py-1.5">
                      <p className="mb-0.5 flex items-center gap-1 text-[9px] font-medium tracking-wide text-warning uppercase">
                        <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                        AI draft — review before sending
                      </p>
                      <p className="text-[11px] text-text">
                        The 3rd-floor 3 BHK is ₹2.15 Cr. Want to schedule a visit this weekend?
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
                  <div className="flex-1 rounded-md border border-border bg-surface px-3 py-2 text-[11px] text-text-muted">
                    Type a reply...
                  </div>
                  <span className="rounded-md bg-primary px-3 py-2 text-[11px] font-medium text-white">
                    Send
                  </span>
                  <span className="hidden rounded-md border border-border px-3 py-2 text-[11px] text-text-secondary sm:block">
                    AI draft
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating cards */}
      <div className="animate-float absolute left-2 top-2 hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-[var(--shadow-elevated)] sm:flex">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-success-light">
          <Check className="h-4 w-4 text-success" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-medium text-text">Template approved</p>
          <p className="text-[10px] text-text-muted">appointment_reminder</p>
        </div>
      </div>

      <div className="animate-float-slow absolute -bottom-5 right-2 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-[var(--shadow-elevated)]">
        <span className="relative flex h-2 w-2">
          <span className="animate-live-pulse absolute inline-flex h-full w-full rounded-full bg-primary" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <p className="text-xs font-medium text-text">New message — Telegram</p>
      </div>
    </div>
  );
}
