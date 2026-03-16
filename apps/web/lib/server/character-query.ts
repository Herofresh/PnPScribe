import "server-only";

import { Prisma } from "@prisma/client";

import { pickChatModel } from "@/lib/ai/model";
import { MODELS, type ChatModelTier, openai } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { HttpError } from "@/lib/server/http-error";

interface RetrievedSystemChunk {
  id: string;
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  chapterHint: string | null;
  filePath: string;
  distance: number;
}

interface RetrievedCharacterChunk {
  id: string;
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  chapterHint: string | null;
  filePath: string;
  label: string | null;
  originalFileName: string;
  characterName: string;
  distance: number;
}

const SYSTEM_CONTEXT_TOP_K = 6;
const CHARACTER_CONTEXT_TOP_K = 6;
const GROUP_CHARACTER_CONTEXT_TOP_K = 10;

function toVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}

export function parseCharacterQuestion(input: unknown) {
  const question = typeof input === "string" ? input.trim() : "";

  if (question === "") {
    throw new HttpError(400, "question is required.");
  }

  if (question.length > 2000) {
    throw new HttpError(400, "question is too long (max 2000 chars).");
  }

  return question;
}

async function embedQuestion(question: string) {
  const embeddingResponse = await openai.embeddings.create({
    model: MODELS.embed,
    input: question,
  });

  const questionEmbedding = embeddingResponse.data[0]?.embedding;
  if (!Array.isArray(questionEmbedding) || questionEmbedding.length === 0) {
    throw new Error("Failed to generate question embedding.");
  }

  return toVectorLiteral(questionEmbedding);
}

async function retrieveSystemChunks(systemId: string, vectorLiteral: string, topK = SYSTEM_CONTEXT_TOP_K) {
  const rows = await prisma.$queryRaw<RetrievedSystemChunk[]>(
    Prisma.sql`
      SELECT
        c."id",
        c."content",
        c."chunkIndex",
        c."pageNumber",
        c."chapterHint",
        d."filePath",
        (c."embedding" <=> CAST(${vectorLiteral} AS vector))::float8 AS "distance"
      FROM "Chunk" c
      INNER JOIN "Document" d ON d."id" = c."documentId"
      WHERE d."systemId" = ${systemId}
        AND c."embedding" IS NOT NULL
      ORDER BY c."embedding" <=> CAST(${vectorLiteral} AS vector)
      LIMIT ${topK}
    `,
  );

  return rows;
}

async function retrieveCharacterChunksForCharacter(
  characterId: string,
  vectorLiteral: string,
  topK = CHARACTER_CONTEXT_TOP_K,
) {
  const rows = await prisma.$queryRaw<RetrievedCharacterChunk[]>(
    Prisma.sql`
      SELECT
        cc."id",
        cc."content",
        cc."chunkIndex",
        cc."pageNumber",
        cc."chapterHint",
        cf."filePath",
        cf."label",
        cf."originalFileName",
        ch."name" AS "characterName",
        (cc."embedding" <=> CAST(${vectorLiteral} AS vector))::float8 AS "distance"
      FROM "CharacterChunk" cc
      INNER JOIN "CharacterFile" cf ON cf."id" = cc."characterFileId"
      INNER JOIN "Character" ch ON ch."id" = cf."characterId"
      WHERE cf."characterId" = ${characterId}
        AND cf."isListed" = true
        AND cc."embedding" IS NOT NULL
      ORDER BY cc."embedding" <=> CAST(${vectorLiteral} AS vector)
      LIMIT ${topK}
    `,
  );

  return rows;
}

async function retrieveCharacterChunksForGroup(
  groupId: string,
  vectorLiteral: string,
  topK = GROUP_CHARACTER_CONTEXT_TOP_K,
) {
  const rows = await prisma.$queryRaw<RetrievedCharacterChunk[]>(
    Prisma.sql`
      SELECT
        cc."id",
        cc."content",
        cc."chunkIndex",
        cc."pageNumber",
        cc."chapterHint",
        cf."filePath",
        cf."label",
        cf."originalFileName",
        ch."name" AS "characterName",
        (cc."embedding" <=> CAST(${vectorLiteral} AS vector))::float8 AS "distance"
      FROM "CharacterChunk" cc
      INNER JOIN "CharacterFile" cf ON cf."id" = cc."characterFileId"
      INNER JOIN "Character" ch ON ch."id" = cf."characterId"
      WHERE ch."groupId" = ${groupId}
        AND cf."isListed" = true
        AND cc."embedding" IS NOT NULL
      ORDER BY cc."embedding" <=> CAST(${vectorLiteral} AS vector)
      LIMIT ${topK}
    `,
  );

  return rows;
}

