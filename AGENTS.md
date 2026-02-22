# PnPScribe — Codex instructions

## Architecture

- Monorepo: apps/web (Next.js), services/_ (workers), packages/_ (shared)
- DB: Postgres + pgvector via docker compose
- Prisma is used in apps/web

## Commands

- Start infra: `docker compose up -d`
- Dev server: `cd apps/web && npm run dev`
- Prisma: `cd apps/web && npx prisma migrate dev`

## Rules

- Use TypeScript.
- Keep changes small and incremental.
- Prefer adding tests or a quick smoke route when possible.
- Follow existing ESLint/TS rules. Fix lint errors you introduce.
- For new files: place them where the architecture expects them.
