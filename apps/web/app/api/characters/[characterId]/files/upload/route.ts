import { NextResponse } from "next/server";

import { requireCharacterAccess } from "@/lib/server/auth/access";
import { uploadCharacterFileFromFormData } from "@/lib/server/character-files";
import { getErrorMessage, getErrorStatus, HttpError } from "@/lib/server/http-error";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  context: { params: Promise<{ characterId: string }> },
) {
  try {
    const { characterId } = await context.params;
    const access = await requireCharacterAccess(characterId);
    if (!access.isCharacterOwner && !access.isGroupOwner) {
      throw new HttpError(403, "Only the character owner or GM can upload files.");
    }
    const formData = await req.formData();
    formData.set("characterId", characterId);
    const result = await uploadCharacterFileFromFormData(formData, access.user.id);

    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    console.error("POST /api/characters/[characterId]/files/upload failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Character file upload failed.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
