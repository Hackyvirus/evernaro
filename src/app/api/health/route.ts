import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redisConnection } from "@/lib/redis";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {
    database: "ok",
    redis: "ok",
  };
  const errors: string[] = [];

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    checks.database = "error";
    errors.push(err instanceof Error ? err.message : "Database check failed");
  }

  try {
    await redisConnection.ping();
  } catch (err) {
    checks.redis = "error";
    errors.push(err instanceof Error ? err.message : "Redis check failed");
  }

  const healthy = errors.length === 0;
  return NextResponse.json(
    { status: healthy ? "ok" : "error", checks, errors },
    { status: healthy ? 200 : 503 }
  );
}
