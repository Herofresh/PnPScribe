FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
ENV REDIS_URL=redis://localhost:6379
ENV AUTH_SECRET=build-secret-placeholder
ENV AUTH_URL=http://localhost:3000
ENV AUTH_TRUST_HOST=true
ENV OPENAI_API_KEY=build-openai-placeholder

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY packages/ingestion/package*.json ./packages/ingestion/
COPY apps/web/package*.json ./apps/web/

RUN cd apps/web && npm install

COPY packages/ingestion ./packages/ingestion
COPY apps/web ./apps/web

RUN cd apps/web && npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app/apps/web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/packages /app/packages
COPY --from=builder /app/apps/web /app/apps/web

EXPOSE 3000

CMD ["npm", "run", "start"]
