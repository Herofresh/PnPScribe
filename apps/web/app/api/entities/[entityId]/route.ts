import { NextResponse } from "next/server";

import { getEntityById } from "@/lib/server/entities";
import { HttpError } from "@/lib/server/http-error";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

function parseEntityId(input: unknown) {
  const entityId = typeof input === "string" ? input.trim() : "";
  if (!entityId) {
    throw new HttpError(400, "entityId is required.");
  }

  return entityId;
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ entityId: string }> },
) {
  try {
    const { entityId } = await context.params;
    const parsedEntityId = parseEntityId(entityId);
    const entity = await getEntityById(parsedEntityId);

    return NextResponse.json({ ok: true, entity });
  } catch (error) {
    console.error("GET /api/entities/[entityId] failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to load entity.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
