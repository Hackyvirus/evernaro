import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, AuthHeader } from "@/components/ui";
import { PlatformLoginForm } from "./login-form";

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
      <div className="pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-primary-lighter blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-accent-light blur-3xl" aria-hidden="true" />
      <Card className="relative w-full max-w-sm p-8">
        <AuthHeader title="Admin Login" />
        <p className="mb-6 text-center text-sm text-text-secondary">Eversity Tech LLP — internal use only.</p>
        {dbError ? (
          <p className="rounded-md bg-danger-light p-3 text-sm text-danger">{dbError}</p>
        ) : (
          <PlatformLoginForm />
        )}
      </Card>
    </div>
  );
}
