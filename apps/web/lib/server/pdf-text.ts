import "server-only";

function getPdfParseFunction(mod: unknown) {
  if (typeof mod === "function") {
    return mod;
  }

  if (
    typeof mod === "object" &&
    mod !== null &&
    "default" in mod &&
    typeof (mod as { default: unknown }).default === "function"
  ) {
    return (mod as { default: (input: Buffer) => Promise<{ text?: string }> }).default;
  }

  throw new Error("Unsupported pdf-parse module shape.");
}

export async function extractPdfText(buffer: Buffer) {
  let pdfParseModule: unknown;

  try {
    pdfParseModule = await import("pdf-parse");
  } catch {
    throw new Error(
      "PDF text extraction unavailable: install 'pdf-parse' in apps/web to enable digital PDF parsing.",
    );
  }

  const parse = getPdfParseFunction(pdfParseModule);
  const result = await parse(buffer);
  const text = typeof result?.text === "string" ? result.text : "";

  return text.replace(/\u0000/g, "").trim();
}
