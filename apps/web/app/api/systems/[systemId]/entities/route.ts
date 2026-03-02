import { NextResponse } from "next/server";

import {
  listEntitiesForSystem,
  parseEntityType,
} from "@/lib/server/entities";
import { parseSystemId } from "@/lib/server/documents";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

export async function GET(
  req: Request,
  context: { params: Promise<{ systemId: string }> },
) {
  try {
    const { systemId } = await context.params;
    const parsedSystemId = parseSystemId(systemId);
    const url = new URL(req.url);

    const type = parseEntityType(url.searchParams.get("type"));
    const documentId = url.searchParams.get("documentId")?.trim() || undefined;
    const q = url.searchParams.get("q")?.trim() || undefined;

    const result = await listEntitiesForSystem({
      systemId: parsedSystemId,
      type,
      documentId,
      q,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("GET /api/systems/[systemId]/entities failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to load entities.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
