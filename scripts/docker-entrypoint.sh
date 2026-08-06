#!/bin/sh
set -e

if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy
fi

exec node server.js
