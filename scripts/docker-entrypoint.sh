#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy
fi

# Bail early if required secrets/env vars are missing or invalid.
npm run verify-env

exec node server.js
