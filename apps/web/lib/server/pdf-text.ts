import "server-only";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function extractPdfText(filePath: string) {
  const scriptPath = path.resolve(process.cwd(), "scripts", "extract-pdf-text.mjs");

  let stdout = "";
  let stderr = "";

  try {
    const result = await execFileAsync(process.execPath, [scriptPath, filePath], {
      cwd: process.cwd(),
      maxBuffer: 50 * 1024 * 1024,
    });
    stdout = result.stdout;
    stderr = result.stderr;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "PDF text extraction child process failed.";
    throw new Error(message);
  }

  if (!stdout) {
    throw new Error(stderr || "PDF text extraction produced no output.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error("PDF text extraction returned invalid JSON output.");
  }

  const text =
    typeof parsed === "object" &&
    parsed !== null &&
    "text" in parsed &&
    typeof (parsed as { text: unknown }).text === "string"
      ? (parsed as { text: string }).text
      : "";

  return text.replace(/\u0000/g, "").trim();
}
