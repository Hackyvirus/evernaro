import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Standalone output is for Docker builds only. Vercel needs the default output.
  output: process.env.DOCKER_BUILD === "true" ? "standalone" : undefined,
  poweredByHeader: false,
};

// Source-map upload only runs when these are set — safe to leave Sentry
// fully unconfigured (no DSN, no org/project) without breaking the build.
//
// Sentry client instrumentation can conflict with Next.js 16 static prerender
// in Docker/standalone builds, so we skip the Sentry wrapper there. Errors are
// still captured at runtime by src/instrumentation.ts on Vercel and by the
// worker's Sentry.init in the background worker.
const enableSentry =
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT &&
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.DOCKER_BUILD !== "true";

export default enableSentry
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      widenClientFileUpload: true,
      disableLogger: true,
    })
  : nextConfig;
