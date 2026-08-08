"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Clock, Users } from "lucide-react";

function token(num: number) {
  return `A${String(num).padStart(3, "0")}`;
}

export function FlowMockup() {
  const [servingNum, setServingNum] = useState(116);
  const [customerNum, setCustomerNum] = useState(119);
  const [ahead, setAhead] = useState(2);
  const [notified, setNotified] = useState(false);

  const nowServing = token(servingNum);
  const customerToken = token(customerNum);
  const nextTokens = [servingNum + 1, servingNum + 2, servingNum + 3].map(token);

  // Subtle live animation: the queue advances until this customer's turn, then resets.
  useEffect(() => {
    const timer = setInterval(() => {
      setAhead((prev) => {
        if (prev <= 0) {
          setNotified(true);
          setTimeout(() => setNotified(false), 2500);
          setTimeout(() => {
            setServingNum(116);
            setCustomerNum(119);
            setAhead(2);
          }, 3000);
          return 0;
        }
        setServingNum((n) => n + 1);
        return prev - 1;
      });
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-3xl">
      <div className="grid gap-4 md:grid-cols-2 md:items-start">
        {/* Business dashboard card */}
        <div className="animate-hero rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-elevated)] md:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-text">Evernaro</p>
              <p className="text-xs text-text-muted">Today&apos;s Queue</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-full bg-success-light px-2 py-0.5 text-[10px] font-medium text-success">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-live-pulse absolute inline-flex h-full w-full rounded-full bg-success" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
              </span>
              Live
            </span>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-primary-lighter p-3 text-center">
              <p className="text-xs text-text-secondary">Now serving</p>
              <p className="text-2xl font-extrabold text-primary">{nowServing}</p>
            </div>
            <div className="rounded-lg bg-surface p-3 text-center">
              <p className="text-xs text-text-secondary">Waiting</p>
              <p className="text-2xl font-extrabold text-text">8</p>
            </div>
          </div>

          <div className="mb-4 rounded-lg border border-border bg-surface p-3">
            <p className="mb-2 text-xs font-medium text-text-secondary">Next:</p>
            <div className="flex flex-wrap gap-2">
              {nextTokens.map((t) => (
                <span
                  key={t}
                  className={`rounded-md px-2 py-1 text-xs font-medium ${
                    t === token(servingNum + 1) ? "bg-primary text-white" : "bg-card text-text-secondary"
                  }`}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-text-muted">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            Average wait ~12 min
          </div>
        </div>

        {/* Customer mobile card */}
        <div className="animate-hero relative rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-elevated)] md:mt-10">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-medium text-text-muted">Your Token</span>
            <span className="flex h-2 w-2 rounded-full bg-success" />
          </div>
          <p className="text-4xl font-extrabold tracking-tight text-primary">{customerToken}</p>

          <div className="my-5 grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-surface p-3 text-center">
              <p className="text-xs text-text-secondary">Ahead of you</p>
              <p className="text-2xl font-bold text-text">{ahead}</p>
            </div>
            <div className="rounded-lg bg-surface p-3 text-center">
              <p className="text-xs text-text-secondary">Est. wait</p>
              <p className="text-2xl font-bold text-text">{ahead * 6}m</p>
            </div>
          </div>

          <div className="rounded-lg bg-primary-lighter p-3">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary">
              <Bell className="h-3.5 w-3.5" aria-hidden="true" />
              {notified ? "It's your turn soon" : "Live updates enabled"}
            </div>
            <p className="text-xs text-text-secondary">
              {notified
                ? "Please proceed to the counter."
                : "We'll notify you when your turn is near."}
            </p>
          </div>

          {notified && (
            <div className="animate-message-in absolute -right-2 -bottom-3 flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-[var(--shadow-elevated)]">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success-light">
                <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
              </span>
              <p className="text-xs font-medium text-text">Token {customerToken} called</p>
            </div>
          )}
        </div>
      </div>

      {/* Floating badge */}
      <div className="animate-float absolute -top-4 -right-2 hidden items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-[var(--shadow-elevated)] sm:flex">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-lighter">
          <Users className="h-4 w-4 text-primary" aria-hidden="true" />
        </span>
        <div>
          <p className="text-xs font-medium text-text">3 staff active</p>
          <p className="text-[10px] text-text-muted">2 counters serving</p>
        </div>
      </div>
    </div>
  );
}