function buildPrompt(params: {
  question: string;
  systemChunks: RetrievedSystemChunk[];
  characterChunks: RetrievedCharacterChunk[];
  scopeLabel: string;
}) {
  const systemContext = params.systemChunks
    .map((chunk, index) => {
      const meta = [
        `S${index + 1}`,
        `file=${chunk.filePath}`,
        `chunk=${chunk.chunkIndex}`,
        chunk.pageNumber != null ? `page=${chunk.pageNumber}` : null,
        chunk.chapterHint != null && chunk.chapterHint !== "" ? `chapter=${chunk.chapterHint}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      return `[S${index + 1}] ${meta}\n${chunk.content.replace(/\s+/g, " ").trim()}`;
    })
    .join("\n\n");

  const characterContext = params.characterChunks
    .map((chunk, index) => {
      const meta = [
        `C${index + 1}`,
        `character=${chunk.characterName}`,
        `file=${chunk.filePath}`,
        chunk.label != null && chunk.label !== "" ? `label=${chunk.label}` : `name=${chunk.originalFileName}`,
        `chunk=${chunk.chunkIndex}`,
        chunk.pageNumber != null ? `page=${chunk.pageNumber}` : null,
        chunk.chapterHint != null && chunk.chapterHint !== "" ? `chapter=${chunk.chapterHint}` : null,
      ]
        .filter(Boolean)
        .join(" ");
      return `[C${index + 1}] ${meta}\n${chunk.content.replace(/\s+/g, " ").trim()}`;
    })
    .join("\n\n");

  return [
    "You are PnPScribe in character-aware mode.",
    "Answer only using the provided context.",
    "Always consider the system rules context together with the character file context.",
    "If the answer is not supported by the provided context, reply exactly:",
    "This information was not found in the uploaded documents.",
    "Do not guess. Do not use outside knowledge.",
    "When citing, use [S1], [S2] for system context and [C1], [C2] for character context.",
    `Question scope: ${params.scopeLabel}`,
    "",
    "Question:",
    params.question,
    "",
    "System context:",
    systemContext || "(none)",
    "",
    "Character context:",
    characterContext || "(none)",
  ].join("\n");
}

function mapCitations(systemChunks: RetrievedSystemChunk[], characterChunks: RetrievedCharacterChunk[]) {
  return [
    ...systemChunks.map((chunk, index) => ({
      kind: "system" as const,
      ref: `S${index + 1}`,
      filePath: chunk.filePath,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      chapterHint: chunk.chapterHint,
      label: null as string | null,
      characterName: null as string | null,
      excerpt: chunk.content.slice(0, 240),
    })),
    ...characterChunks.map((chunk, index) => ({
      kind: "character" as const,
      ref: `C${index + 1}`,
      filePath: chunk.filePath,
      chunkIndex: chunk.chunkIndex,
      pageNumber: chunk.pageNumber,
      chapterHint: chunk.chapterHint,
      label: chunk.label ?? chunk.originalFileName,
      characterName: chunk.characterName,
      excerpt: chunk.content.slice(0, 240),
    })),
  ];
}

export async function answerCharacterQuestion(params: {
  systemId: string;
  characterId: string;
  question: string;
  tier?: ChatModelTier;
}) {
  const vectorLiteral = await embedQuestion(params.question);
  const [system, character, systemChunks, characterChunks] = await Promise.all([
    prisma.system.findUnique({
      where: { id: params.systemId },
      select: { id: true, name: true },
    }),
    prisma.character.findUnique({
      where: { id: params.characterId },
      select: { id: true, name: true },
    }),
    retrieveSystemChunks(params.systemId, vectorLiteral),
    retrieveCharacterChunksForCharacter(params.characterId, vectorLiteral),
  ]);

  if (system == null) {
    throw new HttpError(404, "System not found.");
  }

  if (character == null) {
    throw new HttpError(404, "Character not found.");
  }

  const model = pickChatModel(params.tier);
  const prompt = buildPrompt({
    question: params.question,
    systemChunks,
    characterChunks,
    scopeLabel: `Character: ${character.name}`,
  });

  const response = await openai.responses.create({
    model,
    input: prompt,
    temperature: 0,
    max_output_tokens: 500,
  });

  return {
    system,
    character,
    answer: response.output_text?.trim() || "This information was not found in the uploaded documents.",
    citations: mapCitations(systemChunks, characterChunks),
    retrieval: {
      systemTopK: systemChunks.length,
      characterTopK: characterChunks.length,
    },
    model,
    tier: params.tier ?? "cheap",
  };
}

export async function answerGroupCharacterQuestion(params: {
  systemId: string;
  groupId: string;
  question: string;
  tier?: ChatModelTier;
}) {
  const vectorLiteral = await embedQuestion(params.question);
  const [system, group, systemChunks, characterChunks] = await Promise.all([
    prisma.system.findUnique({
      where: { id: params.systemId },
      select: { id: true, name: true },
    }),
    prisma.group.findUnique({
      where: { id: params.groupId },
      select: { id: true, name: true },
    }),
    retrieveSystemChunks(params.systemId, vectorLiteral),
    retrieveCharacterChunksForGroup(params.groupId, vectorLiteral),
  ]);

  if (system == null) {
    throw new HttpError(404, "System not found.");
  }

  if (group == null) {
    throw new HttpError(404, "Group not found.");
  }

  const model = pickChatModel(params.tier);
  const prompt = buildPrompt({
    question: params.question,
    systemChunks,
    characterChunks,
    scopeLabel: `Group: ${group.name}`,
  });

  const response = await openai.responses.create({
    model,
    input: prompt,
    temperature: 0,
    max_output_tokens: 500,
  });

  return {
    system,
    group,
    answer: response.output_text?.trim() || "This information was not found in the uploaded documents.",
    citations: mapCitations(systemChunks, characterChunks),
    retrieval: {
      systemTopK: systemChunks.length,
      characterTopK: characterChunks.length,
    },
    model,
    tier: params.tier ?? "cheap",
  };
}
