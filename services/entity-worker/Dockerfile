FROM node:22-bookworm-slim AS builder

WORKDIR /app

COPY services/entity-worker/package*.json ./services/entity-worker/

RUN cd services/entity-worker && npm install

COPY services/entity-worker ./services/entity-worker

RUN cd services/entity-worker && npm run build

FROM node:22-bookworm-slim AS runner

WORKDIR /app/services/entity-worker
ENV NODE_ENV=production

COPY --from=builder /app/services/entity-worker /app/services/entity-worker

CMD ["npm", "run", "start"]

