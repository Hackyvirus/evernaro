import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

// generateDraftReply is invoked via keepAlive() from webhook routes so the
// inbound webhook can respond immediately while the draft is generated in the
// background. keepAlive uses Vercel's waitUntil when available, and falls back
// to fire-and-forget with logging on long-lived Node processes.

type ChatMessage = { role: "user" | "assistant"; content: string };

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function getOpenAI() {
  if (!process.env.OPENAI_API_KEY) return null;
  if (!openaiClient) openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

function getAnthropic() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!anthropicClient) anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return anthropicClient;
}

async function draftWithOpenAI(systemPrompt: string, history: ChatMessage[]): Promise<string | null> {
  const client = getOpenAI();
  if (!client) return null;

  const response = await client.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    max_tokens: 500,
    messages: [{ role: "system", content: systemPrompt }, ...history],
  });

  return response.choices[0]?.message?.content?.trim() || null;
}

async function draftWithAnthropic(systemPrompt: string, history: ChatMessage[]): Promise<string | null> {
  const client = getAnthropic();
  if (!client) return null;

  const response = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
    max_tokens: 500,
    system: systemPrompt,
    messages: history,
  });

  const text = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  return text || null;
}

/**
 * Dispatches to whichever AI provider is configured via AI_PROVIDER
 * (defaults to "openai"). Both providers can be wired up at once — this is
 * the single seam to add a fallback chain or per-org provider choice later.
 */
async function draftFromModel(systemPrompt: string, history: ChatMessage[]): Promise<string | null> {
  const provider = (process.env.AI_PROVIDER || "openai").toLowerCase();
  if (provider === "anthropic") return draftWithAnthropic(systemPrompt, history);
  return draftWithOpenAI(systemPrompt, history);
}

// Fetched fresh per request rather than hardcoded, so pricing/plan changes
// in the DB show up immediately instead of silently drifting out of sync
// with whatever a static prompt string once said.
async function getCurrentPricingSummary(): Promise<string> {
  try {
    const plans = await prisma.subscriptionPlan.findMany({
      where: { isActive: true, isCustom: false },
      orderBy: { displayOrder: "asc" },
      select: { name: true, monthlyPriceInr: true, annualPriceInr: true, trialDays: true },
    });
    if (plans.length === 0) return "";
    const lines = plans.map((p) => {
      const price = p.monthlyPriceInr === 0 ? "Free" : `₹${p.monthlyPriceInr}/month`;
      const trial = p.trialDays > 0 ? ` (${p.trialDays}-day free trial, no card required)` : "";
      return `- ${p.name}: ${price}${trial}`;
    });
    return `\n\nCurrent pricing (INR, confirm exact details at https://evernaro.com/pricing):\n${lines.join("\n")}\nWhatsApp send costs are billed separately at Meta's per-conversation rates, from a prepaid wallet.`;
  } catch {
    return "";
  }
}

async function buildChatbotSystemPrompt(): Promise<string> {
  const pricing = await getCurrentPricingSummary();
  return `You are the Evernaro Assistant, a helpful, friendly chatbot on the Evernaro marketing website whose job is to help visitors understand the product and move toward starting a free trial or booking a demo.

Evernaro is a real-time customer flow platform for appointment- and queue-based businesses (currently focused on clinics/dental, also used by salons, restaurants, auto service, and other walk-in/appointment businesses), built by Eversity Tech LLP. Key facts:
- Live queues: customers join remotely via QR code or link, see their position update in real time, and get notified when it's their turn.
- Appointments: booking, staff/service scheduling, and a public booking page for each business.
- One shared inbox for WhatsApp, Telegram, Email, and Instagram — no more juggling five apps.
- AI drafts replies from the business's own knowledge base; a human always reviews before anything sends.
- Prepaid WhatsApp wallet — no surprise bills.
- Campaigns, reminders, review requests, analytics, and billing all built in.
- Built for Indian businesses; voice reminders comply with TRAI/DND rules.
- Website: https://evernaro.com
- Support email: support@evernaro.com
- Contact email: contact@evernaro.com${pricing}

When a visitor describes their business, briefly relate Evernaro's queue/appointment features to their specific situation rather than reciting the full feature list. When they show buying intent (asking about price, trial, or "how do I start"), point them clearly to signing up at https://evernaro.com/signup — mention the free trial. Keep answers concise, friendly, and accurate. If you don't know something (or it's about a topic unrelated to Evernaro, like a person or an outside company), say so plainly and direct the user to contact@evernaro.com or support@evernaro.com. Never make up pricing or features beyond what's listed above.`;
}

