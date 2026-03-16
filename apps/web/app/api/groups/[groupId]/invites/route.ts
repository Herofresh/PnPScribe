import { NextResponse } from "next/server";

import { requireSessionUser } from "@/lib/server/auth/access";
import { prisma } from "@/lib/prisma";
import { createInviteLink } from "@/lib/server/groups";
import { getErrorMessage, getErrorStatus, HttpError } from "@/lib/server/http-error";

export async function POST(
  _req: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    const user = await requireSessionUser();

    const group = await prisma.group.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        ownerId: true,
      },
    });

    if (group == null || group.ownerId !== user.id) {
      throw new HttpError(404, "Group not found.");
    }

    const invite = await createInviteLink({
      groupId: group.id,
      createdById: user.id,
    });

    return NextResponse.json({ ok: true, invite }, { status: 201 });
  } catch (error) {
    console.error("POST /api/groups/[groupId]/invites failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to create invite link.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
