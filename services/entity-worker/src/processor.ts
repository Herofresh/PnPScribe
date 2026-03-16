import OpenAI from "openai";

import { config } from "./config.js";
import {
  clearEntitiesForDocument,
  getEntityMeta,
  listCandidateGroups,
  listChunksForGroup,
  listNearbyChunks,
  setEntityCompleted,
  setEntityFailed,
  setEntityProcessing,
  setEntityProgress,
  upsertEntity,
  insertRuleLinks,
  insertEntityImages,
} from "./db.js";
import type { ChunkGroupRecord } from "./db.js";
import type { EntityExtractionJobPayload } from "./types.js";
import { extractEntityImages } from "./pdf-images.js";

const openai = new OpenAI({ apiKey: config.openAiApiKey });

type CandidateType = string;

interface NormalizedEntity {
  type: CandidateType;
  name: string;
  aliases: string[];
  confidence: number;
  coreData: Record<string, unknown>;
  rawData: Record<string, unknown> | null;
}

interface MetaEntityType {
  name?: unknown;
  aliases?: unknown;
  signals?: unknown;
  example_sections?: unknown;
  likely_locations?: unknown;
  confidence?: unknown;
}

interface MetaLocation {
  page_start?: unknown;
  page_end?: unknown;
  chunk_start?: unknown;
  chunk_end?: unknown;
  section_title?: unknown;
  reason?: unknown;
}

interface ParsedMetaEntityType {
  name: string;
  aliases: string[];
  signals: string[];
  exampleSections: string[];
  likelyLocations: Array<{
    pageStart: number | null;
    pageEnd: number | null;
    chunkStart: number | null;
    chunkEnd: number | null;
    sectionTitle: string | null;
    reason: string | null;
  }>;
  confidence: number;
}

function extractEntityTypes(meta: unknown): ParsedMetaEntityType[] {
  if (!meta || typeof meta !== "object") {
    return [];
  }
  const rawTypes = (meta as { entity_types?: unknown }).entity_types;
  if (!Array.isArray(rawTypes)) {
    return [];
  }
  return rawTypes
    .map((entry) => {
      const typed = entry as MetaEntityType;
      const name = typeof typed.name === "string" ? typed.name.trim() : "";
      if (!name) {
        return null;
      }
      const aliases = Array.isArray(typed.aliases)
        ? typed.aliases.filter((alias): alias is string => typeof alias === "string")
        : [];
      const signals = Array.isArray(typed.signals)
        ? typed.signals.filter((signal): signal is string => typeof signal === "string")
        : [];
      const exampleSections = Array.isArray(typed.example_sections)
        ? typed.example_sections.filter((section): section is string => typeof section === "string")
        : [];
      const likelyLocations = Array.isArray(typed.likely_locations)
        ? typed.likely_locations
            .map((location) => {
              const parsed = typeof location === "object" && location !== null ? (location as MetaLocation) : null;
              if (parsed == null) {
                return null;
              }
              return {
                pageStart: typeof parsed.page_start === "number" ? parsed.page_start : null,
                pageEnd: typeof parsed.page_end === "number" ? parsed.page_end : null,
                chunkStart: typeof parsed.chunk_start === "number" ? parsed.chunk_start : null,
                chunkEnd: typeof parsed.chunk_end === "number" ? parsed.chunk_end : null,
                sectionTitle: typeof parsed.section_title === "string" ? parsed.section_title : null,
                reason: typeof parsed.reason === "string" ? parsed.reason : null,
              };
            })
            .filter(
              (
                location,
              ): location is ParsedMetaEntityType["likelyLocations"][number] => location !== null,
            )
        : [];
      const confidence =
        typeof typed.confidence === "number" && Number.isFinite(typed.confidence)
          ? Math.max(0, Math.min(1, typed.confidence))
          : 0.5;
      return { name, aliases, signals, exampleSections, likelyLocations, confidence };
    })
    .filter((entry): entry is ParsedMetaEntityType => Boolean(entry));
}

