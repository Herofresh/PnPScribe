import "server-only";

import { Queue } from "bullmq";

const OCR_QUEUE_NAME = "ocr-document-jobs";

const redisUrl = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";

function createConnectionOptions() {
  const url = new URL(redisUrl);
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    username: url.username || undefined,
    password: url.password || undefined,
    db: url.pathname && url.pathname !== "/" ? Number(url.pathname.slice(1)) : undefined,
    maxRetriesPerRequest: null as null,
  }
}

let queueSingleton: Queue | undefined;

function getQueue() {
  if (!queueSingleton) {
    queueSingleton = new Queue(OCR_QUEUE_NAME, {
      connection: createConnectionOptions(),
    });
  }

  return queueSingleton;
}

export interface OcrDocumentJobPayload {
  documentId: string;
  requestedAt: string;
  mode: "replace" | "supplement";
  fullRun: boolean;
}

export async function enqueueOcrDocumentJob(payload: OcrDocumentJobPayload) {
  const queue = getQueue();

  const job = await queue.add("ocr-document", payload, {
    jobId: `ocr-${payload.documentId}`,
    removeOnComplete: 200,
    removeOnFail: 500,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5_000,
    },
  });

  return {
    queueName: OCR_QUEUE_NAME,
    jobId: job.id,
    payload,
  };
}

export { OCR_QUEUE_NAME };
