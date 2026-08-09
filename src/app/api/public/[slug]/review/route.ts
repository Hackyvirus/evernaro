import { NextResponse } from "next/server";
import { z } from "zod";
import { CustomerEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limit";
import { recordCustomerEvent } from "@/lib/customer-events";
import { verifyReviewToken } from "@/lib/services/review-requests";

const bodySchema = z.object({
  token: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { token, rating, comment } = parsed.data;
  const payload = verifyReviewToken(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid or expired review link" }, { status: 400 });
  }

  const org = await prisma.organization.findUnique({
    where: { slug },
    select: { id: true, status: true },
  });
  if (!org || org.status !== "ACTIVE") {
    return NextResponse.json({ error: "Business not found" }, { status: 404 });
  }

  const tokenAllowed = await checkRateLimit(`public:review:token:${token}`, 5, 60 * 60);
  if (!tokenAllowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const slugAllowed = await checkRateLimit(`public:review:slug:${slug}`, 20, 60 * 60);
  if (!slugAllowed) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  const appointment = await prisma.appointment.findFirst({
    where: { id: payload.appointmentId, contactId: payload.contactId, orgId: org.id, status: "COMPLETED" },
  });
  if (!appointment) {
    return NextResponse.json({ error: "Appointment not found or not completed" }, { status: 404 });
  }

  const existingReview = await prisma.review.findFirst({
    where: {
      orgId: org.id,
      contactId: payload.contactId,
      metadata: { path: ["appointmentId"], equals: appointment.id },
    },
  });
  if (existingReview) {
    return NextResponse.json(
      { error: "Review already submitted" },
      { status: 409 }
    );
  }

  const review = await prisma.review.create({
    data: {
      orgId: org.id,
      contactId: payload.contactId,
      rating,
      comment: comment ?? null,
      metadata: { appointmentId: appointment.id },
    },
  });

  void recordCustomerEvent(
    org.id,
    payload.contactId,
    CustomerEventType.REVIEW_RECEIVED,
    "review",
    review.id,
    {
      rating,
      comment: comment ?? null,
      appointmentId: appointment.id,
    }
  );

  return NextResponse.json(
    {
      review: {
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
      },
    },
    { status: 201 }
  );
}
