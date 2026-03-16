import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireGroupAccess } from "@/lib/server/auth/access";
import { getErrorMessage, getErrorStatus, HttpError } from "@/lib/server/http-error";

export async function POST(
  req: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    const { user, group, isOwner, isMember } = await requireGroupAccess(groupId);
    const body = (await req.json()) as { name?: unknown; description?: unknown };
    const name = typeof body.name === "string" ? body.name.trim().slice(0, 120) : "";
    const description = typeof body.description === "string" ? body.description.trim().slice(0, 500) : "";

    if (name === "") {
      throw new HttpError(400, "Character name is required.");
    }

    if (!isOwner && !isMember) {
      throw new HttpError(403, "Not allowed to create characters in this group.");
    }

    const character = await prisma.character.create({
      data: {
        groupId: group.id,
        ownerUserId: user.id,
        name,
        description: description === "" ? null : description,
      },
      select: {
        id: true,
        name: true,
        description: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ ok: true, character }, { status: 201 });
  } catch (error) {
    console.error("POST /api/groups/[groupId]/characters failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to create character.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
