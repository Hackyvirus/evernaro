import { NextResponse } from "next/server";
import { z } from "zod";
import { generateChatResponse } from "@/lib/ai";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(2000),
});

const schema = z.object({
  messages: z.array(messageSchema).max(20),
});

export async function POST(req: Request) {
  const allowed = await checkRateLimit(`chat:${clientIp(req)}`, 30, 60 * 60);
  if (!allowed) {
    return NextResponse.json({ error: "Too many messages — try again later." }, { status: 429 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "The assistant is not configured yet." },
      { status: 503 }
    );
  }

  const reply = await generateChatResponse(parsed.data.messages);
  if (!reply) {
    return NextResponse.json({ error: "The assistant couldn't generate a response." }, { status: 502 });
  }

  return NextResponse.json({ reply });
}
