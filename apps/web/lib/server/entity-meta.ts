import "server-only";

import { prisma } from "@/lib/prisma";
import { openai } from "@/lib/openai";

const MAX_BATCH_CHARS = 18000;
const MAX_BATCH_CHUNKS = 10;
const DEFAULT_BATCH_CONCURRENCY = 3;

type BatchChunk = {
  chunkIndex: number;
  pageNumber: number | null;
  chapterHint: string | null;
  content: string;
};

type BatchChapter = {
  title: string;
  pageStart: number | null;
  pageEnd: number | null;
};

type MetaLocation = {
  page_start: number | null;
  page_end: number | null;
  chunk_start: number | null;
  chunk_end: number | null;
  section_title: string | null;
  reason: string | null;
};

type MetaEntityType = {
  name?: unknown;
  aliases?: unknown;
  signals?: unknown;
  example_sections?: unknown;
  likely_locations?: unknown;
  confidence?: unknown;
};

type BatchMetaResult = {
  batch_label: string;
  entity_types: Array<{
    name: string;
    aliases: string[];
    signals: string[];
    example_sections: string[];
    likely_locations: MetaLocation[];
    confidence: number;
  }>;
  notes: string[];
};

type MergedMetaResult = {
  entity_types: Array<{
    name: string;
    aliases: string[];
    signals: string[];
    example_sections: string[];
    likely_locations: MetaLocation[];
    confidence: number;
  }>;
  notes: string[];
};

type StoredMetaJson = {
  mode: "batched_text";
  model: string;
  batch_count: number;
  batch_concurrency: number;
  merge_mode: "single_batch" | "code" | "llm";
  batches: BatchMetaResult[];
  entity_types: MergedMetaResult["entity_types"];
  notes: string[];
};

type MetaBatch = {
  label: string;
  chunkStart: number;
  chunkEnd: number;
  pageStart: number | null;
  pageEnd: number | null;
  chapterTitles: string[];
  text: string;
};

function parseJson<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function buildBatchPrompt(params: {
  systemName: string | null;
  batch: MetaBatch;
}) {
  const systemLabel =
    params.systemName != null && params.systemName.trim() !== ""
      ? `System name: ${params.systemName}`
      : "System name: unknown";
  const chapterLabel =
    params.batch.chapterTitles.length > 0
      ? `Chapter hints: ${params.batch.chapterTitles.join(" | ")}`
      : "Chapter hints: none";

  return [
    "You are analyzing a batch of RPG rulebook text to build an entity index.",
    "Return strict JSON only.",
    "Schema:",
    "{",
    '  "batch_label": string,',
    '  "entity_types": [',
    "    {",
    '      "name": string,',
    '      "aliases": string[],',
    '      "signals": string[],',
    '      "example_sections": string[],',
    '      "likely_locations": [',
    "        {",
    '          "page_start": number | null,',
    '          "page_end": number | null,',
    '          "chunk_start": number | null,',
    '          "chunk_end": number | null,',
    '          "section_title": string | null,',
    '          "reason": string | null',
    "        }",
    "      ],",
    '      "confidence": number',
    "    }",
    "  ],",
    '  "notes": string[]',
    "}",
    "Rules:",
    "- Identify entity categories that appear in this batch or are strongly implied by the text.",
    "- Prefer RPG-relevant categories like creature, monster, spell, feat, item, class, talent, power, weapon, armor, condition, rule subsystem.",
    "- Only include categories supported by evidence in this batch.",
    "- likely_locations must point to where the category appears in this batch.",
    "- Keep aliases, signals, and example_sections concise.",
    systemLabel,
    `Batch label: ${params.batch.label}`,
    `Chunk range: ${params.batch.chunkStart}-${params.batch.chunkEnd}`,
    `Page range: ${params.batch.pageStart ?? "unknown"}-${params.batch.pageEnd ?? "unknown"}`,
    chapterLabel,
    "",
    "Batch text:",
    params.batch.text,
  ].join("\n");
}

