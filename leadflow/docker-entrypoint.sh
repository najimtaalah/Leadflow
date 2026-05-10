#!/bin/sh
set -e

echo "Running Prisma migrations..."
node_modules/.bin/prisma migrate deploy

echo "Seeding database if empty..."
node_modules/.bin/tsx prisma/seed.ts 2>&1 | head -3 || true

echo "Starting Next.js..."
exec node_modules/.bin/next start
