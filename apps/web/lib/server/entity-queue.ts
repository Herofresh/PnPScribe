import "server-only";

import { Queue } from "bullmq";

const ENTITY_QUEUE_NAME = process.env.ENTITY_QUEUE_NAME ?? "entity-extraction-jobs";

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
  };
}

let queueSingleton: Queue | undefined;

function getQueue() {
  if (!queueSingleton) {
    queueSingleton = new Queue(ENTITY_QUEUE_NAME, {
      connection: createConnectionOptions(),
    });
  }

  return queueSingleton;
}

export interface EntityExtractionJobPayload {
  documentId: string;
  systemId: string;
  absolutePdfPath: string;
  requestedAt: string;
}

export async function enqueueEntityExtractionJob(payload: EntityExtractionJobPayload) {
  const queue = getQueue();

  const job = await queue.add("entity-extraction", payload, {
    jobId: `entity-${payload.documentId}`,
    removeOnComplete: 200,
    removeOnFail: 500,
    attempts: 2,
    backoff: {
      type: "exponential",
      delay: 5_000,
    },
  });

  return {
    queueName: ENTITY_QUEUE_NAME,
    jobId: job.id,
    payload,
  };
}

export { ENTITY_QUEUE_NAME };
