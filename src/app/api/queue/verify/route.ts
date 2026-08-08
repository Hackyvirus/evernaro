import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { verifyQueueEntry } from "@/lib/services/queue-service";

const verifySchema = z.object({
  publicToken: z.string().min(1),
  code: z.string().length(6),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.orgId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = verifySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const result = await verifyQueueEntry(parsed.data.publicToken, parsed.data.code, session.user.orgId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ entry: result.entry });
}
