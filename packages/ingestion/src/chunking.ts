export type ChunkKind = "generic" | "monster" | "item" | "rules";
export type ChunkGroupKind =
  | "chapter"
  | "monster_section"
  | "item_section"
  | "rules_section"
  | "generic";

export interface TextChunk {
  content: string;
  index: number;
  pageNumber: number | null;
  chapterHint: string | null;
}

export interface ChunkGroupPlan {
  groupIndex: number;
  kind: ChunkGroupKind;
  title: string | null;
  chapterHint: string | null;
  startChunkIndex: number;
  endChunkIndex: number;
  startPage: number | null;
  endPage: number | null;
}

export interface ClassifiedChunk extends TextChunk {
  kind: ChunkKind;
  labels: Record<string, unknown> | null;
  groupIndex: number;
}

export interface ChapterMeta {
  title: string;
  pageStart: number | null;
  pageEnd: number | null;
}

const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 200;
const DEFAULT_MIN_CHUNK_SIZE = 300;

export function chunkText(
  text: string,
  options?: { chunkSize?: number; overlap?: number; minChunkSize?: number },
): TextChunk[] {
  const chunkSize = options?.chunkSize ?? DEFAULT_CHUNK_SIZE;
  const overlap = options?.overlap ?? DEFAULT_CHUNK_OVERLAP;
  const minChunkSize = Math.min(
    Math.max(options?.minChunkSize ?? DEFAULT_MIN_CHUNK_SIZE, 1),
    chunkSize,
  );

  if (chunkSize <= 0) {
    return [];
  }

  const normalized = text.replace(/\r\n/g, "\n").replace(/\t/g, " ").trim();
  if (!normalized) {
    return [];
  }

  const chunks: TextChunk[] = [];
  const pages = normalized.split("\f");
  let index = 0;
  const step = Math.max(1, chunkSize - Math.max(0, overlap));

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pageText = pages[pageIndex]?.trim();
    if (!pageText) {
      continue;
    }

    let start = 0;

    while (start < pageText.length) {
      const roughEnd = Math.min(pageText.length, start + chunkSize);
      const end = chooseChunkEnd(pageText, start, roughEnd, chunkSize, minChunkSize);

      const content = pageText.slice(start, end).trim();
      if (content) {
        const chunk: TextChunk = {
          content,
          index,
          pageNumber: pages.length > 1 ? pageIndex + 1 : null,
          chapterHint: findChapterHint(content),
        };

        const previous = chunks[chunks.length - 1];
        const shouldMergeTinyTail =
          previous !== undefined &&
          previous.pageNumber === chunk.pageNumber &&
          content.length < minChunkSize &&
          previous.content.length + 2 + content.length <= chunkSize + Math.floor(overlap / 2);

        if (shouldMergeTinyTail) {
          previous.content = `${previous.content}\n\n${content}`;
          if (!previous.chapterHint && chunk.chapterHint) {
            previous.chapterHint = chunk.chapterHint;
          }
        } else {
          chunks.push(chunk);
          index += 1;
        }
      }

      if (end >= pageText.length) {
        break;
      }

      const nextStartCandidate = Math.max(start + 1, end - overlap);
      start = nextStartCandidate <= start ? start + step : nextStartCandidate;
    }
  }

  return chunks;
}

export function classifyChunksAndBuildGroups(
  chunks: TextChunk[],
  chapters?: ChapterMeta[],
): {
  groups: ChunkGroupPlan[];
  chunks: ClassifiedChunk[];
} {
  if (chunks.length === 0) {
    return { groups: [], chunks: [] };
  }

  const groups: ChunkGroupPlan[] = [];
  const classified: ClassifiedChunk[] = [];

  const chapterByPage = buildChapterLookup(chapters ?? []);
  const firstChapter = findChapterForChunk(chunks[0]!, chapterByPage);

  let currentGroupKind: ChunkGroupKind = inferGroupKind(chunks[0]!);
  let currentTitle = pickTitle(chunks[0]!);
  let currentChapterHint = firstChapter?.title ?? chunks[0]!.chapterHint;
  let currentChapterTitle = firstChapter?.title ?? null;
  let groupStart = 0;
  let groupIndex = 0;

  for (let i = 0; i < chunks.length; i += 1) {
    const chunk = chunks[i]!;
    const chapter = findChapterForChunk(chunk, chapterByPage);
    const chapterTitle = chapter?.title ?? null;
    const inferredKind = inferGroupKind(chunk);
    const looksLikeBoundary =
      i > 0 &&
      (chunk.chapterHint !== null ||
        inferredKind !== currentGroupKind ||
        chunkStartsHeading(chunk) ||
        chapterTitle !== currentChapterTitle);

    if (looksLikeBoundary) {
      const previousChunk = chunks[i - 1]!;
      groups.push({
        groupIndex,
        kind: currentGroupKind,
        title: currentTitle,
        chapterHint: currentChapterHint,
        startChunkIndex: chunks[groupStart]!.index,
        endChunkIndex: previousChunk.index,
        startPage: chunks[groupStart]!.pageNumber,
        endPage: previousChunk.pageNumber,
      });
      groupIndex += 1;
      groupStart = i;
      currentGroupKind = inferredKind;
      currentTitle = pickTitle(chunk);
      currentChapterHint = chapterTitle ?? chunk.chapterHint;
      currentChapterTitle = chapterTitle;
    }

    classified.push({
      ...chunk,
      kind: mapGroupKindToChunkKind(inferredKind),
      labels: buildChunkLabels(chunk, inferredKind, chapterTitle),
      groupIndex,
    });
  }

  const tail = chunks[chunks.length - 1]!;
  groups.push({
    groupIndex,
    kind: currentGroupKind,
    title: currentTitle,
    chapterHint: currentChapterHint,
    startChunkIndex: chunks[groupStart]!.index,
    endChunkIndex: tail.index,
    startPage: chunks[groupStart]!.pageNumber,
    endPage: tail.pageNumber,
  });

  return { groups, chunks: classified };
}

