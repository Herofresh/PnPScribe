# PnPScribe – Project Vision

## Overview

PnPScribe is a self-hosted AI-powered Game Master assistant for tabletop RPGs.

Its primary goal is to provide strict, rulebook-based AI assistance using uploaded PDF rulebooks as the sole source of truth. It is designed to help Game Masters (GMs) manage rules, encounters, world-building, and system knowledge without hallucinated information.

Additionally, PnPScribe will later act as a session log / protocol system and use those logs as a foundation for story suggestions and recap support. Importantly, **Rules** and **Story** are treated as two separate feature domains with different grounding requirements.

The tool is local-first, runs via Docker, and provides a web interface accessible from any device.

---

# Core Idea

PnPScribe is not a generic chatbot.

It is a:

- Multi-system RPG assistant
- Rulebook-grounded AI (RAG-based)
- GM-focused control tool
- Future-expandable encounter and combat assistant
- Session log / protocol archive (future)
- Story suggestion engine grounded in campaign logs (future)

Each RPG system (e.g., Pathfinder 2e, D&D, etc.) has its own:

- Uploaded rulebooks (PDF)
- Extracted text
- Embedding vectors
- Scoped retrieval context

The AI must answer **rule questions** strictly using the rulebook context.

If information is not found in the indexed material, it must say:

> "This information was not found in the uploaded rulebook."

No guessing.
No lore invention.
No cross-system leakage.

---

# Target Users

Primary user:

- The Game Master (SuperUser)

Future users:

- Players with restricted access
- Read-only shared links
- Players contributing to logs / notes (future)

---

# Architecture Philosophy

- Monorepo structure
- Next.js frontend (App Router)
- PostgreSQL + pgvector
- Docker-based infrastructure
- OpenAI API (model-switching capable)
- Strict RAG pipeline
- TypeScript everywhere

The system must be deployable locally and later to a VPS.

---

# Two Feature Domains: Rules vs Story

PnPScribe has two long-term AI domains with different rules:

## 1) Rules Domain (Strict)

- Grounded only in uploaded rulebooks (PDF knowledge base)
- No invention / no speculation
- Citations required
- System isolation mandatory (PF2e != D&D)

## 2) Story Domain (Creative but Grounded)

- Grounded primarily in campaign/session logs and GM notes
- Allowed to propose ideas, but must:
    - reference log context when applicable
    - distinguish facts (“from the log”) vs suggestions (“proposal”)
- Optional second grounding source:
    - GM-provided setting documents (future)

This separation ensures:

- Rules remain authoritative and reliable
- Story tools remain creative without polluting rules answers

---

# MVP Definition

The MVP should provide:

## 1. System Creation

- Create a new RPG system entry
- Assign name (e.g., "PF2e")

## 2. Rulebook Upload

- Upload one or multiple PDFs
- Store files locally in /uploads/{system}
- Extract text (digital PDFs via pdf-parse)
- OCR fallback later (not MVP)

## 3. Text Processing

- Chunk rulebook text
- Store chunks in PostgreSQL
- Generate embeddings using:
    - text-embedding-3-small

## 4. RAG Chat Interface (Rules Mode)

- Select system from sidebar
- Ask rule-based questions
- Retrieve top 3–5 chunks
- Build strict prompt:
    - Temperature = 0
    - Token limit enforced
- Return answer
- Include source citation (chapter/page/chunk metadata where possible)

## 5. Model Switching

- Cheap model (default)
- Strong model (optional)
- Configurable per request

---

# Non-Goals for MVP

- No player authentication yet
- No player invites yet
- No session log/protocol UI yet
- No story suggestion engine yet
- No initiative tracker
- No combat simulation
- No structured rule parsing
- No encounter balancing engine
- No real-time multiplayer
- No 3D combat grid yet

---

# Phase 2 – Controlled Expansion

After MVP is stable:

## Session Logs / Protocol (GM-first)

- Add session log entries (date, title, text, tags)
- Allow attaching images or references (future)
- Search logs
- Optional embeddings for semantic search

## Player Access (Read + Contribute)

- Role-based access (SuperUser, Player)
- Shared read-only links
- Player-facing “lookup” mode:
    - rules Q&A
    - log search
- Player contributions:
    - allow players to submit notes/recaps
    - GM can approve/merge into official log

## Better PDF Handling

- Header-aware chunking
- Page number metadata
- OCR fallback with Tesseract worker
- Background job processing via Redis/BullMQ

---

# Phase 3 – GM Power Tools

## Story Suggestions (Grounded Creativity)

- Generate recap drafts from logs
- Suggest plot hooks based on:
    - unresolved threads
    - NPC mentions
    - player goals
- Clearly label:
    - “facts from logs” vs “new suggestions”
- Optional: integrate GM “world bible” documents

## Encounter Builder

- XP budget calculator (system-specific)
- Monster lookup via RAG
- Export encounter JSON

## Initiative Tracker

- Turn order manager
- Condition tracking
- State persistence

## 3D Grid Integration

- Three.js based battle grid
- AI-assisted area visualization
- Spell radius preview

---

# Long-Term Vision

PnPScribe evolves into:

A fully AI-augmented GM cockpit.

Not a replacement for creativity,
but a structured memory and rule engine that:

- Eliminates rule lookups during play
- Prevents misinterpretation
- Assists in encounter design
- Supports world-building
- Stores session history and enables strong recaps
- Produces grounded story suggestions from logs

---

# Core Principles

1. Rule-grounded answers only (Rules Mode).
2. Clear separation of Rules vs Story features.
3. No hallucinated content in Rules Mode.
4. System isolation.
5. Cost-aware AI usage.
6. Modular architecture.
7. Future-proof extensibility.

---

# Technical Constraints

- Must run locally via Docker.
- Must be deployable to a VPS.
- Must use PostgreSQL with pgvector.
- Must keep token usage optimized.
- Must allow model switching.

---

# Development Strategy

1. Build infrastructure first.
2. Implement strict Rules RAG pipeline.
3. Verify correctness before adding features.
4. Expand in layers (Logs → Players → Story).
5. Keep diffs small and modular.

---

PnPScribe is a GM tool first.
Everything else builds on that foundation.
