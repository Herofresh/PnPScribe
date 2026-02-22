import { NextResponse } from "next/server";

import {
  listChunksForDocument,
  parseDocumentId,
} from "@/lib/server/document-chunks";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

export async function GET(
  _req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await context.params;
    const parsedDocumentId = parseDocumentId(documentId);
    const result = await listChunksForDocument(parsedDocumentId);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("GET /api/documents/[documentId]/chunks failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to load document chunks.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
