# Pen & Paper AI Assistant

## Goal

A self-hosted, multi-system AI assistant for tabletop RPGs.

The assistant:

- Uses uploaded rulebook PDFs as knowledge base
- Uses RAG (Retrieval Augmented Generation)
- Strictly answers based on rulebook context
- Supports multiple systems (PF2e, D&D, etc.)
- Allows model switching for cost optimization
- Runs locally via Docker but is deployable to VPS

---

## Tech Stack

### Frontend

- Next.js (App Router)
- TypeScript
- Tailwind
- Vercel AI SDK

### Backend

- Node.js (inside Next.js API routes initially)
- Prisma ORM
- PostgreSQL + pgvector
- Redis (for workers)

### AI

- OpenAI API
- Embeddings: text-embedding-3-small
- Default Chat Model: gpt-4o-mini
- Advanced Model: gpt-4.1

---

## Architecture Overview

Monorepo structure:

pnp-assistant/
│
├── apps/
│ └── web/ # Next.js app
│
├── services/
│ ├── ocr-worker/ # PDF extraction & OCR fallback
│ ├── embedding-worker/ # Chunking + embeddings
│
├── packages/
│ ├── db/ # Prisma client
│ ├── ai-utils/ # RAG logic
│ ├── types/ # Shared types
│
├── docker-compose.yml
├── ARCHITECTURE.md

---

## Core Concepts

### System

Represents one RPG system.
Example: PF2e

Each system has:

- Multiple documents (PDFs)
- Vector embeddings scoped to that system

---

### Document Flow

1. User uploads PDF
2. PDF stored in /uploads/{system}
3. OCR Worker extracts text
4. Text split into structured chunks
5. Embeddings generated
6. Stored in PostgreSQL with pgvector

---

### RAG Flow

User Question
↓
Embed question
↓
Query pgvector (top 3–5 chunks, scoped by systemId)
↓
Construct strict prompt:
"Answer only using the provided context."
↓
LLM generates answer
↓
Return answer with citation

---

## Cost Optimization Strategy

- Small embedding model
- Model switcher per request
- Max tokens capped
- Temperature = 0 for rule lookups
- Retrieval limit (top 3–5 chunks)

---

## Security (Future)

- Role based access (SuperUser, Player)
- GM-only notes
- System-scoped queries

---

## Future Extensions

- Encounter difficulty calculator
- Initiative tracker
- Condition tracking
- 3D grid integration (three.js)
- Statblock parser
- Structured rule extraction
