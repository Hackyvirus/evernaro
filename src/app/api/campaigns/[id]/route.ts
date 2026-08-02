import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgId, UnauthorizedError } from "@/lib/session";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const orgId = await requireOrgId();
    const { id } = await params;

    const campaign = await prisma.campaign.findFirst({
      where: { id, orgId },
      include: {
        channel: { select: { type: true } },
        recipients: { include: { contact: true }, orderBy: { id: "asc" } },
      },
    });
    if (!campaign) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load campaign" }, { status: 500 });
  }
}