function buildMergePrompt(params: {
  systemName: string | null;
  batchResults: BatchMetaResult[];
}) {
  const systemLabel =
    params.systemName != null && params.systemName.trim() !== ""
      ? `System name: ${params.systemName}`
      : "System name: unknown";

  return [
    "You are merging batch-level RPG entity index analyses into one document-level entity index.",
    "Return strict JSON only.",
    "Schema:",
    "{",
    '  "entity_types": [',
    "    {",
    '      "name": string,',
    '      "aliases": string[],',
    '      "signals": string[],',
    '      "example_sections": string[],',
    '      "likely_locations": [',
    "        {",
    '          "page_start": number | null,',
    '          "page_end": number | null,',
    '          "chunk_start": number | null,',
    '          "chunk_end": number | null,',
    '          "section_title": string | null,',
    '          "reason": string | null',
    "        }",
    "      ],",
    '      "confidence": number',
    "    }",
    "  ],",
    '  "notes": string[]',
    "}",
    "Rules:",
    "- Merge duplicate or synonymous categories when appropriate.",
    "- Preserve distinct categories when they mean different things.",
    "- Confidence should reflect aggregated evidence across batches.",
    "- likely_locations should preserve representative locations across the document.",
    systemLabel,
    "",
    "Batch results JSON:",
    JSON.stringify(params.batchResults),
  ].join("\n");
}

function normalizeStringArray(value: unknown, max = 20) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "").slice(0, max)
    : [];
}

function normalizeLocations(value: unknown, limit = 20): MetaLocation[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (typeof entry !== "object" || entry == null) {
        return null;
      }

      const typed = entry as Record<string, unknown>;
      return {
        page_start: typeof typed.page_start === "number" ? typed.page_start : null,
        page_end: typeof typed.page_end === "number" ? typed.page_end : null,
        chunk_start: typeof typed.chunk_start === "number" ? typed.chunk_start : null,
        chunk_end: typeof typed.chunk_end === "number" ? typed.chunk_end : null,
        section_title: typeof typed.section_title === "string" ? typed.section_title : null,
        reason: typeof typed.reason === "string" ? typed.reason : null,
      };
    })
    .filter((entry): entry is MetaLocation => entry !== null)
    .slice(0, limit);
}

function normalizeEntityTypes(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      const typed = entry as MetaEntityType;
      const name = typeof typed.name === "string" ? typed.name.trim() : "";
      if (name === "") {
        return null;
      }

      const confidence =
        typeof typed.confidence === "number" && Number.isFinite(typed.confidence)
          ? Math.max(0, Math.min(1, typed.confidence))
          : 0.5;

      return {
        name,
        aliases: normalizeStringArray(typed.aliases),
        signals: normalizeStringArray(typed.signals),
        example_sections: normalizeStringArray(typed.example_sections),
        likely_locations: normalizeLocations(typed.likely_locations),
        confidence,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        name: string;
        aliases: string[];
        signals: string[];
        example_sections: string[];
        likely_locations: MetaLocation[];
        confidence: number;
      } => entry !== null,
    );
}

function normalizeBatchResult(raw: unknown, fallbackLabel: string): BatchMetaResult {
  const typed = typeof raw === "object" && raw != null ? (raw as Record<string, unknown>) : {};

  return {
    batch_label: typeof typed.batch_label === "string" && typed.batch_label.trim() !== "" ? typed.batch_label : fallbackLabel,
    entity_types: normalizeEntityTypes(typed.entity_types),
    notes: normalizeStringArray(typed.notes, 30),
  };
}

function normalizeMergedResult(raw: unknown): MergedMetaResult {
  const typed = typeof raw === "object" && raw != null ? (raw as Record<string, unknown>) : {};

  return {
    entity_types: normalizeEntityTypes(typed.entity_types),
    notes: normalizeStringArray(typed.notes, 50),
  };
}

function buildFallbackMerge(batchResults: BatchMetaResult[]): MergedMetaResult {
  const byName = new Map<
    string,
    {
      name: string;
      aliases: Set<string>;
      signals: Set<string>;
      example_sections: Set<string>;
      likely_locations: MetaLocation[];
      confidenceTotal: number;
      count: number;
    }
  >();

  for (const batch of batchResults) {
    for (const entityType of batch.entity_types) {
      const key = entityType.name.trim().toLowerCase();
      const existing =
        byName.get(key) ??
        {
          name: entityType.name,
          aliases: new Set<string>(),
          signals: new Set<string>(),
          example_sections: new Set<string>(),
          likely_locations: [],
          confidenceTotal: 0,
          count: 0,
        };

      entityType.aliases.forEach((alias) => existing.aliases.add(alias));
      entityType.signals.forEach((signal) => existing.signals.add(signal));
      entityType.example_sections.forEach((section) => existing.example_sections.add(section));
      existing.likely_locations.push(...entityType.likely_locations);
      existing.confidenceTotal += entityType.confidence;
      existing.count += 1;
      byName.set(key, existing);
    }
  }

  return {
    entity_types: Array.from(byName.values()).map((entry) => ({
      name: entry.name,
      aliases: Array.from(entry.aliases).slice(0, 20),
      signals: Array.from(entry.signals).slice(0, 20),
      example_sections: Array.from(entry.example_sections).slice(0, 20),
      likely_locations: entry.likely_locations.slice(0, 20),
      confidence: entry.count > 0 ? Math.max(0, Math.min(1, entry.confidenceTotal / entry.count)) : 0.5,
    })),
    notes: [],
  };
}

