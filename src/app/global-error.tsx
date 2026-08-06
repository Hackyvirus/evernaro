"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center font-sans">
        <h1 className="text-lg font-semibold text-text">Something went wrong.</h1>
        <p className="text-sm text-text-secondary">
          The error has been reported. Try reloading the page.
        </p>
        <button
          type="button"
          onClick={reset}
          className="rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-text hover:bg-hover"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
