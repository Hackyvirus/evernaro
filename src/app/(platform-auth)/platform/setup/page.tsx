import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { SetupForm } from "./setup-form";

export default async function PlatformSetupPage() {
  const existing = await prisma.platformAdmin.findFirst();
  if (existing) redirect("/platform/login");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-text">Set up the platform admin account</h1>
        <p className="mt-1 text-sm text-text-secondary">
          One-time setup — this only works because no platform admin exists yet.
        </p>
        <SetupForm />
      </Card>
    </div>
  );
}
