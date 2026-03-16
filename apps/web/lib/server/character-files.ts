import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Prisma } from "@prisma/client";

import { MODELS, openai } from "@/lib/openai";
import { prisma } from "@/lib/prisma";
import { chunkText } from "@/lib/server/text-chunking";
import { extractPdfText } from "@/lib/server/pdf-text";
import { HttpError } from "@/lib/server/http-error";

function sanitizeFilename(name: string) {
  const normalized = name.trim().replace(/\s+/g, "-").toLowerCase();
  const safe = normalized.replace(/[^a-z0-9._-]/g, "");
  return safe || "upload.pdf";
}

function isPdf(file: File) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function toVectorLiteral(values: number[]) {
  return `[${values.join(",")}]`;
}

async function replaceChunksForCharacterFile(characterFileId: string, text: string) {
  const chunks = chunkText(text);

  await prisma.$transaction(async (tx) => {
    await tx.characterChunk.deleteMany({
      where: { characterFileId },
    });

    if (chunks.length === 0) {
      return;
    }

    await tx.characterChunk.createMany({
      data: chunks.map((chunk) => ({
        characterFileId,
        content: chunk.content,
        chunkIndex: chunk.index,
        pageNumber: chunk.pageNumber,
        chapterHint: chunk.chapterHint,
      })),
    });
  });

  return { chunkCount: chunks.length };
}

async function embedCharacterChunks(characterFileId: string) {
  const rows = await prisma.$queryRaw<Array<{ id: string; content: string }>>(
    Prisma.sql`
      SELECT "id", "content"
      FROM "CharacterChunk"
      WHERE "characterFileId" = ${characterFileId}
        AND "embedding" IS NULL
      ORDER BY "chunkIndex" ASC
    `,
  );

  if (rows.length === 0) {
    return { embeddedCount: 0 };
  }

  const batchSize = 32;
  let embeddedCount = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const response = await openai.embeddings.create({
      model: MODELS.embed,
      input: batch.map((row) => row.content),
    });

    for (let j = 0; j < batch.length; j += 1) {
      const vector = response.data[j]?.embedding;
      if (!Array.isArray(vector) || vector.length === 0) {
        throw new Error(`Missing embedding vector for character chunk ${batch[j]?.id ?? "unknown"}.`);
      }

      await prisma.$executeRaw(
        Prisma.sql`
          UPDATE "CharacterChunk"
          SET "embedding" = CAST(${toVectorLiteral(vector)} AS vector)
          WHERE "id" = ${batch[j]!.id}
        `,
      );
      embeddedCount += 1;
    }
  }

  return { embeddedCount };
}

