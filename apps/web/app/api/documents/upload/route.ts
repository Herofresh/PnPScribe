import { NextResponse } from "next/server";
import { requireOwnedSystem } from "@/lib/server/auth/access";
import { uploadDocumentFromFormData } from "@/lib/server/documents-upload";
import {
  getErrorMessage,
  getErrorStatus,
  HttpError,
} from "@/lib/server/http-error";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const systemId = formData.get("systemId");
    if (typeof systemId !== "string" || !systemId.trim()) {
      throw new HttpError(400, "systemId is required.");
    }
    await requireOwnedSystem(systemId.trim());
    const result = await uploadDocumentFromFormData(formData);

    return NextResponse.json(
      {
        ok: true,
        ...result,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("POST /api/documents/upload failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "Document upload failed.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
