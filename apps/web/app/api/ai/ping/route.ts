import { NextResponse } from "next/server";
import { parseChatModelTier, runAiPing } from "@/lib/server/ai-ping";
import { getErrorMessage, getErrorStatus } from "@/lib/server/http-error";

export async function GET(req: Request) {
  const url = new URL(req.url);

  try {
    const tier = parseChatModelTier(url.searchParams.get("tier"));
    const result = await runAiPing(tier);
    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    console.error("GET /api/ai/ping failed", error);
    return NextResponse.json(
      { ok: false, error: getErrorMessage(error, "OpenAI ping failed.") },
      { status: getErrorStatus(error, 500) },
    );
  }
}
