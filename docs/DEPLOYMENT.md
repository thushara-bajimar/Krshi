# Deploying KRSHI

KRSHI is a standard Next.js 15 Node application with PostgreSQL.

## Requirements

- Node.js 20+.
- PostgreSQL 14+ (managed: Neon, Supabase, RDS, Cloud SQL, Render…). Use a **UTF-8** database (required for Kannada text).
- Persistent disk for uploads, or an object-storage adapter (see below).
- HTTPS. Session cookies are `Secure` in production, and the service worker and microphone require a secure context.

## Steps

```bash
git clone … && cd krshi
npm ci
cp .env.example .env    # set DATABASE_URL, APP_URL, optionally DATA_GOV_IN_API_KEY / ANTHROPIC_API_KEY, UPLOAD_DIR
npx prisma migrate deploy
SEED_DEMO=false npm run db:seed     # reference data only (crops, schemes, resources, sample prices)
npm run build
npm start                           # PORT env var sets the port (default 3000)
```

Run behind a reverse proxy (nginx, Caddy) or on a platform that terminates TLS. The rate limiter reads the client IP from `x-forwarded-for`, so make sure your proxy sets it.

## Platform notes

| Platform | Notes |
|---|---|
| VM / Docker | Simplest. Mount `UPLOAD_DIR` on a persistent volume. |
| Render / Railway / Fly.io | Use their Postgres and a persistent volume for uploads. Build command `npm ci && npx prisma migrate deploy && npm run build`, start command `npm start`. |
| Vercel / serverless | Works for pages and APIs, but the local-disk upload storage and in-memory rate limiter need replacing: implement `saveFile/readStored/deleteStored` in `src/server/storage.ts` with S3/R2/GCS, and back `src/lib/rate-limit.ts` with Redis/Upstash. |

## Example Dockerfile

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
```

## Operations

- Back up PostgreSQL daily, and back up the uploads volume.
- To change the service-worker cache strategy, bump `VERSION` in `public/sw.js` so old caches are cleared.
- Open-Meteo's free tier is for non-commercial use. Get a commercial plan, or switch provider, for commercial deployments.
- Market prices refresh lazily (when the market page is opened, at most every 6 hours). For steady history, call `POST /api/market/refresh` from a scheduler with an authenticated service user, or add a cron job that calls `maybeRefreshMarketPrices(true)`.
