import { NextResponse } from "next/server";

import { requireCharacterFileAccess } from "@/lib/server/auth/access";
import { unlistCharacterFile } from "@/lib/server/character-files";
import { getErrorMessage, getErrorStatus, HttpError } from "@/lib/server/http-error";

export async function POST(
  _req: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  try {
    const { fileId } = await context.params;
    const access = await requireCharacterFileAccess(fileId);

    if (!access.isCharacterOwner && !access.isGroupOwner) {
      throw new HttpError(403, "Only the character owner or GM can unlist this file.");
    }

    const file = await unlistCharacterFile(fileId);
    return NextResponse.json({ ok: true, file });
  } catch (error) {
    console.error("POST /api/character-files/[fileId]/unlist failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to unlist character file.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
