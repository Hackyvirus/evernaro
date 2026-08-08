"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    question: "What exactly does Evernaro do?",
    answer:
      "Evernaro helps businesses manage the complete customer journey — from queue check-ins and appointment bookings to live position tracking, notifications, service completion, payments, and follow-ups. The unified inbox, WhatsApp, email, Telegram, Instagram and AI assistance are built in to support that journey.",
  },
  {
    question: "Can customers join a queue remotely?",
    answer:
      "Yes. You can display a QR code or share a link. Customers scan or tap, enter their name and phone, and receive a token without installing anything.",
  },
  {
    question: "Can customers see their live position?",
    answer:
      "Yes. Each customer gets a personal tracker page that updates automatically with their current position, estimated wait, and status.",
  },
  {
    question: "Can I use queues and appointments together?",
    answer:
      "Yes. Evernaro supports both scheduled appointments and walk-in queues. You can run them side by side for the same service or location.",
  },
  {
    question: "Can Evernaro automatically notify customers?",
    answer:
      "Yes. You can schedule appointment reminders, payment reminders, follow-ups and review requests. Customers also see live tracker updates for their queue position.",
  },
  {
    question: "Which industries can use Evernaro?",
    answer:
      "The platform is configured for salons, clinics, dental practices, restaurants, auto service centers, home services, real estate, education, legal services, and wellness/spas. Each industry gets relevant terminology and default services.",
  },
  {
    question: "Can I connect WhatsApp?",
    answer:
      "Yes. Evernaro connects to WhatsApp Business API via Gupshup. It also supports Telegram, Email, Instagram and voice reminders through Twilio.",
  },
  {
    question: "Does Evernaro support multiple locations?",
    answer:
      "Multiple locations are not yet a first-class feature in the dashboard. For now each location can run as a separate organization.",
  },
  {
    question: "Does Evernaro support payments?",
    answer:
      "Yes. Evernaro includes Razorpay integration for subscription billing and a prepaid WhatsApp wallet. Direct customer payment collection for services is on the roadmap.",
  },
  {
    question: "How does the AI assistant work?",
    answer:
      "AI drafts replies based on your knowledge base and business profile. A human on your team reviews, edits and sends every message — nothing goes out automatically.",
  },
  {
    question: "Does AI send messages automatically?",
    answer:
      "No. Evernaro keeps humans in control. AI drafts are suggestions that your team approves before sending.",
  },
  {
    question: "What does Evernaro cost?",
    answer:
      "Plans start at ₹1,499/month. WhatsApp send costs are billed separately from your prepaid wallet at Meta's per-conversation rates. Start with a 14-day free trial — no credit card required.",
  },
  {
    question: "Do I need technical help to set up?",
    answer:
      "No. Create an account, add your services and staff, then share your queue link or booking page. Channel setup (WhatsApp/Telegram/etc.) uses the keys from your provider and is documented in Settings.",
  },
];

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.question} className="rounded-lg border border-border bg-card">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              aria-expanded={isOpen}
              className="flex w-full cursor-pointer items-center justify-between gap-4 px-5 py-4 text-start"
            >
              <span className="text-sm font-semibold text-text">{item.question}</span>
              <ChevronDown
                className={`h-4 w-4 flex-shrink-0 text-text-muted transition-transform duration-200 ${
                  isOpen ? "rotate-180" : ""
                }`}
                aria-hidden="true"
              />
            </button>
            <div
              className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-5 pb-4 text-sm leading-relaxed text-text-secondary">{item.answer}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
