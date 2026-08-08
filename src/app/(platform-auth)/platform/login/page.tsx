import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { PlatformLoginForm } from "./login-form";
import { Shield } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function PlatformLoginPage() {
  let existing: { id: string } | null = null;
  let dbError: string | null = null;

  try {
    existing = await prisma.platformAdmin.findFirst();
  } catch (err) {
    console.error("Platform login database check failed:", err);
    dbError = "Database is not ready. Run `npx prisma migrate deploy` before logging in.";
  }

  if (!existing && !dbError) redirect("/platform/setup");

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgb(180_83_9_/_0.08),transparent_40%),radial-gradient(circle_at_bottom_left,rgb(124_58_237_/_0.06),transparent_40%)]" aria-hidden="true" />
      <Card className="relative w-full max-w-sm border-l-4 border-l-accent p-8 shadow-elevated">
        <div className="mb-6 text-center">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-light">
              <Shield className="h-7 w-7 text-accent" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-center gap-2">
            <h1 className="text-2xl font-bold text-text">Platform Admin</h1>
            <span className="rounded-full bg-accent-light px-2 py-0.5 text-xs font-medium text-accent">Internal</span>
          </div>
          <p className="mt-1 text-sm text-text-secondary">Eversity Tech LLP — internal use only</p>
        </div>

        {dbError ? (
          <p className="rounded-md bg-danger-light p-3 text-sm text-danger">{dbError}</p>
        ) : (
          <PlatformLoginForm />
        )}
      </Card>
    </div>
  );
}
