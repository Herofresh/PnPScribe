import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { config } from "./config.js";
export const pool = new Pool({
    connectionString: config.databaseUrl,
});
export async function getDocument(documentId) {
    const res = await pool.query(`
    SELECT "id", "systemId", "filePath", "extractedText", "ocrStatus", "ocrMode", "ocrReason"
    FROM "Document"
    WHERE "id" = $1
    `, [documentId]);
    return res.rows[0] ?? null;
}
export async function setDocumentOcrProcessing(documentId) {
    await pool.query(`
    UPDATE "Document"
    SET "ocrStatus" = 'processing',
        "ocrError" = NULL,
        "ocrProgressMessage" = 'Starting OCR processing',
        "ocrProgressUpdatedAt" = NOW()
    WHERE "id" = $1
    `, [documentId]);
}
export async function setDocumentOcrFailed(documentId, message) {
    await pool.query(`
    UPDATE "Document"
    SET "ocrStatus" = 'failed',
        "ocrError" = $2,
        "ocrProgressMessage" = 'OCR failed',
        "ocrProgressUpdatedAt" = NOW(),
        "ocrCompletedAt" = NOW()
    WHERE "id" = $1
    `, [documentId, message.slice(0, 1000)]);
}
export async function updateDocumentOcrProgress(params) {
    await pool.query(`
    UPDATE "Document"
    SET "ocrProgressCurrentPage" = $2,
        "ocrProgressTotalPages" = $3,
        "ocrProgressMessage" = $4,
        "ocrProgressUpdatedAt" = NOW()
    WHERE "id" = $1
    `, [params.documentId, params.currentPage, params.totalPages, params.message.slice(0, 500)]);
}
export async function saveOcrTextAndDiagnostics(params) {
    const textLength = params.text.length;
    await pool.query(`
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
    `, [params.documentId, params.text, textLength, params.pageCount, params.durationMs]);
}
export async function replaceDocumentChunks(documentId, chunks) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        await client.query(`DELETE FROM "Chunk" WHERE "documentId" = $1`, [documentId]);
        for (const chunk of chunks) {
            await client.query(`
        INSERT INTO "Chunk" ("id", "content", "chunkIndex", "pageNumber", "chapterHint", "documentId", "createdAt")
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [randomUUID(), chunk.content, chunk.chunkIndex, chunk.pageNumber, chunk.chapterHint, documentId]);
        }
        await client.query("COMMIT");
    }
    catch (error) {
        await client.query("ROLLBACK");
        throw error;
    }
    finally {
        client.release();
    }
}
export async function listChunksMissingEmbeddings(documentId) {
    const res = await pool.query(`
    SELECT "id", "content"
    FROM "Chunk"
    WHERE "documentId" = $1 AND "embedding" IS NULL
    ORDER BY "chunkIndex" ASC, "createdAt" ASC
    `, [documentId]);
    return res.rows;
}
export async function updateChunkEmbedding(chunkId, vectorLiteral) {
    await pool.query(`
    UPDATE "Chunk"
    SET "embedding" = $2::vector
    WHERE "id" = $1
    `, [chunkId, vectorLiteral]);
}
