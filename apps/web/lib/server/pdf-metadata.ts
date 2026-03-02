import "server-only";

import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

import { prisma } from "@/lib/prisma";

const execFileAsync = promisify(execFile);

async function extractOutlineFromPdf(absolutePdfPath: string) {
  const scriptPath = path.resolve(process.cwd(), "scripts", "extract-pdf-outline.mjs");

  const result = await execFileAsync(process.execPath, [scriptPath, absolutePdfPath], {
    cwd: process.cwd(),
    maxBuffer: 10 * 1024 * 1024,
  });

  if (!result.stdout) {
    throw new Error(result.stderr || "PDF outline extraction produced no output.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout);
  } catch {
    throw new Error("PDF outline extraction returned invalid JSON output.");
  }

  const outline =
    typeof parsed === "object" &&
    parsed !== null &&
    "outline" in parsed &&
    Array.isArray((parsed as { outline: unknown }).outline)
      ? ((parsed as { outline: Array<{ title: string; pageNumber: number | null; level: number }> }).outline ?? [])
      : [];

  return outline;
}

export async function refreshDocumentChapters(params: {
  documentId: string;
  absolutePdfPath: string;
}) {
  const outline = await extractOutlineFromPdf(params.absolutePdfPath);
  if (outline.length === 0) {
    return { chapterCount: 0 };
  }

  await prisma.documentChapter.deleteMany({
    where: { documentId: params.documentId },
  });

  const chapters = outline.map((entry, idx) => {
    const next = outline[idx + 1];
    const pageStart = entry.pageNumber ?? null;
    const pageEnd = next?.pageNumber ? Math.max(next.pageNumber - 1, pageStart ?? 1) : null;
    return {
      documentId: params.documentId,
      title: entry.title.slice(0, 200),
      pageStart,
      pageEnd,
      level: entry.level,
    };
  });

  await prisma.documentChapter.createMany({ data: chapters });

  return { chapterCount: chapters.length };
}