function getBatchConcurrency() {
  const raw = Number.parseInt(process.env.ENTITY_META_BATCH_CONCURRENCY ?? "", 10);
  if (!Number.isFinite(raw) || raw < 1) {
    return DEFAULT_BATCH_CONCURRENCY;
  }
  return Math.min(raw, 6);
}

async function analyzeBatches(
  systemName: string | null,
  model: string,
  batches: MetaBatch[],
  documentId: string,
) {
  const concurrency = Math.min(getBatchConcurrency(), batches.length);
  const results = new Array<BatchMetaResult>(batches.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= batches.length) {
        return;
      }

      const batch = batches[index]!;
      console.warn("[entity-meta] requesting batch", {
        documentId,
        model,
        batch: index + 1,
        batchCount: batches.length,
        label: batch.label,
      });

      results[index] = await analyzeBatch(systemName, model, batch);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return { results, concurrency };
}

function buildBatches(chunks: BatchChunk[], chapters: BatchChapter[]): MetaBatch[] {
  if (chunks.length === 0) {
    return [];
  }

  const batches: MetaBatch[] = [];
  let pending: BatchChunk[] = [];

  function flush(batchChunks: BatchChunk[]) {
    if (batchChunks.length === 0) {
      return;
    }

    const chunkStart = batchChunks[0]!.chunkIndex;
    const chunkEnd = batchChunks[batchChunks.length - 1]!.chunkIndex;
    const pageNumbers = batchChunks.map((chunk) => chunk.pageNumber).filter((page): page is number => page != null);
    const pageStart = pageNumbers.length > 0 ? Math.min(...pageNumbers) : null;
    const pageEnd = pageNumbers.length > 0 ? Math.max(...pageNumbers) : null;
    const chapterTitles = Array.from(
      new Set(
        [
          ...batchChunks
            .map((chunk) => chunk.chapterHint)
            .filter((hint): hint is string => hint != null && hint.trim() !== ""),
          ...chapters
            .filter((chapter) => {
              if (pageStart == null || pageEnd == null) {
                return false;
              }

              const start = chapter.pageStart ?? pageStart;
              const end = chapter.pageEnd ?? start;
              return start <= pageEnd && end >= pageStart;
            })
            .map((chapter) => chapter.title),
        ].map((value) => value.trim()),
      ),
    ).slice(0, 6);

    const text = batchChunks
      .map((chunk) => {
        const header = [
          `chunk=${chunk.chunkIndex}`,
          chunk.pageNumber != null ? `page=${chunk.pageNumber}` : null,
          chunk.chapterHint != null && chunk.chapterHint !== "" ? `chapter=${chunk.chapterHint}` : null,
        ]
          .filter(Boolean)
          .join(" ");

        return `--- ${header} ---\n${chunk.content}`;
      })
      .join("\n\n")
      .slice(0, MAX_BATCH_CHARS + 2000);

    batches.push({
      label: `chunks ${chunkStart}-${chunkEnd}`,
      chunkStart,
      chunkEnd,
      pageStart,
      pageEnd,
      chapterTitles,
      text,
    });
  }

  for (const chunk of chunks) {
    const currentChars = pending.reduce((sum, entry) => sum + entry.content.length, 0);
    const nextChars = currentChars + chunk.content.length;

    if (pending.length > 0 && (pending.length >= MAX_BATCH_CHUNKS || nextChars > MAX_BATCH_CHARS)) {
      flush(pending);
      pending = [];
    }

    pending.push(chunk);
  }

  flush(pending);
  return batches;
}

