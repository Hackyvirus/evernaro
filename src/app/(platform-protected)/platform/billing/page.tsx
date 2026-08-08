import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui";
import { BillingCatalogTabs } from "./catalog-tabs";
import { requirePlatformAdminId } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SubscriptionStatus } from "@prisma/client";

async function BillingCatalogData() {
  await requirePlatformAdminId();

  const [plans, services, addOns, coupons, tax, subscriptions, payments] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        _count: { select: { subscriptions: true } },
        features: true,
        limits: { include: { service: true } },
      },
    }),
    prisma.billableService.findMany({ orderBy: { name: "asc" } }),
    prisma.addOn.findMany({ orderBy: { name: "asc" } }),
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.taxConfiguration.findFirst({ where: { enabled: true } }),
    prisma.customerSubscription.findMany({
      include: {
        org: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            users: { where: { role: "OWNER" }, select: { email: true, name: true } },
          },
        },
        plan: { select: { id: true, name: true, slug: true, monthlyPriceInr: true, annualPriceInr: true } },
        items: { include: { addOn: { select: { name: true } } } },
        invoices: { orderBy: { createdAt: "desc" }, take: 5 },
        payments: { where: { status: "PAID" }, select: { id: true, amountInr: true, createdAt: true, razorpayPaymentId: true, status: true } },
      },
    }),
    prisma.payment.findMany({ where: { status: "PAID" }, select: { amountInr: true, createdAt: true, subscriptionId: true } }),
  ]);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const activeSubscriptions = subscriptions.filter((s) => s.status === SubscriptionStatus.ACTIVE || s.status === SubscriptionStatus.TRIALING);
  const mrr = activeSubscriptions.reduce((sum, s) => {
    if (s.status === SubscriptionStatus.TRIALING) return sum;
    return sum + (s.frequency === "YEARLY" ? Math.round(s.totalAmountInr / 12) : s.totalAmountInr);
  }, 0);
  const arr = mrr * 12;
  const revenueThisMonth = payments.filter((p) => p.createdAt >= startOfMonth).reduce((sum, p) => sum + p.amountInr, 0);
  const totalRevenue = payments.reduce((sum, p) => sum + p.amountInr, 0);

  const statusCounts = {
    active: subscriptions.filter((s) => s.status === SubscriptionStatus.ACTIVE).length,
    trialing: subscriptions.filter((s) => s.status === SubscriptionStatus.TRIALING).length,
    pastDue: subscriptions.filter((s) => s.status === SubscriptionStatus.PAST_DUE).length,
    paymentFailed: subscriptions.filter((s) => s.status === SubscriptionStatus.PAYMENT_FAILED).length,
    cancelled: subscriptions.filter((s) => s.status === SubscriptionStatus.CANCELLED).length,
    paused: subscriptions.filter((s) => s.status === SubscriptionStatus.PAUSED).length,
  };

  const customersByPlan = plans.map((p) => ({
    planId: p.id,
    planName: p.name,
    active: subscriptions.filter((s) => s.planId === p.id && s.status === SubscriptionStatus.ACTIVE).length,
    trialing: subscriptions.filter((s) => s.planId === p.id && s.status === SubscriptionStatus.TRIALING).length,
  }));

  const metrics = {
    mrr,
    arr,
    revenueThisMonth,
    totalRevenue,
    totalCustomers: subscriptions.length,
    statusCounts,
    customersByPlan,
  };

  return (
    <BillingCatalogTabs
      plans={plans}
      services={services}
      addOns={addOns}
      coupons={coupons}
      tax={tax ?? { name: "GST", rate: 18, inclusive: false }}
      metrics={metrics}
      initialSubscriptions={subscriptions}
    />
  );
}

export default function PlatformBillingAdminPage() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader title="Billing" description="Platform billing catalog, subscriptions, and revenue." />

      <div className="flex flex-col gap-6 p-6">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <BillingCatalogData />
        </Suspense>
      </div>
    </div>
  );
}
