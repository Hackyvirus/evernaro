import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const schema = z.object({ locationId: z.string().cuid() });

export async function PUT(req: Request) {
  const member = await requireOrgMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
  }

  const location = await prisma.location.findFirst({
    where: { id: parsed.data.locationId, orgId: member.orgId },
  });
  if (!location) return NextResponse.json({ error: "Location not found" }, { status: 404 });

  await prisma.organization.update({
    where: { id: member.orgId },
    data: { activeLocationId: location.id },
  });

  return NextResponse.json({ ok: true });
}
