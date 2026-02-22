import "server-only";
import { createRequire } from "node:module";

type PdfParseClassCtor = new (options: {
  data: Uint8Array | Buffer;
}) => {
  getText: () => Promise<{ text?: string }>;
  destroy?: () => Promise<void>;
};

async function extractWithPdfParseClass(PDFParse: PdfParseClassCtor, buffer: Buffer) {
  const parser = new PDFParse({ data: buffer });

  try {
    const result = await parser.getText();
    return typeof result?.text === "string" ? result.text : "";
  } finally {
    if (typeof parser.destroy === "function") {
      await parser.destroy().catch(() => undefined);
    }
  }
}

export async function extractPdfText(buffer: Buffer) {
  let pdfParseModule: unknown;
  const require = createRequire(import.meta.url);

  try {
    pdfParseModule = require("pdf-parse");
  } catch {
    try {
      pdfParseModule = await import("pdf-parse");
    } catch {
      throw new Error(
        "PDF text extraction unavailable: install 'pdf-parse' in apps/web to enable digital PDF parsing.",
      );
    }
  }

  let text = "";
  if (
    typeof pdfParseModule === "object" &&
    pdfParseModule !== null &&
    "PDFParse" in pdfParseModule &&
    typeof (pdfParseModule as { PDFParse: unknown }).PDFParse === "function"
  ) {
    text = await extractWithPdfParseClass(
      (pdfParseModule as { PDFParse: PdfParseClassCtor }).PDFParse,
      buffer,
    );
  } else {
    throw new Error("Unsupported pdf-parse module shape (expected pdf-parse v2 PDFParse export).");
  }

  return text.replace(/\u0000/g, "").trim();
}
