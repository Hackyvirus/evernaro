"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

const FAQS = [
  {
    question: "Which channels can I connect?",
    answer:
      "Telegram, Email, WhatsApp, Instagram, and Voice reminders. Connect them in Settings with the keys your channel provider gives you — no code, no IT ticket. New customer messages from every channel land in the same inbox.",
  },
  {
    question: "How does the AI draft replies?",
    answer:
      "Every incoming message gets an AI-drafted response pulled from your business profile and knowledge base (pricing, FAQs, policies you write once in Settings). A human on your team reviews, edits, and sends it — Evernaro never sends anything on its own.",
  },
  {
    question: "Why is WhatsApp different from the other channels?",
    answer:
      "Meta only lets businesses send free-form messages within 24 hours of a customer's last message. Outside that window you must use a pre-approved template. Evernaro handles both paths for you and warns you before you hit send into a rejection.",
  },
  {
    question: "Can I use Voice for bulk calling?",
    answer:
      "No — and that's deliberate. India's TRAI/DND rules restrict unsolicited automated calling, so Voice in Evernaro is wired only into individually-scheduled reminders to contacts already in your system. It is never available as a bulk campaign channel.",
  },
  {
    question: "What does it cost?",
    answer:
      "Plans start at ₹1,499/month. WhatsApp send costs are billed separately from your prepaid wallet at Meta's per-conversation rates, so a connected channel can never silently rack up unbounded spend.",
  },
  {
    question: "Do I need any technical help to set up?",
    answer:
      "No. Create an account, connect your channels with the keys from Telegram/Resend/Gupshup/Twilio/Meta, and paste webhook URLs where the Settings page shows them. Most businesses connect their first channel in minutes.",
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
