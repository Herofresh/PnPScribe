import "dotenv/config";

import { Worker } from "bullmq";

import { config } from "./config.js";
import { pool } from "./db.js";
import { processOcrJob } from "./processor.js";
import type { OcrDocumentJobPayload } from "./types.js";

function createRedisConnectionOptions() {
  const url = new URL(config.redisUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname && url.pathname !== "/" ? Number(url.pathname.slice(1)) : undefined,
    maxRetriesPerRequest: null as null,
  };
}

const connection = createRedisConnectionOptions();
let isShuttingDown = false;
let forcedExitTimer: NodeJS.Timeout | null = null;

function summarizeRedisUrl(urlString: string) {
  try {
    const url = new URL(urlString);
    const db = url.pathname && url.pathname !== "/" ? url.pathname.slice(1) : "0";
    return `${url.protocol}//${url.hostname}:${url.port || "6379"}/${db}`;
  } catch {
    return "(invalid REDIS_URL)";
  }
}

console.log("[ocr-worker] booting...");
console.log("[ocr-worker] config", {
  queue: config.ocrQueueName,
  redis: summarizeRedisUrl(config.redisUrl),
  projectRoot: config.projectRoot,
  embedModel: config.embedModel,
  hasDatabaseUrl: Boolean(config.databaseUrl),
  hasOpenAiApiKey: Boolean(config.openAiApiKey),
});

const worker = new Worker<OcrDocumentJobPayload>(
  config.ocrQueueName,
  async (job) => {
    const startedAt = Date.now();

    if (job.name !== "ocr-document") {
      throw new Error(`Unsupported OCR job type: ${job.name}`);
    }

    console.log("[ocr-worker] job start", {
      id: job.id,
      name: job.name,
      attemptsMade: job.attemptsMade,
      documentId: job.data.documentId,
      requestedAt: job.data.requestedAt,
    });

    const result = await processOcrJob(job.data, {
      onProgress: async (progress) => {
        await job.updateProgress({
          page: progress.currentPage,
          totalPages: progress.totalPages,
          message: progress.message,
        });
        console.log("[ocr-worker] progress", {
          jobId: job.id,
          documentId: job.data.documentId,
          page: progress.currentPage,
          totalPages: progress.totalPages,
          message: progress.message,
        });
      },
    });
    console.log("[ocr-worker] job end", {
      id: job.id,
      durationMs: Date.now() - startedAt,
      result,
    });
    return result;
  },
  {
    connection,
    concurrency: 1,
    lockDuration: 5 * 60 * 1000,
  },
);

worker.on("ready", () => {
  console.log(`[ocr-worker] worker ready (queue=${config.ocrQueueName})`);
  console.log("[ocr-worker] redis target", summarizeRedisUrl(config.redisUrl));
});

worker.on("active", (job) => {
  console.log("[ocr-worker] active", {
    id: job.id,
    name: job.name,
    documentId: (job.data as OcrDocumentJobPayload).documentId,
  });
});

worker.on("stalled", (jobId) => {
  console.warn("[ocr-worker] stalled", { jobId });
});

worker.on("progress", (job, progress) => {
  console.log("[ocr-worker] bullmq progress", {
    id: job.id,
    progress,
  });
});

worker.on("completed", (job, result) => {
  console.log(`[ocr-worker] completed job ${job.id}`, result);
});

worker.on("failed", (job, error) => {
  console.error(`[ocr-worker] failed job ${job?.id ?? "unknown"}`, {
    name: job?.name,
    attemptsMade: job?.attemptsMade,
    documentId: (job?.data as OcrDocumentJobPayload | undefined)?.documentId,
    error,
  });
});

async function shutdown(signal: string) {
  if (isShuttingDown) {
    console.log(`[ocr-worker] shutdown already in progress (${signal})`);
    return;
  }

  isShuttingDown = true;
  console.log(`[ocr-worker] shutting down (${signal})`);

  forcedExitTimer = setTimeout(() => {
    console.error("[ocr-worker] forced shutdown timeout reached, exiting");
    process.exit(1);
  }, 10_000);

  try {
    // false => don't wait indefinitely for currently running jobs
    await worker.close(false);
  } catch (error) {
    console.error("[ocr-worker] error while closing worker", error);
  }

  try {
    await pool.end();
  } catch (error) {
    console.error("[ocr-worker] error while closing postgres pool", error);
  }

  if (forcedExitTimer) {
    clearTimeout(forcedExitTimer);
  }

  console.log("[ocr-worker] shutdown complete");
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
