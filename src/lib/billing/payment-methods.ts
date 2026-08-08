"server-only";
import { prisma } from "@/lib/prisma";
import { fetchRazorpayTokens, deleteRazorpayToken } from "./razorpay-billing";

export async function syncPaymentMethods(orgId: string) {
  const org = await prisma.organization.findUnique({ where: { id: orgId }, select: { razorpayCustomerId: true } });
  if (!org?.razorpayCustomerId) return [];

  const tokens = await fetchRazorpayTokens(org.razorpayCustomerId).catch((err) => {
    console.error("Failed to fetch Razorpay tokens:", err);
    return [];
  });

  const methods = [];
  for (const token of tokens) {
    const type = token.card ? "card" : token.vpa ? "upi" : token.wallet ? "wallet" : "unknown";
    const existing = await prisma.paymentMethod.findFirst({
      where: { orgId, token: token.token },
    });
    const data = {
      orgId,
      type,
      network: token.card?.network ?? null,
      last4: token.card?.last4 ?? token.vpa ?? token.wallet ?? null,
      token: token.token,
      razorpayCustomerId: org.razorpayCustomerId,
      status: token.status === "active" ? "active" : "expired",
      metadata: token as never,
    };
    const method = existing
      ? await prisma.paymentMethod.update({ where: { id: existing.id }, data })
      : await prisma.paymentMethod.create({ data });
    methods.push(method);
  }

  return methods;
}

export async function getPaymentMethods(orgId: string) {
  await syncPaymentMethods(orgId);
  return prisma.paymentMethod.findMany({ where: { orgId, status: "active" }, orderBy: { isDefault: "desc" } });
}

export async function setDefaultPaymentMethod(orgId: string, id: string) {
  await prisma.$transaction([
    prisma.paymentMethod.updateMany({ where: { orgId }, data: { isDefault: false } }),
    prisma.paymentMethod.updateMany({ where: { orgId, id }, data: { isDefault: true } }),
  ]);
}

export async function removePaymentMethod(orgId: string, id: string) {
  const method = await prisma.paymentMethod.findFirst({ where: { orgId, id } });
  if (!method) throw new Error("Payment method not found");
  if (method.razorpayCustomerId) {
    await deleteRazorpayToken(method.razorpayCustomerId, method.token).catch((err) => {
      console.error("Failed to delete Razorpay token:", err);
    });
  }
  await prisma.paymentMethod.update({ where: { id }, data: { status: "revoked" } });
}
