import { randomUUID } from "node:crypto";

import { Pool } from "pg";

import { config } from "./config.js";

export const pool = new Pool({
  connectionString: config.databaseUrl,
});

export interface DocumentRecord {
  id: string;
  systemId: string;
  filePath: string;
  extractedText: string | null;
  ocrStatus: string;
  ocrMode: string | null;
  ocrReason: string | null;
}

export async function getDocument(documentId: string) {
  const res = await pool.query<DocumentRecord>(
    `
    SELECT "id", "systemId", "filePath", "extractedText", "ocrStatus", "ocrMode", "ocrReason"
    FROM "Document"
    WHERE "id" = $1
    `,
    [documentId],
  );

  return res.rows[0] ?? null;
}

export async function setDocumentOcrProcessing(documentId: string) {
  await pool.query(
    `
    UPDATE "Document"
    SET "ocrStatus" = 'processing',
        "ocrError" = NULL,
        "ocrProgressMessage" = 'Starting OCR processing',
        "ocrProgressUpdatedAt" = NOW()
    WHERE "id" = $1
    `,
    [documentId],
  );
}

export async function setDocumentOcrFailed(documentId: string, message: string) {
  await pool.query(
    `
    UPDATE "Document"
    SET "ocrStatus" = 'failed',
        "ocrError" = $2,
        "ocrProgressMessage" = 'OCR failed',
        "ocrProgressUpdatedAt" = NOW(),
        "ocrCompletedAt" = NOW()
    WHERE "id" = $1
    `,
    [documentId, message.slice(0, 1000)],
  );
}

export async function updateDocumentOcrProgress(params: {
  documentId: string;
  currentPage: number;
  totalPages: number;
  message: string;
}) {
  await pool.query(
    `
    UPDATE "Document"
    SET "ocrProgressCurrentPage" = $2,
        "ocrProgressTotalPages" = $3,
        "ocrProgressMessage" = $4,
        "ocrProgressUpdatedAt" = NOW()
    WHERE "id" = $1
    `,
    [params.documentId, params.currentPage, params.totalPages, params.message.slice(0, 500)],
  );
}

export async function saveOcrTextAndDiagnostics(params: {
  documentId: string;
  text: string;
  pageCount: number | null;
  durationMs: number;
}) {
  const textLength = params.text.length;

  await pool.query(
    `
    UPDATE "Document"
    SET "extractedText" = $2,
        "extractedTextLength" = $3,
        "extractedPageCount" = $4,
        "extractionDurationMs" = $5,
        "extractionStatus" = 'succeeded',
        "extractionError" = NULL,
        "extractedAt" = NOW(),
        "ocrStatus" = 'completed',
        "ocrError" = NULL,
        "ocrProgressCurrentPage" = COALESCE($4, "ocrProgressCurrentPage"),
        "ocrProgressTotalPages" = COALESCE($4, "ocrProgressTotalPages"),
        "ocrProgressMessage" = 'OCR completed',
        "ocrProgressUpdatedAt" = NOW(),
        "ocrCompletedAt" = NOW()
    WHERE "id" = $1
    `,
    [params.documentId, params.text, textLength, params.pageCount, params.durationMs],
  );
}

export async function replaceDocumentChunks(
  documentId: string,
  chunks: Array<{ content: string; chunkIndex: number; pageNumber: number | null; chapterHint: string | null }>,
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM "Chunk" WHERE "documentId" = $1`, [documentId]);

    for (const chunk of chunks) {
      await client.query(
        `
        INSERT INTO "Chunk" ("id", "content", "chunkIndex", "pageNumber", "chapterHint", "documentId", "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `,
        [randomUUID(), chunk.content, chunk.chunkIndex, chunk.pageNumber, chunk.chapterHint, documentId],
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function listChunksMissingEmbeddings(documentId: string) {
  const res = await pool.query<{ id: string; content: string }>(
    `
    SELECT "id", "content"
    FROM "Chunk"
    WHERE "documentId" = $1 AND "embedding" IS NULL
    ORDER BY "chunkIndex" ASC, "createdAt" ASC
    `,
    [documentId],
  );

  return res.rows;
}

export async function updateChunkEmbedding(chunkId: string, vectorLiteral: string) {
  await pool.query(
    `
    UPDATE "Chunk"
    SET "embedding" = $2::vector
    WHERE "id" = $1
    `,
    [chunkId, vectorLiteral],
  );
}
