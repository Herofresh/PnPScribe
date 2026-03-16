import { NextResponse } from "next/server";

import { parseChatModelTier } from "@/lib/server/ai-ping";
import { requireCharacterAccess } from "@/lib/server/auth/access";
import { answerCharacterQuestion, parseCharacterQuestion } from "@/lib/server/character-query";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

export async function POST(
  req: Request,
  context: { params: Promise<{ characterId: string }> },
) {
  try {
    const { characterId } = await context.params;
    const access = await requireCharacterAccess(characterId);
    const body = (await req.json()) as { question?: unknown; tier?: unknown };
    const question = parseCharacterQuestion(body.question);
    const tier =
      typeof body.tier === "string" ? parseChatModelTier(body.tier) : undefined;

    const result = await answerCharacterQuestion({
      systemId: access.character.group.systemId,
      characterId,
      question,
      tier,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("POST /api/characters/[characterId]/ask failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Character query failed.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
