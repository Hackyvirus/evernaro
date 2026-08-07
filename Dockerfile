# Production Dockerfile for the Evernaro Next.js web app

FROM node:22-slim AS base

WORKDIR /app


# ============================================================
# PRODUCTION DEPENDENCIES
# ============================================================

FROM base AS deps

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        openssl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./

RUN npm ci --omit=dev


# ============================================================
# BUILD
# ============================================================

FROM base AS builder

# IMPORTANT:
# The builder needs devDependencies such as:
# @tailwindcss/postcss
# tailwindcss
# typescript
# prisma
# eslint
# tsx

ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
ENV DOCKER_BUILD=true
ENV PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x

COPY package.json package-lock.json ./

# Install ALL dependencies, including devDependencies
RUN npm ci

COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Production mode for Next.js build
ENV NODE_ENV=production

RUN npm run build


# ============================================================
# PRODUCTION RUNNER
# ============================================================

FROM base AS runner

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        openssl \
        ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --system --gid 999 nodejs \
    && useradd --system --uid 999 --gid nodejs nextjs

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Production dependencies
COPY --from=deps --chown=nextjs:nodejs /app/node_modules ./node_modules

# Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# Next.js static files
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Public files
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Docker entrypoint
COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-entrypoint.sh ./scripts/docker-entrypoint.sh

RUN chmod +x ./scripts/docker-entrypoint.sh

USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD node -e "fetch('http://localhost:3000/api/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Start application
CMD ["./scripts/docker-entrypoint.sh"]