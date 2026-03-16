import { NextResponse } from "next/server";

import { parseChatModelTier } from "@/lib/server/ai-ping";
import { requireGroupAccess } from "@/lib/server/auth/access";
import { answerGroupCharacterQuestion, parseCharacterQuestion } from "@/lib/server/character-query";
import { getErrorMessage, getErrorStatus, HttpError } from "@/lib/server/http-error";

export async function POST(
  req: Request,
  context: { params: Promise<{ groupId: string }> },
) {
  try {
    const { groupId } = await context.params;
    const access = await requireGroupAccess(groupId);
    if (!access.isOwner) {
      throw new HttpError(403, "Only the GM can ask group character context questions.");
    }
    const body = (await req.json()) as { question?: unknown; tier?: unknown };
    const question = parseCharacterQuestion(body.question);
    const tier =
      typeof body.tier === "string" ? parseChatModelTier(body.tier) : undefined;

    const result = await answerGroupCharacterQuestion({
      systemId: access.group.systemId,
      groupId,
      question,
      tier,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("POST /api/groups/[groupId]/ask-characters failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Group character query failed.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
