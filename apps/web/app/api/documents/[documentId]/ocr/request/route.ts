import { NextResponse } from "next/server";

import { parseDocumentId } from "@/lib/server/document-chunks";
import { enqueueOcrDocumentJob } from "@/lib/server/ocr-queue";
import { prisma } from "@/lib/prisma";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

export async function POST(
  req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await context.params;
    const parsedDocumentId = parseDocumentId(documentId);
    let body: { mode?: unknown; fullRun?: unknown } = {};
    try {
      body = (await req.json()) as { mode?: unknown; fullRun?: unknown };
    } catch {
      body = {};
    }

    const mode = body.mode === "supplement" ? "supplement" : "replace";
    const fullRun = body.fullRun === true;

    const document = await prisma.document.update({
      where: { id: parsedDocumentId },
      data: {
        ocrStatus: "queued",
        ocrMode: mode,
        ocrRequestedAt: new Date(),
        ocrCompletedAt: null,
        ocrProgressCurrentPage: null,
        ocrProgressTotalPages: null,
        ocrProgressMessage: "Queued",
        ocrProgressUpdatedAt: new Date(),
        ocrError: null,
      },
      select: {
        id: true,
        ocrStatus: true,
        ocrMode: true,
        ocrReason: true,
        ocrRequestedAt: true,
      },
    });

    const job = await enqueueOcrDocumentJob({
      documentId: parsedDocumentId,
      requestedAt: new Date().toISOString(),
      mode,
      fullRun,
    });

    return NextResponse.json({
      ok: true,
      queued: true,
      provider: "bullmq",
      document,
      job,
    });
  } catch (error) {
    console.error("POST /api/documents/[documentId]/ocr/request failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to request OCR fallback.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
