"use client";

import { useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { Star } from "lucide-react";

export default function PublicReviewPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const token = searchParams.get("t") ?? "";

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating === 0) {
      setError("Please select a rating");
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch(`/api/public/${slug}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, rating, comment }),
    });

    setSubmitting(false);
    if (res.ok) {
      setSuccess(true);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to submit review");
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="text-lg font-semibold text-text">Invalid review link</h1>
          <p className="text-text-secondary">The link is missing or malformed.</p>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface px-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="mb-2 text-xl font-semibold text-text">Thank you!</h1>
          <p className="text-text-secondary">Your review has been submitted.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="mb-2 text-xl font-semibold text-text">How was your experience?</h1>
        <p className="mb-6 text-sm text-text-secondary">Tap a star to rate your visit.</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="flex justify-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onMouseEnter={() => setHover(star)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setRating(star)}
                className="p-1"
              >
                <Star
                  className={`h-8 w-8 ${star <= (hover || rating) ? "fill-warning text-warning" : "text-border"}`}
                />
              </button>
            ))}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-text">Comment (optional)</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-text outline-none focus:border-primary"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? "Submitting..." : "Submit Review"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
