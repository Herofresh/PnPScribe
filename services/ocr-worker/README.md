# PnPScribe OCR Worker

Processes OCR jobs for documents queued from `apps/web`.

Current flow:

1. `apps/web` marks a document `ocrStatus=queued`
2. `apps/web` enqueues a BullMQ job in Redis (`ocr-document-jobs`)
3. `services/ocr-worker` consumes the job
4. Worker renders PDF pages and transcribes them (OpenAI vision-based OCR/transcription)
5. Worker updates `Document.extractedText*` fields
6. Worker re-chunks and re-embeds the document so RAG can use the OCR text

## Required env vars

- `DATABASE_URL`
- `REDIS_URL` (defaults to `redis://127.0.0.1:6379`)
- `OPENAI_API_KEY`
- Optional:
  - `AI_EMBED_MODEL`
  - `OCR_TRANSCRIBE_MODEL`
  - `OCR_QUEUE_NAME`
  - `PNPSCRIBE_ROOT` (repo root path; auto-detected by default)

## Install and run

```bash
cd services/ocr-worker
npm install
npm run dev
```

## Triggering OCR

- Use the new "Request OCR" button in the chunk debug panel on `/`
- Or call:

```bash
curl -X POST http://localhost:3000/api/documents/<documentId>/ocr/request
```

## Notes

- This worker is implemented as a service (not in `apps/web`) to avoid Next/Turbopack PDF worker bundling issues.
- OCR here currently means "page screenshot + model transcription". A Tesseract-based local OCR backend can be added later behind the same queue.
