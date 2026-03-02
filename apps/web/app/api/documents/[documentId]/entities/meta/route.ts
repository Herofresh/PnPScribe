import { NextResponse } from "next/server";
import path from "node:path";

import { prisma } from "@/lib/prisma";
import { parseDocumentId } from "@/lib/server/document-chunks";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";
import { runEntityMetaAnalysis } from "@/lib/server/entity-meta";

export async function POST(
  _req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await context.params;
    const parsedDocumentId = parseDocumentId(documentId);
    console.log("POST /api/documents/[documentId]/entities/meta start", {
      documentId: parsedDocumentId,
    });

    const document = await prisma.document.findUnique({
      where: { id: parsedDocumentId },
      select: { id: true, filePath: true },
    });

    if (!document) {
      return NextResponse.json({ ok: false, error: "Document not found." }, { status: 404 });
    }

    const absolutePdfPath = document.filePath.startsWith("uploads/")
      ? path.resolve(process.cwd(), "..", "..", document.filePath)
      : document.filePath;

    console.log("POST /api/documents/[documentId]/entities/meta resolved path", {
      documentId: document.id,
      absolutePdfPath,
    });

    const result = await runEntityMetaAnalysis({
      documentId: document.id,
      absolutePdfPath,
    });

    console.log("POST /api/documents/[documentId]/entities/meta done", {
      documentId: document.id,
      model: result.model,
    });

    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("POST /api/documents/[documentId]/entities/meta failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to run entity meta analysis.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await context.params;
    const parsedDocumentId = parseDocumentId(documentId);
    console.log("GET /api/documents/[documentId]/entities/meta", {
      documentId: parsedDocumentId,
    });

    const document = await prisma.document.findUnique({
      where: { id: parsedDocumentId },
      select: {
        id: true,
        entityMetaStatus: true,
        entityMetaError: true,
        entityMetaModel: true,
        entityMetaJson: true,
        entityMetaUpdatedAt: true,
      },
    });

    if (!document) {
      return NextResponse.json({ ok: false, error: "Document not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, document });
  } catch (error) {
    console.error("GET /api/documents/[documentId]/entities/meta failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to load entity meta analysis.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