export async function uploadCharacterFileFromFormData(formData: FormData, uploadedById: string) {
  const rawCharacterId = formData.get("characterId");
  const characterId = typeof rawCharacterId === "string" ? rawCharacterId.trim() : "";
  const rawLabel = formData.get("label");
  const label = typeof rawLabel === "string" ? rawLabel.trim().slice(0, 120) : "";
  const rawReplaceFileId = formData.get("replaceFileId");
  const replaceFileId = typeof rawReplaceFileId === "string" ? rawReplaceFileId.trim() : "";
  const fileValue = formData.get("file");

  if (characterId === "") {
    throw new HttpError(400, "characterId is required.");
  }

  if (!(fileValue instanceof File)) {
    throw new HttpError(400, "file is required.");
  }

  if (!isPdf(fileValue)) {
    throw new HttpError(400, "Only PDF uploads are supported.");
  }

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: {
      id: true,
      groupId: true,
      ownerUserId: true,
      group: {
        select: {
          systemId: true,
          ownerId: true,
          memberships: {
            where: { userId: uploadedById },
            select: { id: true },
            take: 1,
          },
        },
      },
    },
  });

  const canUpload =
    character != null &&
    (character.ownerUserId === uploadedById || character.group.ownerId === uploadedById);

  if (!canUpload || character == null) {
    throw new HttpError(404, "Character not found.");
  }

  const uploadsRoot = path.resolve(process.cwd(), "..", "..", "uploads");
  const characterDir = path.join(uploadsRoot, "characters", character.id);
  await mkdir(characterDir, { recursive: true });

  const safeName = sanitizeFilename(fileValue.name);
  const storedName = `${Date.now()}-${randomUUID()}-${safeName}`;
  const absolutePath = path.join(characterDir, storedName);
  const relativePath = path.posix.join("uploads", "characters", character.id, storedName);

  const buffer = Buffer.from(await fileValue.arrayBuffer());
  await writeFile(absolutePath, buffer);

  const created = await prisma.characterFile.create({
    data: {
      characterId: character.id,
      uploadedById,
      label: label === "" ? null : label,
      originalFileName: fileValue.name,
      filePath: relativePath,
      extractionStatus: "pending",
    },
    select: {
      id: true,
      characterId: true,
      label: true,
      originalFileName: true,
      filePath: true,
      extractionStatus: true,
      extractionError: true,
      isListed: true,
      createdAt: true,
    },
  });

  let extractedTextLength: number | null = null;
  let extractedPageCount: number | null = null;
  let extractionDurationMs: number | null = null;
  let extractionStatus = created.extractionStatus;
  let extractionError = created.extractionError;
  let embeddedCount = 0;
  let chunkCount = 0;

  try {
    const extraction = await extractPdfText(absolutePath);
    const extractedText = extraction.text;

    if (extractedText === "") {
      throw new Error("No extractable digital text found in PDF.");
    }

    const updated = await prisma.characterFile.update({
      where: { id: created.id },
      data: {
        extractedText,
        extractedTextLength: extractedText.length,
        extractedPageCount: extraction.pageCount,
        extractionDurationMs: extraction.durationMs,
        extractionStatus: "succeeded",
        extractionError: null,
        extractedAt: new Date(),
      },
      select: {
        extractedTextLength: true,
        extractedPageCount: true,
        extractionDurationMs: true,
        extractionStatus: true,
        extractionError: true,
      },
    });

    extractedTextLength = updated.extractedTextLength;
    extractedPageCount = updated.extractedPageCount;
    extractionDurationMs = updated.extractionDurationMs;
    extractionStatus = updated.extractionStatus;
    extractionError = updated.extractionError;

    const chunkResult = await replaceChunksForCharacterFile(created.id, extractedText);
    chunkCount = chunkResult.chunkCount;

    if (chunkCount > 0) {
      const embeddingResult = await embedCharacterChunks(created.id);
      embeddedCount = embeddingResult.embeddedCount;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Character file extraction failed.";
    const failed = await prisma.characterFile.update({
      where: { id: created.id },
      data: {
        extractionStatus: "failed",
        extractionError: message.slice(0, 500),
        extractionDurationMs: null,
        extractedAt: null,
      },
      select: {
        extractionStatus: true,
        extractionError: true,
      },
    });

    extractionStatus = failed.extractionStatus;
    extractionError = failed.extractionError;
  }

  if (replaceFileId !== "" && replaceFileId !== created.id) {
    await prisma.characterFile.updateMany({
      where: {
        id: replaceFileId,
        characterId: character.id,
      },
      data: {
        isListed: false,
        replacedById: created.id,
      },
    });
  }

  return {
    file: {
      ...created,
      extractedTextLength,
      extractedPageCount,
      extractionDurationMs,
      extractionStatus,
      extractionError,
    },
    processing: {
      chunkCount,
      embeddedCount,
    },
    systemId: character.group.systemId,
  };
}

export async function unlistCharacterFile(characterFileId: string) {
  return prisma.characterFile.update({
    where: { id: characterFileId },
    data: {
      isListed: false,
    },
    select: {
      id: true,
      isListed: true,
      replacedById: true,
    },
  });
}