export async function generateChatResponse(history: ChatMessage[]): Promise<string | null> {
  const systemPrompt = await buildChatbotSystemPrompt();
  return draftFromModel(systemPrompt, history);
}

// Serializes generateDraftReply calls per conversation. Without this, two
// inbound messages arriving seconds apart could each kick off a concurrent
// LLM call, and both would see "no existing draft" before either finished,
// producing two drafts (one built from stale, incomplete context).
const conversationLocks = new Map<string, Promise<unknown>>();

function withConversationLock<T>(conversationId: string, fn: () => Promise<T>): Promise<T> {
  const prior = conversationLocks.get(conversationId) ?? Promise.resolve();
  const run = prior.then(fn, fn);
  conversationLocks.set(
    conversationId,
    run.then(
      () => undefined,
      () => undefined
    )
  );
  return run;
}

/**
 * Generates an AI-suggested reply for a conversation and stores it as an
 * unsent draft message (isAiDraft: true). Agents review/edit it in the inbox
 * before it's actually sent to the customer.
 */
export async function generateDraftReply(conversationId: string): Promise<void> {
  return withConversationLock(conversationId, () => generateDraftReplyUnlocked(conversationId));
}

async function generateDraftReplyUnlocked(conversationId: string): Promise<void> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      org: { include: { businessProfile: true } },
      contact: true,
      messages: { orderBy: { createdAt: "asc" }, take: 30 },
    },
  });
  if (!conversation) return;

  const lastMessage = conversation.messages.at(-1);

  const profile = conversation.org.businessProfile;
  const systemPrompt = [
    `You are a customer-support assistant replying on behalf of "${profile?.businessName ?? conversation.org.name}".`,
    profile?.industry ? `Industry: ${profile.industry}.` : "",
    profile?.description ? `About the business: ${profile.description}` : "",
    profile?.knowledgeBase ? `Knowledge base / policies / pricing:\n${profile.knowledgeBase}` : "",
    `Tone: ${profile?.tone ?? "friendly and professional"}.`,
    profile?.signOff ? `Sign off messages with: ${profile.signOff}` : "",
    "Write a concise, ready-to-send reply to the customer's latest message. Do not add explanations or preambles — output only the reply text.",
  ]
    .filter(Boolean)
    .join("\n");

  const history: ChatMessage[] = conversation.messages.map((m) => ({
    role: m.direction === "INBOUND" ? "user" : "assistant",
    content: m.body,
  }));

  if (history.length === 0) return;

  const text = await draftFromModel(systemPrompt, history);
  if (!text) return; // no provider configured — skip silently, agent replies manually

  // The LLM call can take a few seconds. If a newer message landed (customer
  // sent another message, or an agent already replied manually) while we
  // were waiting, this draft is stale — drop it instead of resurrecting an
  // answer to a conversation state that's since moved on.
  const latestMessageId = await prisma.message.findFirst({
    where: { conversationId, isAiDraft: false },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (latestMessageId?.id !== lastMessage?.id) return;

  await prisma.$transaction([
    prisma.message.deleteMany({ where: { conversationId, isAiDraft: true } }),
    prisma.message.create({
      data: {
        conversationId,
        direction: "OUTBOUND",
        sender: "AI",
        body: text,
        isAiDraft: true,
      },
    }),
  ]);
}
