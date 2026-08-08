"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, Trash2, MessageSquare, Search, User } from "lucide-react";
import { Badge, Card, EmptyState, Input, PageHeader, Select, SkeletonCard } from "@/components/ui";
import { contactLabel } from "@/lib/contact-label";
import { useToast } from "@/components/ui/toast";
import { useRole, isAdmin } from "../role";

interface ContactSummary {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  telegramChatId: string | null;
  instagramUserId: string | null;
}

interface ReviewSummary {
  id: string;
  contactId: string;
  contact: ContactSummary;
  rating: number;
  comment: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? "fill-warning text-warning" : "text-text-muted"}`}
          aria-hidden="true"
        />
      ))}
    </span>
  );
}

export default function ReviewsPage() {
  const { showToast } = useToast();
  const role = useRole();
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState<string>("");

  function fetchReviews() {
    return fetch("/api/reviews")
      .then((res) => res.json().catch(() => ({})))
      .then((data) => data.reviews ?? []);
  }

  function refresh() {
    return fetchReviews().then(setReviews);
  }

  useEffect(() => {
    fetchReviews()
      .then(setReviews)
      .catch(() => showToast("error", "Failed to load reviews"))
      .finally(() => setLoaded(true));
  }, [showToast]);

  const stats = useMemo(() => {
    if (reviews.length === 0) return { average: 0, count: 0 };
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return { average: sum / reviews.length, count: reviews.length };
  }, [reviews]);

  const filtered = useMemo(() => {
    let list = reviews;
    if (ratingFilter) list = list.filter((r) => String(r.rating) === ratingFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          (r.comment ?? "").toLowerCase().includes(q) ||
          contactLabel(r.contact).toLowerCase().includes(q)
      );
    }
    return list;
  }, [reviews, ratingFilter, search]);

  async function remove(id: string) {
    if (!confirm("Delete this review? This cannot be undone.")) return;
    try {
      const res = await fetch("/api/reviews", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast("error", data.error ?? "Failed to delete review");
      } else {
        showToast("success", "Review deleted");
        refresh();
      }
    } catch {
      showToast("error", "Network error");
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <PageHeader title="Reviews" description="See what your customers are saying." />

      <div className="flex flex-col gap-6 p-6">
        {loaded && reviews.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="flex flex-col gap-1 p-4">
              <p className="text-xs text-text-muted">Average rating</p>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 fill-warning text-warning" aria-hidden="true" />
                <p className="text-2xl font-bold text-text">{stats.average.toFixed(1)}</p>
                <span className="text-sm text-text-muted">/ 5</span>
              </div>
            </Card>
            <Card className="flex flex-col gap-1 p-4">
              <p className="text-xs text-text-muted">Total reviews</p>
              <p className="text-2xl font-bold text-text">{stats.count}</p>
            </Card>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" aria-hidden="true" />
            <Input
              type="text"
              placeholder="Search reviews..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select value={ratingFilter} onChange={(e) => setRatingFilter(e.target.value)} className="w-40">
            <option value="">All ratings</option>
            {[5, 4, 3, 2, 1].map((r) => (
              <option key={r} value={String(r)}>{r} stars</option>
            ))}
          </Select>
        </div>

        {!loaded ? (
          <div className="flex flex-col gap-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No reviews found"
            description={
              search || ratingFilter
                ? "No reviews match your filters."
                : "Reviews submitted by customers will appear here."
            }
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {filtered.map((r) => (
              <li key={r.id}>
                <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <StarRating rating={r.rating} />
                      <Badge variant={r.rating >= 4 ? "success" : r.rating === 3 ? "warning" : "danger"}>
                        {r.rating}/5
                      </Badge>
                    </div>
                    <p className="text-sm text-text-secondary">
                      {r.comment ?? <span className="italic text-text-muted">No written feedback</span>}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" aria-hidden="true" /> {contactLabel(r.contact)}
                      </span>
                      <span>{new Date(r.createdAt).toLocaleString()}</span>
                    </div>
                  </div>
                  {isAdmin(role) && (
                    <button
                      onClick={() => remove(r.id)}
                      className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-danger hover:bg-danger-light"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Delete
                    </button>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
