import "server-only";

import { pickChatModel } from "@/lib/ai/model";
import { openai, type ChatModelTier } from "@/lib/openai";
import { HttpError } from "@/lib/server/http-error";

export function parseChatModelTier(value: string | null): ChatModelTier | undefined {
  if (value === null || value === "") {
    return undefined;
  }

  if (value === "cheap" || value === "strong") {
    return value;
  }

  throw new HttpError(400, "Invalid tier. Use 'cheap' or 'strong'.");
}

export async function runAiPing(tier: ChatModelTier | undefined) {
  const model = pickChatModel(tier);
  const res = await openai.responses.create({
    model,
    input: "Reply with exactly: pong",
    max_output_tokens: 16,
    temperature: 0,
  });

  return {
    tier: tier ?? "cheap",
    model,
    text: (res.output_text ?? "").trim(),
  };
}
