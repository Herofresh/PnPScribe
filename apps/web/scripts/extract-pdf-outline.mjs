import fs from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    throw new Error("Usage: node extract-pdf-outline.mjs <pdf-path>");
  }

  const pdfjs = require("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs?.getDocument) {
    throw new Error("pdfjs-dist legacy build not available.");
  }

  if (!(pdfjs.GlobalWorkerOptions.workerSrc ?? "")) {
    pdfjs.GlobalWorkerOptions.workerSrc = require.resolve(
      "pdfjs-dist/legacy/build/pdf.worker.mjs",
    );
  }

  const buffer = await fs.readFile(filePath);
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  try {
    const outline = await pdf.getOutline();
    if (!outline || !Array.isArray(outline)) {
      process.stdout.write(JSON.stringify({ outline: [] }));
      return;
    }

    const results = [];

    async function walk(nodes, level) {
      for (const node of nodes) {
        const title = typeof node.title === "string" ? node.title.trim() : "";
        let pageNumber = null;

        if (node.dest) {
          const dest = await pdf.getDestination(node.dest).catch(() => null);
          if (dest) {
            const [ref] = dest;
            const pageIndex = await pdf.getPageIndex(ref).catch(() => null);
            if (typeof pageIndex === "number") {
              pageNumber = pageIndex + 1;
            }
          }
        }

        if (title) {
          results.push({ title, pageNumber, level });
        }

        if (Array.isArray(node.items) && node.items.length > 0) {
          await walk(node.items, level + 1);
        }
      }
    }

    await walk(outline, 0);
    process.stdout.write(JSON.stringify({ outline: results }));
  } finally {
    await pdf.destroy();
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(message);
  process.exit(1);
});