function chooseChunkEnd(
  text: string,
  start: number,
  roughEnd: number,
  chunkSize: number,
  minChunkSize: number,
) {
  if (roughEnd >= text.length) {
    return text.length;
  }

  const window = text.slice(start, roughEnd);
  const minBreakOffset = Math.min(window.length - 1, Math.floor(chunkSize * 0.55));

  const preferredOffsets = [
    window.lastIndexOf("\n\n"),
    window.lastIndexOf("\n"),
    window.lastIndexOf(". "),
    window.lastIndexOf("! "),
    window.lastIndexOf("? "),
    window.lastIndexOf("; "),
    window.lastIndexOf(": "),
    window.lastIndexOf(", "),
    window.lastIndexOf(" "),
  ];

  for (const offset of preferredOffsets) {
    if (offset >= minBreakOffset) {
      const end = start + offset + 1;
      if (end - start >= Math.min(minChunkSize, window.length)) {
        return end;
      }
    }
  }

  return roughEnd;
}

function findChapterHint(content: string) {
  const lines = content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 6);

  for (const line of lines) {
    if (/^(chapter|section|part)\b/i.test(line)) {
      return line.slice(0, 140);
    }

    if (/^[A-Z][A-Z0-9\s:,-]{4,80}$/.test(line)) {
      return line.slice(0, 140);
    }
  }

  return null;
}

function chunkStartsHeading(chunk: TextChunk) {
  const head = chunk.content.slice(0, 120).trim();
  return /^(chapter|section|part)\b/i.test(head) || /^[A-Z][A-Z\s0-9:'-]{6,90}$/.test(head);
}

function inferGroupKind(chunk: TextChunk): ChunkGroupKind {
  const text = chunk.content;

  if (chunkLooksMonster(text)) {
    return "monster_section";
  }

  if (chunkLooksItem(text)) {
    return "item_section";
  }

  if (chunkLooksRules(text)) {
    return "rules_section";
  }

  if (chunk.chapterHint) {
    return "chapter";
  }

  return "generic";
}

function chunkLooksMonster(text: string) {
  const checks = [
    /\b(armor class|ac)\b/i.test(text),
    /\bhit points?\b/i.test(text),
    /\b(speed|initiative)\b/i.test(text),
    /\b(level|challenge|cr\s*\d+)\b/i.test(text),
    /\b(melee|ranged|attack)\b/i.test(text),
  ];
  return checks.filter(Boolean).length >= 3;
}

function chunkLooksItem(text: string) {
  const checks = [
    /\b(price|cost|gp|sp|cp)\b/i.test(text),
    /\b(bulk|weight|rarity|item\s+level)\b/i.test(text),
    /\b(usage|activate|effect|consumable)\b/i.test(text),
    /\b(weapon|armor|wondrous|potion|scroll|rune)\b/i.test(text),
  ];
  return checks.filter(Boolean).length >= 2;
}

function chunkLooksRules(text: string) {
  return /(create|build|modify|customi[sz]e|adjust|template|variant)/i.test(text);
}

function mapGroupKindToChunkKind(kind: ChunkGroupKind): ChunkKind {
  if (kind === "monster_section") {
    return "monster";
  }
  if (kind === "item_section") {
    return "item";
  }
  if (kind === "rules_section") {
    return "rules";
  }
  return "generic";
}

function pickTitle(chunk: TextChunk): string | null {
  const line = chunk.content
    .split("\n")
    .map((item) => item.trim())
    .find(Boolean);

  return line ? line.slice(0, 140) : null;
}

function buildChunkLabels(
  chunk: TextChunk,
  kind: ChunkGroupKind,
  chapterTitle: string | null,
): Record<string, unknown> {
  return {
    inferredKind: kind,
    hasChapterHint: Boolean(chunk.chapterHint),
    chapterTitle,
    textLength: chunk.content.length,
  };
}

function buildChapterLookup(chapters: ChapterMeta[]) {
  const normalized = chapters
    .map((entry) => ({
      title: entry.title,
      pageStart: entry.pageStart ?? null,
      pageEnd: entry.pageEnd ?? null,
    }))
    .filter((entry) => entry.title && entry.pageStart !== null)
    .sort((a, b) => (a.pageStart ?? 0) - (b.pageStart ?? 0));

  return normalized;
}

function findChapterForChunk(chunk: TextChunk, chapters: ChapterMeta[]) {
  if (chapters.length === 0 || chunk.pageNumber === null) {
    return null;
  }

  for (let i = chapters.length - 1; i >= 0; i -= 1) {
    const entry = chapters[i]!;
    if (entry.pageStart !== null && chunk.pageNumber >= entry.pageStart) {
      if (entry.pageEnd === null || chunk.pageNumber <= entry.pageEnd) {
        return entry;
      }
    }
  }

  return null;
}
