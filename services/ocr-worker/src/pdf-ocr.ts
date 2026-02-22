import { createRequire } from "node:module";

import OpenAI from "openai";

import { config } from "./config.js";

const require = createRequire(import.meta.url);
const openai = new OpenAI({ apiKey: config.openAiApiKey });

type PDFParseCtor = new (options: { data: Buffer | Uint8Array }) => {
  getScreenshot: (params?: {
    imageDataUrl?: boolean;
    imageBuffer?: boolean;
    scale?: number;
    desiredWidth?: number;
  }) => Promise<{ pages?: Array<{ pageNumber: number; dataUrl?: string }> }>;
  destroy?: () => Promise<void>;
};

interface PDFParseStatic extends PDFParseCtor {
  setWorker?: (workerSrc?: string) => string;
}

function getPdfParse() {
  const mod = require("pdf-parse") as { PDFParse?: PDFParseStatic };
  if (typeof mod.PDFParse !== "function") {
    throw new Error("pdf-parse v2 PDFParse export not available.");
  }

  const workerPath = require.resolve("pdfjs-dist/legacy/build/pdf.worker.mjs");
  mod.PDFParse.setWorker?.(workerPath);
  return mod.PDFParse;
}

async function transcribePageImage(dataUrl: string, pageNumber: number) {
  const response = await openai.responses.create({
    model: process.env.OCR_TRANSCRIBE_MODEL ?? "gpt-4.1-mini",
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              `Transcribe the visible text from this RPG PDF page exactly as plain text. ` +
              `Preserve headings and line breaks when obvious. ` +
              `If the page has no readable text, return an empty string.`,
          },
          {
            type: "input_image",
            image_url: dataUrl,
            detail: "auto",
          },
        ],
      },
    ],
    temperature: 0,
    max_output_tokens: 3000,
  });

  return (response.output_text ?? "").trim();
}

interface OcrTranscribeOptions {
  fullRun?: boolean;
  onProgress?: (progress: {
    currentPage: number;
    totalPages: number;
    message: string;
  }) => Promise<void> | void;
}

export async function ocrTranscribePdf(fileBuffer: Buffer, options?: OcrTranscribeOptions) {
  const startedAt = Date.now();
  const PDFParse = getPdfParse();
  const parser = new PDFParse({ data: fileBuffer });

  try {
    const devPageCap =
      process.env.NODE_ENV !== "production" && !options?.fullRun && config.ocrDevPageCap > 0
        ? config.ocrDevPageCap
        : null;

    const screenshots = await parser.getScreenshot({
      imageDataUrl: true,
      desiredWidth: 1400,
      ...(devPageCap ? { first: devPageCap } : {}),
    });

    const pages = Array.isArray(screenshots.pages) ? screenshots.pages : [];
    if (pages.length === 0) {
      throw new Error("Failed to render PDF pages for OCR.");
    }

    const transcribedPages: string[] = [];
    for (let i = 0; i < pages.length; i += 1) {
      const page = pages[i]!;
      const dataUrl = page.dataUrl;
      if (!dataUrl) {
        transcribedPages.push("");
        await options?.onProgress?.({
          currentPage: i + 1,
          totalPages: pages.length,
          message: `Page ${i + 1}/${pages.length}: no render data, skipped`,
        });
        continue;
      }

      const text = await transcribePageImage(dataUrl, page.pageNumber);
      transcribedPages.push(text);

      await options?.onProgress?.({
        currentPage: i + 1,
        totalPages: pages.length,
        message: `Page ${i + 1}/${pages.length} transcribed`,
      });

      // Yield to keep the worker event loop responsive and avoid queue stalls.
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    const text = transcribedPages.join("\f");
    return {
      text,
      pageCount: pages.length,
      pageCapApplied: devPageCap,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await parser.destroy?.().catch(() => undefined);
  }
}