async function analyzeBatch(systemName: string | null, model: string, batch: MetaBatch) {
  const prompt = buildBatchPrompt({ systemName, batch });

  const response = await openai.responses.create({
    model,
    input: prompt,
    temperature: 0,
    max_output_tokens: 1600,
  });

  const output = response.output_text?.trim() ?? "";
  const parsed = output !== "" ? parseJson<unknown>(output) : null;

  return normalizeBatchResult(parsed, batch.label);
}

async function mergeBatchResults(systemName: string | null, model: string, batchResults: BatchMetaResult[]) {
  const prompt = buildMergePrompt({ systemName, batchResults });

  const response = await openai.responses.create({
    model,
    input: prompt,
    temperature: 0,
    max_output_tokens: 2000,
  });

  const output = response.output_text?.trim() ?? "";
  const parsed = output !== "" ? parseJson<unknown>(output) : null;

  if (parsed == null) {
    return buildFallbackMerge(batchResults);
  }

  return normalizeMergedResult(parsed);
}

export async function runEntityMetaAnalysis(params: {
  documentId: string;
  absolutePdfPath: string;
}) {
  console.warn("[entity-meta] start", {
    documentId: params.documentId,
    absolutePdfPath: params.absolutePdfPath,
  });

  const document = await prisma.document.findUnique({
    where: { id: params.documentId },
    select: {
      id: true,
      extractedText: true,
      extractedTextLength: true,
      system: { select: { name: true } },
      chapters: {
        orderBy: { pageStart: "asc" },
        select: {
          title: true,
          pageStart: true,
          pageEnd: true,
        },
      },
      chunks: {
        orderBy: { chunkIndex: "asc" },
        select: {
          chunkIndex: true,
          pageNumber: true,
          chapterHint: true,
          content: true,
        },
      },
    },
  });

  if (document == null) {
    throw new Error("Document not found.");
  }

  await prisma.document.update({
    where: { id: document.id },
    data: {
      entityMetaStatus: "processing",
      entityMetaError: null,
      entityMetaUpdatedAt: new Date(),
    },
  });

  try {
    if (document.extractedText == null || document.extractedText.trim() === "") {
      throw new Error("Document has no extracted text for meta analysis.");
    }

    const configuredModel = process.env.ENTITY_META_MODEL?.trim() ?? "";
    const model = configuredModel !== "" ? configuredModel : "gpt-4.1-mini";
    const batches = buildBatches(document.chunks, document.chapters);

    if (batches.length === 0) {
      throw new Error("Document has no chunks for meta analysis.");
    }

    console.warn("[entity-meta] analyzing batches", {
      documentId: document.id,
      model,
      textLength: document.extractedTextLength,
      batchCount: batches.length,
    });

    const { results: batchResults, concurrency } = await analyzeBatches(
      document.system?.name ?? null,
      model,
      batches,
      document.id,
    );
    const shouldUseLlmMerge = process.env.ENTITY_META_ENABLE_LLM_MERGE === "true";
    const mergeMode: StoredMetaJson["merge_mode"] =
      batchResults.length <= 1 ? "single_batch" : shouldUseLlmMerge ? "llm" : "code";
    const merged =
      mergeMode === "single_batch"
        ? {
            entity_types: batchResults[0]?.entity_types ?? [],
            notes: batchResults[0]?.notes ?? [],
          }
        : mergeMode === "llm"
          ? await mergeBatchResults(document.system?.name ?? null, model, batchResults)
          : buildFallbackMerge(batchResults);
    const storedJson: StoredMetaJson = {
      mode: "batched_text",
      model,
      batch_count: batches.length,
      batch_concurrency: concurrency,
      merge_mode: mergeMode,
      batches: batchResults,
      entity_types: merged.entity_types,
      notes: merged.notes,
    };

    await prisma.document.update({
      where: { id: document.id },
      data: {
        entityMetaStatus: "completed",
        entityMetaError: null,
        entityMetaModel: model,
        entityMetaJson: storedJson,
        entityMetaUpdatedAt: new Date(),
      },
    });

    console.warn("[entity-meta] completed", {
      documentId: document.id,
      model,
      batchCount: batches.length,
      entityTypeCount: merged.entity_types.length,
    });

    return {
      model,
      json: storedJson,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Entity meta analysis failed.";
    await prisma.document.update({
      where: { id: document.id },
      data: {
        entityMetaStatus: "failed",
        entityMetaError: message.slice(0, 500),
        entityMetaUpdatedAt: new Date(),
      },
    });
    console.error("[entity-meta] failed", {
      documentId: document.id,
      error: message,
    });
    throw error;
  }
}