function pickEntityType(input: string | undefined, allowed: ParsedMetaEntityType[]) {
  if (!input) {
    return null;
  }
  const normalized = input.trim().toLowerCase();
  for (const entry of allowed) {
    if (entry.name.toLowerCase() === normalized) {
      return entry.name;
    }
    if (entry.aliases.some((alias) => alias.toLowerCase() === normalized)) {
      return entry.name;
    }
  }
  return null;
}

function normalizeText(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function rangeOverlaps(startA: number | null, endA: number | null, startB: number | null, endB: number | null) {
  if (startA == null || endA == null || startB == null || endB == null) {
    return false;
  }
  return startA <= endB && endA >= startB;
}

function rankMetaTypesForGroup(group: ChunkGroupRecord, content: string, entityTypes: ParsedMetaEntityType[]) {
  const titleText = normalizeText(group.title);
  const chapterText = normalizeText(group.chapterHint);
  const contentText = content.toLowerCase();

  return entityTypes
    .map((entry) => {
      let score = entry.confidence * 2;

      if (titleText.includes(entry.name.toLowerCase())) {
        score += 6;
      }

      for (const alias of entry.aliases) {
        const normalizedAlias = alias.toLowerCase();
        if (titleText.includes(normalizedAlias)) {
          score += 4;
        }
        if (contentText.includes(normalizedAlias)) {
          score += 2;
        }
      }

      for (const signal of entry.signals) {
        const normalizedSignal = signal.toLowerCase();
        if (contentText.includes(normalizedSignal)) {
          score += 1.5;
        }
      }

      for (const section of entry.exampleSections) {
        const normalizedSection = section.toLowerCase();
        if (titleText.includes(normalizedSection) || chapterText.includes(normalizedSection)) {
          score += 2;
        }
      }

      for (const location of entry.likelyLocations) {
        if (
          rangeOverlaps(group.startChunkIndex, group.endChunkIndex, location.chunkStart, location.chunkEnd) ||
          rangeOverlaps(group.startPage, group.endPage, location.pageStart, location.pageEnd)
        ) {
          score += 5;
        }

        if (location.sectionTitle && (titleText.includes(location.sectionTitle.toLowerCase()) || chapterText.includes(location.sectionTitle.toLowerCase()))) {
          score += 2.5;
        }
      }

      return { ...entry, score };
    })
    .sort((left, right) => right.score - left.score);
}

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function parseJsonObject(input: string) {
  try {
    const parsed = JSON.parse(input);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function inferNameFromTitle(group: ChunkGroupRecord, content: string) {
  const title = group.title?.trim();
  if (title && title.length > 2) {
    return title.replace(/^(chapter|section|part)\s*[:0-9.-]*\s*/i, "").slice(0, 120);
  }

  const firstLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 2);

  return (firstLine ?? "Unknown Entity").slice(0, 120);
}

async function normalizeEntityWithLlm(
  group: ChunkGroupRecord,
  content: string,
  meta: { entityTypes: ParsedMetaEntityType[] },
): Promise<NormalizedEntity | null> {
  const rankedMetaTypes = rankMetaTypesForGroup(group, content, meta.entityTypes);
  const topMetaTypes = rankedMetaTypes.slice(0, 5);
  const guessedType: CandidateType =
    topMetaTypes[0]?.name ?? (group.kind === "item_section" ? "item" : "monster");
  const fallbackName = inferNameFromTitle(group, content);
  const allowedTypes = meta.entityTypes;
  const typeHint =
    allowedTypes.length > 0
      ? `Allowed entity types: ${allowedTypes.map((entry) => entry.name).join(", ")}.`
      : "";
  const metaHint =
    topMetaTypes.length > 0
      ? `Prioritize these document-level entity hints when relevant: ${topMetaTypes
          .map(
            (entry) =>
              `${entry.name} (score=${entry.score.toFixed(1)}, signals=${entry.signals.slice(0, 3).join("|") || "none"}, sections=${entry.exampleSections.slice(0, 2).join("|") || "none"})`,
          )
          .join("; ")}.`
      : "";

  try {
    const response = await openai.responses.create({
      model: config.entityModel,
      temperature: 0,
      max_output_tokens: 700,
      input: [
        {
          role: "system",
          content:
            [
              "Extract one RPG entity from text. Return strict JSON only. No markdown.",
              "Schema: {entityType:string,name:string,aliases:string[],confidence:number,coreData:object,notes:string[]}",
              typeHint,
              metaHint,
            ]
              .filter(Boolean)
              .join(" "),
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                `Section kind: ${group.kind}`,
                `Title: ${group.title ?? ""}`,
                `Chapter hint: ${group.chapterHint ?? ""}`,
                `Chunk range: ${group.startChunkIndex}-${group.endChunkIndex}`,
                `Page range: ${group.startPage ?? "unknown"}-${group.endPage ?? "unknown"}`,
                topMetaTypes.length > 0
                  ? `Relevant meta hints: ${JSON.stringify(
                      topMetaTypes.map((entry) => ({
                        name: entry.name,
                        aliases: entry.aliases.slice(0, 5),
                        signals: entry.signals.slice(0, 5),
                        exampleSections: entry.exampleSections.slice(0, 3),
                        likelyLocations: entry.likelyLocations.slice(0, 4),
                      })),
                    )}`
                  : null,
                `Text:\n${content.slice(0, 9000)}`,
              ]
                .filter(Boolean)
                .join("\n"),
            },
          ],
        },
      ],
    });

    const raw = parseJsonObject(response.output_text ?? "");
    if (!raw) {
      return {
        type: guessedType,
        name: fallbackName,
        aliases: [],
        confidence: 0.55,
        coreData: {
          extractedBy: "fallback",
          sourceKind: group.kind,
        },
        rawData: {
          llmParse: "invalid_json",
          output: response.output_text ?? "",
        },
      };
    }

    const parsed = raw as {
      entityType?: unknown;
      name?: unknown;
      aliases?: unknown;
      confidence?: unknown;
      coreData?: unknown;
    };

    const rawEntityType = typeof parsed.entityType === "string" ? parsed.entityType : undefined;
    const entityType = pickEntityType(rawEntityType, allowedTypes) ?? guessedType;
    const name =
      typeof parsed.name === "string" && parsed.name.trim().length > 0
        ? parsed.name.trim().slice(0, 140)
        : fallbackName;
    const aliases = Array.isArray(parsed.aliases)
      ? parsed.aliases.filter((alias): alias is string => typeof alias === "string").slice(0, 20)
      : [];
    const confidence =
      typeof parsed.confidence === "number" && Number.isFinite(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.6;
    const coreData =
      typeof parsed.coreData === "object" && parsed.coreData !== null
        ? (parsed.coreData as Record<string, unknown>)
        : {};

    return {
      type: entityType,
      name,
      aliases,
      confidence,
      coreData,
      rawData: {
        llm: parsed,
        matchedMetaTypes: topMetaTypes.map((entry) => ({
          name: entry.name,
          score: entry.score,
          signals: entry.signals.slice(0, 5),
          exampleSections: entry.exampleSections.slice(0, 3),
        })),
      },
    };
  } catch (error) {
    return {
      type: guessedType,
      name: fallbackName,
      aliases: [],
      confidence: 0.5,
      coreData: {
        extractedBy: "heuristic",
        sourceKind: group.kind,
      },
      rawData: {
        llmError: error instanceof Error ? error.message : "unknown",
      },
    };
  }
}

