"use client";

import { FormEvent, useState } from "react";

type AskResult = {
  ok: boolean;
  answer?: string;
  citations?: Array<{
    kind: "system" | "character";
    ref: string;
    filePath: string;
    chunkIndex: number;
    pageNumber: number | null;
    chapterHint: string | null;
    label: string | null;
    characterName: string | null;
    excerpt: string;
  }>;
  error?: string;
};

export function CharacterAskPanel({
  characterId,
  title,
  endpoint,
}: {
  characterId: string;
  title: string;
  endpoint: string;
}) {
  const [question, setQuestion] = useState("");
  const [tier, setTier] = useState<"cheap" | "strong">("cheap");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AskResult | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (question.trim() === "") {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(endpoint.replace(":id", characterId), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          question: question.trim(),
          tier,
        }),
      });

      const data = (await response.json()) as AskResult;
      setResult(data);
    } catch {
      setResult({ ok: false, error: "Request failed." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <h3 className="text-xs uppercase tracking-[0.15em] text-zinc-500">{title}</h3>
      <form onSubmit={onSubmit} className="mt-3 flex flex-col gap-2">
        <select
          value={tier}
          onChange={(event) => setTier(event.target.value === "strong" ? "strong" : "cheap")}
          className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        >
          <option value="cheap">cheap</option>
          <option value="strong">strong</option>
        </select>
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          rows={3}
          placeholder="Ask a character-aware question..."
          className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={loading || question.trim() === ""}
          className="h-10 rounded-lg bg-emerald-400 px-3 text-sm font-medium text-zinc-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "Asking..." : "Ask"}
        </button>
      </form>

      {result != null ? (
        <div className="mt-3 space-y-2">
          {typeof result.error === "string" && result.error !== "" ? (
            <p className="text-sm text-rose-300">{result.error}</p>
          ) : null}
          {result.ok && typeof result.answer === "string" && result.answer !== "" ? (
            <div className="rounded border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-100">
              <p className="whitespace-pre-wrap">{result.answer}</p>
            </div>
          ) : null}
          {result.ok && result.citations && result.citations.length > 0 ? (
            <ul className="space-y-2">
              {result.citations.map((citation) => (
                <li key={`${citation.ref}-${citation.filePath}-${citation.chunkIndex}`} className="rounded border border-zinc-800 px-3 py-2 text-xs text-zinc-300">
                  <p className="text-zinc-400">
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] ${
                        citation.kind === "system"
                          ? "bg-sky-950/60 text-sky-300"
                          : "bg-emerald-950/60 text-emerald-300"
                      }`}
                    >
                      {citation.kind}
                    </span>{" "}
                    [{citation.ref}] {citation.filePath} • chunk {citation.chunkIndex}
                    {citation.pageNumber !== null ? ` • page ${citation.pageNumber}` : ""}
                    {citation.characterName !== null ? ` • ${citation.characterName}` : ""}
                    {citation.label !== null ? ` • ${citation.label}` : ""}
                  </p>
                  <p className="mt-1 text-zinc-300">{citation.excerpt}</p>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
