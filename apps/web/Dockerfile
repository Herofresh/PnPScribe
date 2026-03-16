FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY packages/ingestion/package*.json ./packages/ingestion/
COPY apps/web/package*.json ./apps/web/

RUN cd apps/web && npm install

COPY packages/ingestion ./packages/ingestion
COPY apps/web ./apps/web

RUN cd apps/web && npx prisma generate && npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app/apps/web
ENV NODE_ENV=production

COPY --from=builder /app/packages /app/packages
COPY --from=builder /app/apps/web /app/apps/web

EXPOSE 3000

CMD ["npm", "run", "start"]

