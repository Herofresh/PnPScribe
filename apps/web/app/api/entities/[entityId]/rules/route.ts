import { NextResponse } from "next/server";

import { getEntityRuleLinks } from "@/lib/server/entities";
import { getErrorMessage, getErrorStatus, HttpError } from "@/lib/server/http-error";

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
    const result = await getEntityRuleLinks(parsedEntityId);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("GET /api/entities/[entityId]/rules failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to load entity rules.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
