import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/session";
import { generateReceiptPdf } from "@/lib/billing/pdf";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireOrgMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const payment = await prisma.payment.findFirst({ where: { id, orgId: member.orgId } });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await generateReceiptPdf(id);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="receipt-${id}.pdf"`,
    },
  });
}
