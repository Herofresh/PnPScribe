"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type CharacterFileSummary = {
  id: string;
  label: string | null;
  originalFileName: string;
  createdAt: string;
  extractionStatus: string;
  extractedTextLength: number | null;
};

type UploadResponse = {
  ok: boolean;
  error?: string;
};

export function CharacterFileManager({
  characterId,
  files,
  canManage,
  detailHref,
}: {
  characterId: string;
  files: CharacterFileSummary[];
  canManage: boolean;
  detailHref?: string;
}) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [replaceFileId, setReplaceFileId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyFileId, setBusyFileId] = useState<string | null>(null);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage || file == null) {
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      if (label.trim() !== "") {
        formData.append("label", label.trim());
      }
      if (replaceFileId !== "") {
        formData.append("replaceFileId", replaceFileId);
      }

      const response = await fetch(`/api/characters/${characterId}/files/upload`, {
        method: "POST",
        body: formData,
      });
      const data = (await response.json()) as UploadResponse;

      if (!response.ok || !data.ok) {
        setError(data.error ?? "Upload failed.");
        return;
      }

      setLabel("");
      setReplaceFileId("");
      setFile(null);
      router.refresh();
    } catch {
      setError("Upload request failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleUnlist(fileId: string) {
    if (!canManage) {
      return;
    }

    setBusyFileId(fileId);
    setError(null);

    try {
      const response = await fetch(`/api/character-files/${fileId}/unlist`, {
        method: "POST",
      });
      const data = (await response.json()) as UploadResponse;

      if (!response.ok || !data.ok) {
        setError(data.error ?? "Failed to unlist file.");
        return;
      }

      router.refresh();
    } catch {
      setError("Unlist request failed.");
    } finally {
      setBusyFileId(null);
    }
  }

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Current Files</p>
        {typeof detailHref === "string" && detailHref !== "" ? (
          <Link href={detailHref} className="text-[11px] text-zinc-400 underline decoration-zinc-700 underline-offset-2">
            View history
          </Link>
        ) : null}
      </div>

      {files.length === 0 ? <p className="mt-2 text-xs text-zinc-500">No current files.</p> : null}

      {files.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {files.map((fileEntry) => (
            <li key={fileEntry.id} className="rounded border border-zinc-800 px-3 py-2 text-xs">
              <p className="text-zinc-100">{fileEntry.label ?? fileEntry.originalFileName}</p>
              <p className="mt-1 text-zinc-500">
                {fileEntry.extractionStatus} • {fileEntry.createdAt}
                {typeof fileEntry.extractedTextLength === "number" ? ` • text ${fileEntry.extractedTextLength}` : ""}
              </p>
              {canManage ? (
                <button
                  type="button"
                  onClick={() => handleUnlist(fileEntry.id)}
                  disabled={busyFileId === fileEntry.id}
                  className="mt-2 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-[11px] text-zinc-200 hover:border-zinc-500 disabled:opacity-60"
                >
                  {busyFileId === fileEntry.id ? "Unlisting..." : "Unlist"}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {canManage ? (
        <form onSubmit={handleUpload} className="mt-3 flex flex-col gap-2">
          <input
            type="text"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Optional label"
            maxLength={120}
            className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
          />
          <select
            value={replaceFileId}
            onChange={(event) => setReplaceFileId(event.target.value)}
            className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
          >
            <option value="">Upload as additional current file</option>
            {files.map((fileEntry) => (
              <option key={fileEntry.id} value={fileEntry.id}>
                Replace: {fileEntry.label ?? fileEntry.originalFileName}
              </option>
            ))}
          </select>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            className="block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-2 file:text-xs file:text-zinc-100 hover:file:bg-zinc-700"
          />
          <button
            type="submit"
            disabled={uploading || file == null}
            className="h-10 rounded-lg bg-amber-400 px-3 text-sm font-medium text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? "Uploading..." : "Upload Character File"}
          </button>
          {error !== null ? <p className="text-xs text-rose-300">{error}</p> : null}
        </form>
      ) : null}
    </section>
  );
}
