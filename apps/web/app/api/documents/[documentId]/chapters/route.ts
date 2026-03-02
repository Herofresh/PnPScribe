import { NextResponse } from "next/server";

import { parseDocumentId } from "@/lib/server/document-chunks";
import { prisma } from "@/lib/prisma";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

export async function GET(
  _req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await context.params;
    const parsedDocumentId = parseDocumentId(documentId);

    const chapters = await prisma.documentChapter.findMany({
      where: { documentId: parsedDocumentId },
      orderBy: { pageStart: "asc" },
    });

    return NextResponse.json({ ok: true, chapters });
  } catch (error) {
    console.error("GET /api/documents/[documentId]/chapters failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to load document chapters.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
