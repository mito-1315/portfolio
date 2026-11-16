#!/bin/sh
# Runs every time the container starts: set up the database, add the starting
# content once, put the starting files in place, then start the API.
set -e

echo "Applying database migrations..."
npx prisma migrate deploy

echo "Adding starting content (only to empty tables)..."
npx tsx prisma/seed.ts

# Copies the starting audio and images into the uploads volume. Files that are
# already there (including anything uploaded from the admin) are never replaced.
if [ -d seed/uploads ]; then
  mkdir -p uploads
  cp -rn seed/uploads/. uploads/ 2>/dev/null || true
fi

echo "Starting the API..."
exec npx tsx src/index.ts
