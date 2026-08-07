import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const templates = await prisma.industryTemplate.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: {
      code: true,
      name: true,
      description: true,
    },
  });

  return NextResponse.json({ templates });
}
