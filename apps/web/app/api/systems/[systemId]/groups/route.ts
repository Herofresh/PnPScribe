import { NextResponse } from "next/server";

import { requireOwnedSystem } from "@/lib/server/auth/access";
import { createGroup, parseGroupDescription, parseGroupName } from "@/lib/server/groups";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

export async function POST(
  req: Request,
  context: { params: Promise<{ systemId: string }> },
) {
  try {
    const { systemId } = await context.params;
    const { user, system } = await requireOwnedSystem(systemId);
    const body = (await req.json()) as {
      name?: unknown;
      description?: unknown;
    };

    const group = await createGroup({
      systemId: system.id,
      ownerId: user.id,
      name: parseGroupName(body.name),
      description: parseGroupDescription(body.description),
    });

    return NextResponse.json({ ok: true, group }, { status: 201 });
  } catch (error) {
    console.error("POST /api/systems/[systemId]/groups failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to create group.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