function inferRuleRelation(content: string): "create" | "modify" | "usage" {
  if (/(create|build|new|construct|generate)/i.test(content)) {
    return "create";
  }

  if (/(modify|adjust|customi[sz]e|variant|template)/i.test(content)) {
    return "modify";
  }

  return "usage";
}

export async function processEntityJob(
  payload: EntityExtractionJobPayload,
  params?: { onProgress?: (message: string, extractedCount: number, ruleLinkCount: number) => Promise<void> },
) {
  await setEntityProcessing(payload.documentId);
  await clearEntitiesForDocument(payload.documentId, payload.systemId);

  const meta = {
    entityTypes: extractEntityTypes(await getEntityMeta(payload.documentId)),
  };
  console.log("[entity-worker] meta analysis loaded", {
    documentId: payload.documentId,
    entityTypes: meta.entityTypes.map((entry) => entry.name),
  });

  const groups = await listCandidateGroups(payload.documentId);
  console.log("[entity-worker] candidate groups loaded", {
    documentId: payload.documentId,
    count: groups.length,
    kinds: Array.from(new Set(groups.map((group) => group.kind))),
  });
  let extractedEntities = 0;
  let linkedRules = 0;
  let linkedImages = 0;

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index]!;
    const chunks = await listChunksForGroup(group.id);
    if (chunks.length === 0) {
      continue;
    }

    const content = chunks.map((chunk) => chunk.content).join("\n\n");
    const normalized = await normalizeEntityWithLlm(group, content, meta);
    if (!normalized || normalized.confidence < config.confidenceThreshold) {
      continue;
    }

    const slug = slugify(normalized.name);
    if (!slug) {
      continue;
    }

    const entityId = await upsertEntity({
      systemId: payload.systemId,
      documentId: payload.documentId,
      groupId: group.id,
      type: normalized.type,
      name: normalized.name,
      slug,
      sourcePageStart: group.startPage,
      sourcePageEnd: group.endPage,
      sourceChunkStart: group.startChunkIndex,
      sourceChunkEnd: group.endChunkIndex,
      confidence: normalized.confidence,
      extractionMethod: "hybrid",
      coreData: {
        ...normalized.coreData,
        aliases: normalized.aliases,
      },
      rawData: normalized.rawData,
    });

    if (!entityId) {
      continue;
    }

    extractedEntities += 1;

    const nearby = await listNearbyChunks(
      payload.documentId,
      Math.max(0, group.startChunkIndex - config.ruleLinkWindow),
      group.endChunkIndex + config.ruleLinkWindow,
    );

    const linkCandidates = nearby
      .map((chunk) => ({
        id: chunk.id,
        relation: inferRuleRelation(chunk.content),
        score: /(create|modify|variant|template|customi[sz]e|build)/i.test(chunk.content) ? 0.8 : 0.45,
      }))
      .filter((candidate) => candidate.score >= 0.55)
      .slice(0, 8)
      .map((candidate) => ({
        chunkId: candidate.id,
        relation: candidate.relation,
        confidence: candidate.score,
        rationale: "Nearby rule chunk classified by keyword matcher.",
      }));

    const inserted = await insertRuleLinks({
      entityId,
      links: linkCandidates,
    });

    linkedRules += inserted;

    if (config.imageExtractionEnabled) {
      try {
        if (group.startPage == null && group.endPage == null) {
          console.warn("[entity-worker] skipping image extraction (no page numbers)", {
            entityId,
            groupId: group.id,
          });
        } else {
          const images = await extractEntityImages({
            systemId: payload.systemId,
            documentId: payload.documentId,
            entityId,
            absolutePdfPath: payload.absolutePdfPath,
            pageStart: group.startPage,
            pageEnd: group.endPage,
            maxPages: Math.max(1, config.imageMaxPages),
            targetWidth: Math.max(200, config.imageTargetWidth),
          });

          const imageInserted = await insertEntityImages({
            entityId,
            documentId: payload.documentId,
            images,
          });

          linkedImages += imageInserted;
        }
      } catch (error) {
        console.error("[entity-worker] image extraction failed", {
          entityId,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    if (params?.onProgress) {
      await params.onProgress(
        `Processed ${index + 1}/${groups.length} entity groups`,
        extractedEntities,
        linkedRules,
      );
    }

    await setEntityProgress(payload.documentId, {
      message: `Processed ${index + 1}/${groups.length} entity groups`,
      extractedCount: extractedEntities,
      ruleLinkCount: linkedRules,
      imageCount: linkedImages,
    });
  }

  await setEntityCompleted(payload.documentId, {
    extractedCount: extractedEntities,
    ruleLinkCount: linkedRules,
    imageCount: linkedImages,
  });

  return {
    extractedEntities,
    linkedRules,
    linkedImages,
  };
}

export async function processEntityJobSafely(payload: EntityExtractionJobPayload) {
  try {
    return await processEntityJob(payload);
  } catch (error) {
    await setEntityFailed(
      payload.documentId,
      error instanceof Error ? error.message : "Entity extraction failed.",
    );
    throw error;
  }
}
