import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requirePlatformAdminId, UnauthorizedError } from "@/lib/session";
import { getOrCreateWallet, creditWallet, manualDebitWallet, InsufficientWalletBalanceError } from "@/lib/whatsapp-wallet";

const adjustSchema = z.object({
  action: z.enum(["credit", "debit"]),
  amountInr: z.number().positive(),
  note: z.string().min(1, "A note is required for manual wallet adjustments"),
});

const thresholdSchema = z.object({
  lowBalanceThresholdPaise: z.number().int().min(0),
});

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdminId();
    const { id } = await params;
    const wallet = await getOrCreateWallet(id);
    const transactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ wallet, transactions });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to load wallet" }, { status: 500 });
  }
}

// Manual credit/debit — for bank-transfer clients and one-off corrections,
// outside the self-serve Razorpay top-up flow.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdminId();
    const { id } = await params;
    const parsed = adjustSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Amount and a note are required" }, { status: 400 });
    }
    const { action, amountInr, note } = parsed.data;
    const amountPaise = Math.round(amountInr * 100);

    if (action === "credit") {
      const transaction = await creditWallet(id, amountPaise, "MANUAL_CREDIT", { note });
      return NextResponse.json({ ok: true, transaction });
    }
    const transaction = await manualDebitWallet(id, amountPaise, note);
    return NextResponse.json({ ok: true, transaction });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (err instanceof InsufficientWalletBalanceError) {
      return NextResponse.json({ error: "Debit exceeds current balance" }, { status: 400 });
    }
    return NextResponse.json({ error: "Failed to adjust wallet" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePlatformAdminId();
    const { id } = await params;
    const parsed = thresholdSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid threshold" }, { status: 400 });
    }
    const wallet = await getOrCreateWallet(id);
    const updated = await prisma.whatsAppWallet.update({
      where: { id: wallet.id },
      data: { lowBalanceThresholdPaise: parsed.data.lowBalanceThresholdPaise },
    });
    return NextResponse.json({ ok: true, wallet: updated });
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({ error: "Failed to update threshold" }, { status: 500 });
  }
}
