import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { requireOwnedEntity } from "@/lib/server/auth/access";
import { getEntityImage } from "@/lib/server/entities";
import { getErrorMessage, getErrorStatus, HttpError } from "@/lib/server/http-error";

function parseId(input: unknown, label: string) {
  const value = typeof input === "string" ? input.trim() : "";
  if (value === "") {
    throw new HttpError(400, `${label} is required.`);
  }
  return value;
}

function guessContentType(filePath: string) {
  if (filePath.endsWith(".png")) {
    return "image/png";
  }
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (filePath.endsWith(".webp")) {
    return "image/webp";
  }
  return "application/octet-stream";
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ entityId: string; imageId: string }> },
) {
  try {
    const { entityId, imageId } = await context.params;
    const parsedEntityId = parseId(entityId, "entityId");
    const parsedImageId = parseId(imageId, "imageId");

    await requireOwnedEntity(parsedEntityId);
    const image = await getEntityImage(parsedEntityId, parsedImageId);
    const absolutePath = image.filePath.startsWith("uploads/")
      ? path.resolve(process.cwd(), "..", "..", image.filePath)
      : image.filePath;
    const buffer = await readFile(absolutePath);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "content-type": guessContentType(image.filePath),
        "cache-control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Failed to load entity image.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
