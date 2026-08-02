// Starter content per industry vertical — the actual product differentiator
// over generic inbox tools: a client should be productive in minutes, not
// starting from a blank Business Profile. "Use this" prefills the relevant
// form; nothing is saved or submitted automatically, so the client always
// reviews and edits before anything goes live.

export interface VerticalPreset {
  id: string;
  label: string;
  businessProfile: {
    industry: string;
    description: string;
    tone: string;
    knowledgeBase: string;
    signOff: string;
  };
  campaignMessage: string;
  whatsappTemplates: Array<{
    name: string;
    category: "UTILITY" | "MARKETING";
    bodyText: string;
    description: string;
  }>;
}

export const VERTICAL_PRESETS: VerticalPreset[] = [
  {
    id: "real-estate",
    label: "Real Estate",
    businessProfile: {
      industry: "Real Estate",
      description:
        "We help buyers, renters, and investors find residential and commercial properties — from the first inquiry through site visits, paperwork, and closing.",
      tone: "warm, professional, and responsive — like a knowledgeable local agent, not a call center",
      knowledgeBase: `Site visits: Available 7 days a week, 10 AM–7 PM. We recommend booking at least a day in advance.

Brokerage fee: Typically 1-2% of the transaction value, payable on closing — confirm the exact rate per listing.

Documents needed to proceed: Government photo ID, address proof, and PAN card (for Indian transactions). For rentals, we also collect the last 3 months of income proof.

Financing: We can connect buyers with our partner bank/NBFC contacts for home loan pre-approval — mention this if a lead asks about financing.

Negotiability: Listed prices are usually negotiable within a small range — never quote a final number without checking with the listing owner first.

Cancellations: Site visits can be rescheduled free of charge up to 2 hours before the appointment.`,
      signOff: "Talk soon!",
    },
    campaignMessage:
      "Hi {{name}}, we've just listed a new property that matches what you're looking for. Reply here and we'll send over the details and photos!",
    whatsappTemplates: [
      {
        name: "site_visit_reminder",
        category: "UTILITY",
        bodyText: "Hi {{1}}, this is a reminder that your site visit is scheduled for tomorrow. Reply here if you'd like to reschedule.",
        description: "Send the day before a scheduled site visit.",
      },
      {
        name: "new_listing_alert",
        category: "MARKETING",
        bodyText: "Hi {{1}}, we've just listed a new property that matches what you're looking for. Would you like the details?",
        description: "Proactively notify a lead about a new matching listing.",
      },
      {
        name: "document_checklist",
        category: "UTILITY",
        bodyText: "Hi {{1}}, to move forward with your booking, please share: government ID, address proof, and PAN card.",
        description: "Send once a lead is ready to proceed, to collect required documents.",
      },
    ],
  },
];
