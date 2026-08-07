import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui";
import { BillingCatalogTabs } from "./catalog-tabs";
import { requirePlatformAdminId } from "@/lib/session";
import { prisma } from "@/lib/prisma";

async function BillingCatalogData() {
  await requirePlatformAdminId();

  const [plans, services, addOns, coupons, tax] = await Promise.all([
    prisma.subscriptionPlan.findMany({
      orderBy: { displayOrder: "asc" },
      include: { _count: { select: { subscriptions: true } } },
    }),
    prisma.billableService.findMany({ orderBy: { name: "asc" } }),
    prisma.addOn.findMany({ orderBy: { name: "asc" } }),
    prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.taxConfiguration.findFirst({ where: { enabled: true } }),
  ]);

  return (
    <BillingCatalogTabs
      plans={plans}
      services={services}
      addOns={addOns}
      coupons={coupons}
      tax={tax ?? { name: "GST", rate: 18, inclusive: false }}
    />
  );
}

export default function PlatformBillingAdminPage() {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader title="Billing catalog" description="Manage plans, services, add-ons, coupons, and taxes." />

      <div className="flex flex-col gap-6 p-6">
        <Suspense fallback={<Skeleton className="h-96" />}>
          <BillingCatalogData />
        </Suspense>
      </div>
    </div>
  );
}
