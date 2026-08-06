import { NextResponse } from "next/server";
import { z } from "zod";
import { sendContactEmail } from "@/lib/email-categories";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  message: z.string().min(10),
});

export async function POST(req: Request) {
  const allowed = await checkRateLimit(`contact:${clientIp(req)}`, 3, 60 * 60);
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

  const { name, email, message } = parsed.data;

  try {
    await sendContactEmail({
      to: "contact@evernaro.com",
      replyTo: email,
      subject: `Contact form: ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
    });
  } catch (err) {
    console.error("Failed to send contact email:", err);
    return NextResponse.json({ error: "Failed to send message — try again later." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
