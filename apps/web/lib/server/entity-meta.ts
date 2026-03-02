import "server-only";

import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import { MODELS, openai } from "@/lib/openai";

const MAX_PDF_BYTES = 100 * 1024 * 1024;

function buildMetaPrompt(systemName: string | null) {
  const systemLabel = systemName ? `System name: ${systemName}` : "System name: unknown";
  return [
    "You are analyzing an RPG rulebook PDF to identify the kinds of entities it contains.",
    "Return strict JSON only (no markdown).",
    "Schema:",
    "{",
    "  \"entity_types\": [",
    "    {",
    "      \"name\": string,",
    "      \"aliases\": string[],",
    "      \"signals\": string[],",
    "      \"example_sections\": string[],",
    "      \"confidence\": number",
    "    }",
    "  ],",
    "  \"notes\": string[]",
    "}",
    "Rules:",
    "- Identify 3-10 entity types that appear or are strongly implied.",
    "- Use names a GM would recognize (e.g., Enemy, Creature, Spell, Power, Feat, Item).",
    "- If a common RPG category is missing, do NOT include it unless evidence exists.",
    "- Use concise aliases and section signals (header words, formatting cues, table titles).",
    systemLabel,
  ].join("\n");
}

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function runEntityMetaAnalysis(params: {
  documentId: string;
  absolutePdfPath: string;
}) {
  console.log("[entity-meta] start", {
    documentId: params.documentId,
    absolutePdfPath: params.absolutePdfPath,
  });

  const document = await prisma.document.findUnique({
    where: { id: params.documentId },
    select: { id: true, systemId: true, system: { select: { name: true } } },
  });

  if (!document) {
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
    const stat = await fs.stat(params.absolutePdfPath);
    if (stat.size > MAX_PDF_BYTES) {
      throw new Error("PDF too large for meta analysis (max 100MB). Use a smaller file.");
    }

    console.log("[entity-meta] file stats", {
      documentId: document.id,
      bytes: stat.size,
    });

    const model = process.env.ENTITY_META_MODEL ?? MODELS.cheap;
    const filename = path.basename(params.absolutePdfPath);
    const prompt = buildMetaPrompt(document.system?.name ?? null);

    console.log("[entity-meta] uploading file", {
      documentId: document.id,
      filename,
    });

    const upload = await openai.files.create({
      file: createReadStream(params.absolutePdfPath),
      purpose: "user_data",
    });

    console.log("[entity-meta] file uploaded", {
      documentId: document.id,
      fileId: upload.id,
      bytes: upload.bytes,
    });

    console.log("[entity-meta] requesting model", {
      documentId: document.id,
      model,
      filename,
    });

    const response = await openai.responses.create({
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            {
              type: "input_file",
              file_id: upload.id,
            },
          ],
        },
      ],
      temperature: 0,
      max_output_tokens: 900,
    });

    const output = response.output_text?.trim() ?? "";
    const parsed = output ? parseJson(output) : null;
    const storedJson = parsed ?? { parseError: true, raw: output };

    await prisma.document.update({
      where: { id: document.id },
      data: {
        entityMetaStatus: "completed",
        entityMetaError: parsed ? null : "Failed to parse JSON response.",
        entityMetaModel: model,
        entityMetaJson: storedJson,
        entityMetaUpdatedAt: new Date(),
      },
    });

    console.log("[entity-meta] completed", {
      documentId: document.id,
      model,
      parsed: Boolean(parsed),
      outputChars: output.length,
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
