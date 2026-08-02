import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui";
import { PlatformLoginForm } from "./login-form";

export default async function PlatformLoginPage() {
  const existing = await prisma.platformAdmin.findFirst();
  if (!existing) redirect("/platform/setup");

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold text-text">Platform admin</h1>
        <p className="mt-1 text-sm text-text-secondary">Eversity Tech LLP — internal use only.</p>
        <PlatformLoginForm />
      </Card>
    </div>
  );
}
