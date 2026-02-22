import { NextResponse } from "next/server";
import { pickChatModel } from "@/lib/ai/model";
import { openai, type ChatModelTier } from "@/lib/openai";

function parseTier(value: string | null): ChatModelTier | undefined | "invalid" {
  if (value === null || value === "") {
    return undefined;
  }

  if (value === "cheap" || value === "strong") {
    return value;
  }

  return "invalid";
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tierParam = url.searchParams.get("tier");
  const parsedTier = parseTier(tierParam);

  if (parsedTier === "invalid") {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid tier. Use 'cheap' or 'strong'.",
      },
      { status: 400 },
    );
  }

  const tier = parsedTier;
  const model = pickChatModel(tier);

  try {
    const res = await openai.responses.create({
      model,
      input: "Reply with exactly: pong",
      max_output_tokens: 16,
      temperature: 0,
    });

    const text = (res.output_text ?? "").trim();

    return NextResponse.json({
      ok: true,
      tier: tier ?? "cheap",
      model,
      text,
    });
  } catch (error) {
    console.error("GET /api/ai/ping failed", error);
    return NextResponse.json(
      {
        ok: false,
        tier: tier ?? "cheap",
        model,
        error: "OpenAI ping failed.",
      },
      { status: 500 },
    );
  }
}
