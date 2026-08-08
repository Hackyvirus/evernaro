import { NextResponse } from "next/server";
import { requireOrgMember } from "@/lib/session";
import { generateInvoicePdf } from "@/lib/billing/pdf";
import { prisma } from "@/lib/prisma";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const member = await requireOrgMember();
  if (!member) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({ where: { id, orgId: member.orgId } });
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const pdf = await generateInvoicePdf(id);
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${id}.pdf"`,
    },
  });
}
