// Which subscription plans the public marketing pages (landing page + /pricing)
// show. The billing engine still knows every plan in the database — this only
// controls the shop window, so existing customers on a hidden plan keep their
// plan and still see it in Settings → Billing.
//
// Launch focus: one free entry point + one paid plan. Widen this list when the
// pricing story needs more tiers.
export const PUBLIC_PLAN_SLUGS = ["free", "growth"] as const;

export function isPublicPlanSlug(slug: string): boolean {
  return (PUBLIC_PLAN_SLUGS as readonly string[]).includes(slug);
}
