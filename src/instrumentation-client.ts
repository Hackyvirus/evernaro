import * as Sentry from "@sentry/nextjs";

// No-op until SENTRY_DSN is set — safe to ship without a Sentry account yet.
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV,
  });
}
