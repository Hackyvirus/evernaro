const FAQS = [
  {
    question: "What exactly does Evernaro do?",
    answer:
      "Evernaro helps businesses manage the complete customer journey — from queue check-ins and appointment bookings to live status tracking, notifications, service completion, and follow-ups. The unified inbox, WhatsApp, email, Telegram, Instagram and AI assistance are built in to support that journey.",
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
      "Yes. You can schedule appointment reminders, follow-ups and review requests through the channels you configure. Customers also see live tracker updates for their queue position.",
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
      "Yes. You can add branches under one organization, and services, staff, appointments, and queues can all be scoped to a specific location from the dashboard.",
  },
  {
    question: "Does Evernaro support payments?",
    answer:
      "Evernaro includes Razorpay integration for your own subscription billing and a prepaid WhatsApp wallet. Direct customer payment collection for services is on the roadmap.",
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
      "Plans start at ₹499/month. WhatsApp send costs are billed separately from your prepaid wallet at Meta's per-conversation rates. Start with a 14-day free trial — no credit card required.",
  },
  {
    question: "Do I need technical help to set up?",
    answer:
      "No. Create an account, add your services and staff, then share your queue link or booking page. Channel setup (WhatsApp/Telegram/etc.) uses the keys from your provider and is documented in Settings.",
  },
];

export function Faq() {
  return (
    <div className="mx-auto grid w-full max-w-4xl gap-4 sm:grid-cols-2">
      {FAQS.map((item) => (
        <div
          key={item.question}
          className="rounded-lg border border-border bg-card p-5"
        >
          <h3 className="mb-2 text-sm font-bold text-text">{item.question}</h3>
          <p className="text-sm leading-relaxed text-text-secondary">{item.answer}</p>
        </div>
      ))}
    </div>
  );
}
