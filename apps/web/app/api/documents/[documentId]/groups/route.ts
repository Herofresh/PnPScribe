import { NextResponse } from "next/server";

import { parseDocumentId } from "@/lib/server/document-chunks";
import { listGroupsForDocument } from "@/lib/server/document-groups";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

export async function GET(
  _req: Request,
  context: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await context.params;
    const parsedDocumentId = parseDocumentId(documentId);
    const result = await listGroupsForDocument(parsedDocumentId);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("GET /api/documents/[documentId]/groups failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to load document groups.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
