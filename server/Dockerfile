# The portfolio API. Build from this folder:  docker build -t portfolio-api ./server
FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

# Prisma's engine needs OpenSSL; the health check and HTTPS calls need CA certificates.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Dependencies first, so rebuilds that only change code are fast. The dev tools stay in
# the image on purpose: the API runs through tsx, and migrations need the Prisma CLI.
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# The database client is generated from the schema. No database is needed for this step.
COPY prisma ./prisma
COPY prisma.config.ts tsconfig.json ./
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npx prisma generate

COPY src ./src
# Starting content: songs, movies and playlists with their audio and images (see DEPLOY.md).
COPY seed ./seed
COPY docker-entrypoint.sh ./
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["./docker-entrypoint.sh"]
