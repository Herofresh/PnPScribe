FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY packages/ingestion/package*.json ./packages/ingestion/
COPY services/ocr-worker/package*.json ./services/ocr-worker/

RUN cd services/ocr-worker && npm install

COPY packages/ingestion ./packages/ingestion
COPY services/ocr-worker ./services/ocr-worker

RUN cd services/ocr-worker && npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app/services/ocr-worker
ENV NODE_ENV=production

COPY --from=builder /app/packages /app/packages
COPY --from=builder /app/services/ocr-worker /app/services/ocr-worker

CMD ["npm", "run", "start"]

