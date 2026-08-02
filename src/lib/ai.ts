import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

// generateDraftReply is always invoked unawaited (fire-and-forget) from
// webhook routes so the inbound webhook can respond immediately. This is
// safe on a long-lived Node process (the assumed deployment model here —
// `next start` / a persistent container), where the process stays alive to
// finish the promise after the HTTP response is sent. It is NOT safe on a
// serverless/edge runtime that freezes execution the instant the response is
// returned — there, wrap these call sites in that platform's request-
// lifecycle extension (e.g. Vercel's `waitUntil`) or drafts will silently
// stop appearing with nothing logged.

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
