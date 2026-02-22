import { fileURLToPath } from "node:url";

export const config = {
  redisUrl: process.env.REDIS_URL ?? "redis://127.0.0.1:6379",
  databaseUrl: process.env.DATABASE_URL ?? "",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  embedModel: process.env.AI_EMBED_MODEL ?? "text-embedding-3-small",
  ocrQueueName: process.env.OCR_QUEUE_NAME ?? "ocr-document-jobs",
  projectRoot:
    process.env.PNPSCRIBE_ROOT ??
    fileURLToPath(new URL("../../..", import.meta.url)),
  // Below threshold we flag for OCR; worker can still run on demand.
  minCharsPerPageForDigital: Number(process.env.OCR_MIN_CHARS_PER_PAGE ?? "120"),
  ocrDevPageCap: Number(process.env.OCR_DEV_PAGE_CAP ?? "25"),
} as const;

if (!config.databaseUrl) {
  throw new Error("Missing DATABASE_URL for OCR worker.");
}

if (!config.openAiApiKey) {
  throw new Error("Missing OPENAI_API_KEY for OCR worker.");
}
