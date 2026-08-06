# Production Dockerfile for the Evernaro Next.js web app.
#
# Build:  docker build -t evernaro-app .
# Run:    docker run --env-file .env -p 3000:3000 evernaro-app
#
# For a full local stack, use docker-compose.yml (app + worker + Postgres + Redis).

FROM node:22-slim AS base
WORKDIR /app

FROM base AS deps
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM deps AS builder
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=true
# Pin Prisma to the engine matching node:22-slim (Debian Bookworm / OpenSSL 3)
# so `prisma generate` doesn't spend time resolving/downloading other binaries.
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x
# We need the full source and devDependencies to build.
COPY . .
RUN npm ci
RUN npx prisma generate
RUN npm run build

FROM base AS runner
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN groupadd --system --gid 999 nodejs && \
    useradd --system --uid 999 --gid nodejs nextjs
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Copy the standalone Next.js build output plus the full production node_modules
# so the Prisma CLI is available for migrations in the entrypoint.
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Entrypoint runs migrations (only when RUN_MIGRATIONS=true) and then starts.
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh
RUN chmod +x ./scripts/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["./scripts/docker-entrypoint.sh"]
