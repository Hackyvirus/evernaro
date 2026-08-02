"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            fontFamily: "system-ui, sans-serif",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "16px", fontWeight: 600 }}>Something went wrong.</p>
          <p style={{ fontSize: "14px", color: "#666" }}>
            The error has been reported. Try reloading the page.
          </p>
          <button
            onClick={reset}
            style={{
              cursor: "pointer",
              borderRadius: "8px",
              border: "1px solid #ccc",
              padding: "8px 16px",
              fontSize: "14px",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
