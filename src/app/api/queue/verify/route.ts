import { NextResponse } from "next/server";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { requireOrgMember, UnauthorizedError, ForbiddenError } from "@/lib/session";
import { verifyQueueEntry } from "@/lib/services/queue-service";

const verifySchema = z.object({
  publicToken: z.string().min(1),
  code: z.string().length(6),
});

export async function POST(req: Request) {
  try {
    const { orgId } = await requireOrgMember(UserRole.AGENT);

    const body = await req.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const result = await verifyQueueEntry(parsed.data.publicToken, parsed.data.code, orgId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ entry: result.entry });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof ForbiddenError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return NextResponse.json({ error: "Failed to verify queue entry" }, { status: 500 });
  }
}
