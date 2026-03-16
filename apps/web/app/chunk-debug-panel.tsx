"use client";

import { useEffect, useMemo, useState } from "react";

type SystemOption = {
  id: string;
  name: string;
};

type SystemDocumentsResponse = {
  ok: boolean;
  error?: string;
  documents?: Array<{
    id: string;
    filePath: string;
    extractedTextLength: number | null;
    extractedPageCount: number | null;
    extractionDurationMs: number | null;
    ocrStatus: string;
    ocrMode: string | null;
    ocrReason: string | null;
    ocrError: string | null;
    ocrRequestedAt: string | null;
    ocrCompletedAt: string | null;
    ocrProgressCurrentPage: number | null;
    ocrProgressTotalPages: number | null;
    ocrProgressMessage: string | null;
    ocrProgressUpdatedAt: string | null;
    entityStatus: string;
    entityError: string | null;
    entityProgressMessage: string | null;
    entityProgressUpdatedAt: string | null;
    entityExtractedCount: number | null;
    entityRuleLinkCount: number | null;
    entityImageCount: number | null;
    extractionStatus: string;
    extractionError: string | null;
    extractedAt: string | null;
    createdAt: string;
    _count: {
      chunks: number;
    };
  }>;
};

type DocumentChunksResponse = {
  ok: boolean;
  error?: string;
  document?: {
    id: string;
    filePath: string;
    systemId: string;
    extractedTextLength: number | null;
    extractedPageCount: number | null;
    extractionDurationMs: number | null;
    ocrStatus: string;
    ocrMode: string | null;
    ocrReason: string | null;
    ocrError: string | null;
    ocrRequestedAt: string | null;
    ocrCompletedAt: string | null;
    ocrProgressCurrentPage: number | null;
    ocrProgressTotalPages: number | null;
    ocrProgressMessage: string | null;
    ocrProgressUpdatedAt: string | null;
    entityStatus: string;
    entityError: string | null;
    entityProgressMessage: string | null;
    entityProgressUpdatedAt: string | null;
    entityExtractedCount: number | null;
    entityRuleLinkCount: number | null;
    entityImageCount: number | null;
    extractionStatus: string;
    extractionError: string | null;
    extractedAt: string | null;
    createdAt: string;
    _count: {
      chunks: number;
    };
  };
  chunks?: Array<{
    id: string;
    chunkIndex: number;
    pageNumber: number | null;
    chapterHint: string | null;
    content: string;
    hasEmbedding: boolean;
    createdAt: string;
  }>;
};

type EntityMetaResponse = {
  ok: boolean;
  error?: string;
  document?: {
    id: string;
    entityMetaStatus: string | null;
    entityMetaError: string | null;
    entityMetaModel: string | null;
    entityMetaUpdatedAt: string | null;
    entityMetaJson: {
      mode?: string;
      model?: string;
      batch_count?: number;
      batch_concurrency?: number;
      merge_mode?: string;
      notes?: string[];
      entity_types?: Array<{
        name?: string;
        aliases?: string[];
        signals?: string[];
        example_sections?: string[];
        confidence?: number;
        likely_locations?: Array<{
          page_start?: number | null;
          page_end?: number | null;
          chunk_start?: number | null;
          chunk_end?: number | null;
          section_title?: string | null;
          reason?: string | null;
        }>;
      }>;
      batches?: Array<{
        batch_label?: string;
        notes?: string[];
        entity_types?: Array<{
          name?: string;
          confidence?: number;
        }>;
      }>;
    } | null;
  };
};

export function ChunkDebugPanel({ systems }: { systems: SystemOption[] }) {
  const [systemId, setSystemId] = useState(systems[0]?.id ?? "");
  const [documentsState, setDocumentsState] = useState<{
    loading: boolean;
    error: string | null;
    documents: NonNullable<SystemDocumentsResponse["documents"]>;
  }>({ loading: false, error: null, documents: [] });
  const [documentId, setDocumentId] = useState("");
  const [chunksState, setChunksState] = useState<{
    loading: boolean;
    error: string | null;
    payload: DocumentChunksResponse | null;
  }>({ loading: false, error: null, payload: null });
  const [ocrRequestState, setOcrRequestState] = useState<{
    loading: boolean;
    error: string | null;
    message: string | null;
  }>({ loading: false, error: null, message: null });
  const [entityRequestState, setEntityRequestState] = useState<{
    loading: boolean;
    error: string | null;
    message: string | null;
  }>({ loading: false, error: null, message: null });
  const [resetState, setResetState] = useState<{
    loading: boolean;
    error: string | null;
    message: string | null;
  }>({ loading: false, error: null, message: null });
  const [metaState, setMetaState] = useState<{
    loading: boolean;
    error: string | null;
    running: boolean;
    message: string | null;
    payload: EntityMetaResponse | null;
  }>({ loading: false, error: null, running: false, message: null, payload: null });
  const [ocrMode, setOcrMode] = useState<"replace" | "supplement">("replace");
  const [ocrFullRun, setOcrFullRun] = useState(false);

  async function loadMetaForDocument(activeDocumentId: string) {
    setMetaState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch(`/api/documents/${activeDocumentId}/entities/meta`);
      const data = (await res.json()) as EntityMetaResponse;

      if (!data.ok) {
        setMetaState((prev) => ({
          ...prev,
          loading: false,
          error: data.error ?? "Failed to load entity meta.",
          payload: null,
        }));
        return;
      }

      setMetaState((prev) => ({
        ...prev,
        loading: false,
        error: null,
        payload: data,
      }));
    } catch {
      setMetaState((prev) => ({
        ...prev,
        loading: false,
        error: "Failed to load entity meta.",
        payload: null,
      }));
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadDocuments() {
      if (!systemId) {
        setDocumentsState({ loading: false, error: null, documents: [] });
        setDocumentId("");
        return;
      }

      setDocumentsState((prev) => ({ ...prev, loading: true, error: null }));
      setChunksState({ loading: false, error: null, payload: null });
      setMetaState({ loading: false, error: null, running: false, message: null, payload: null });

      try {
        const res = await fetch(`/api/systems/${systemId}/documents`);
        const data = (await res.json()) as SystemDocumentsResponse;

        if (cancelled) {
          return;
        }

        if (!data.ok) {
          setDocumentsState({ loading: false, error: data.error ?? "Failed to load documents.", documents: [] });
          setDocumentId("");
          return;
        }

        const docs = data.documents ?? [];
        const nextDocumentId = docs[0]?.id ?? "";
        setDocumentsState({ loading: false, error: null, documents: docs });
        setDocumentId(nextDocumentId);
        if (nextDocumentId !== "") {
          void loadMetaForDocument(nextDocumentId);
        }
      } catch {
        if (!cancelled) {
          setDocumentsState({ loading: false, error: "Failed to load documents.", documents: [] });
          setDocumentId("");
        }
      }
    }

    void loadDocuments();

    return () => {
      cancelled = true;
    };
  }, [systemId]);

  async function loadChunks() {
    if (!documentId) {
      return;
    }

    setChunksState({ loading: true, error: null, payload: null });

    try {
      const res = await fetch(`/api/documents/${documentId}/chunks`);
      const data = (await res.json()) as DocumentChunksResponse;

      if (!data.ok) {
        setChunksState({ loading: false, error: data.error ?? "Failed to load chunks.", payload: null });
        return;
      }

      setChunksState({ loading: false, error: null, payload: data });
    } catch {
      setChunksState({ loading: false, error: "Failed to load chunks.", payload: null });
    }
  }

  async function loadMeta() {
    if (!documentId) {
      return;
    }
    await loadMetaForDocument(documentId);
  }

  async function requestOcr() {
    if (!documentId) {
      return;
    }

    setOcrRequestState({ loading: true, error: null, message: null });

    try {
      const res = await fetch(`/api/documents/${documentId}/ocr/request`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          mode: ocrMode,
          fullRun: ocrFullRun,
        }),
      });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        queued?: boolean;
        provider?: string;
      };

      if (!data.ok) {
        setOcrRequestState({
          loading: false,
          error: data.error ?? "Failed to request OCR.",
          message: null,
        });
        return;
      }

      setOcrRequestState({
        loading: false,
        error: null,
        message: data.queued === true ? `OCR job queued (${data.provider ?? "worker"}).` : "OCR request sent.",
      });

      await loadChunks();
    } catch {
      setOcrRequestState({
        loading: false,
        error: "Failed to request OCR.",
        message: null,
      });
    }
  }

  async function requestEntityExtraction() {
    if (!documentId) {
      return;
    }

    setEntityRequestState({ loading: true, error: null, message: null });

    try {
      const res = await fetch(`/api/documents/${documentId}/entities/reprocess`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!data.ok) {
        setEntityRequestState({
          loading: false,
          error: data.error ?? "Failed to queue entity extraction.",
          message: null,
        });
        return;
      }

      setEntityRequestState({
        loading: false,
        error: null,
        message: "Entity extraction queued.",
      });

      await loadChunks();
    } catch {
      setEntityRequestState({
        loading: false,
        error: "Failed to queue entity extraction.",
        message: null,
      });
    }
  }

  async function requestEntityMeta() {
    if (!documentId) {
      return;
    }

    setMetaState((prev) => ({ ...prev, running: true, error: null, message: null }));

    try {
      const res = await fetch(`/api/documents/${documentId}/entities/meta`, {
        method: "POST",
      });
      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!data.ok) {
        setMetaState((prev) => ({
          ...prev,
          running: false,
          error: data.error ?? "Failed to run entity meta analysis.",
          message: null,
        }));
        return;
      }

      setMetaState((prev) => ({
        ...prev,
        running: false,
        error: null,
        message: "Entity meta analysis completed.",
      }));

      await loadMeta();
    } catch {
      setMetaState((prev) => ({
        ...prev,
        running: false,
        error: "Failed to run entity meta analysis.",
        message: null,
      }));
    }
  }

  async function resetQueues() {
    setResetState({ loading: true, error: null, message: null });

    try {
      const res = await fetch("/api/debug/reset", { method: "POST" });
      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!data.ok) {
        setResetState({
          loading: false,
          error: data.error ?? "Failed to reset queues.",
          message: null,
        });
        return;
      }

      setResetState({
        loading: false,
        error: null,
        message: "Queues cleared and statuses reset.",
      });

      await loadChunks();
    } catch {
      setResetState({
        loading: false,
        error: "Failed to reset queues.",
        message: null,
      });
    }
  }

  const selectedDocument = useMemo(
    () => documentsState.documents.find((doc) => doc.id === documentId) ?? null,
    [documentsState.documents, documentId],
  );
  const entityMeta = metaState.payload?.document?.entityMetaJson;

  if (systems.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-zinc-200">Chunk Debug (Document Inspector)</h2>
        <span className="text-xs text-zinc-500">Inspect indexed text/chunks without curl</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <select
          value={systemId}
          onChange={(event) => setSystemId(event.target.value)}
          className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        >
          {systems.map((system) => (
            <option key={system.id} value={system.id}>
              {system.name}
            </option>
          ))}
        </select>

        <select
          value={documentId}
          onChange={(event) => {
            const nextDocumentId = event.target.value;
            setDocumentId(nextDocumentId);
            setChunksState({ loading: false, error: null, payload: null });
            setMetaState({ loading: false, error: null, running: false, message: null, payload: null });
            if (nextDocumentId !== "") {
              void loadMetaForDocument(nextDocumentId);
            }
          }}
          disabled={documentsState.loading || documentsState.documents.length === 0}
          className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none disabled:opacity-60 focus:border-zinc-500"
        >
          {documentsState.documents.length === 0 ? (
            <option value="">No documents</option>
          ) : (
            documentsState.documents.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.filePath.split("/").pop()} ({doc.extractionStatus}, chunks {doc._count.chunks})
              </option>
            ))
          )}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => void loadChunks()}
          disabled={!documentId || chunksState.loading}
          className="h-10 rounded-lg bg-fuchsia-400 px-4 text-sm font-medium text-zinc-950 hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {chunksState.loading ? "Loading chunks..." : "Load Chunks"}
        </button>

        <button
          type="button"
          onClick={() => void requestOcr()}
          disabled={!documentId || ocrRequestState.loading}
          className="h-10 rounded-lg bg-orange-400 px-4 text-sm font-medium text-zinc-950 hover:bg-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {ocrRequestState.loading ? "Queueing OCR..." : "Request OCR"}
        </button>

        <button
          type="button"
          onClick={() => void requestEntityExtraction()}
          disabled={!documentId || entityRequestState.loading}
          className="h-10 rounded-lg bg-cyan-300 px-4 text-sm font-medium text-zinc-950 hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {entityRequestState.loading ? "Queueing entities..." : "Re-run entities"}
        </button>

        <button
          type="button"
          onClick={() => void requestEntityMeta()}
          disabled={!documentId || metaState.running}
          className="h-10 rounded-lg bg-emerald-300 px-4 text-sm font-medium text-zinc-950 hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {metaState.running ? "Building meta..." : "Run Meta Index"}
        </button>

        <button
          type="button"
          onClick={() => void loadMeta()}
          disabled={!documentId || metaState.loading}
          className="h-10 rounded-lg bg-zinc-700 px-4 text-sm font-medium text-zinc-100 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {metaState.loading ? "Loading meta..." : "Load Meta"}
        </button>

        <button
          type="button"
          onClick={() => void resetQueues()}
          disabled={resetState.loading}
          className="h-10 rounded-lg bg-zinc-700 px-4 text-sm font-medium text-zinc-100 hover:bg-zinc-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resetState.loading ? "Resetting..." : "Reset queues"}
        </button>

        <select
          value={ocrMode}
          onChange={(event) => setOcrMode(event.target.value === "supplement" ? "supplement" : "replace")}
          className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 outline-none focus:border-zinc-500"
        >
          <option value="replace">OCR mode: replace</option>
          <option value="supplement">OCR mode: supplement</option>
        </select>

        <label className="flex items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={ocrFullRun}
            onChange={(event) => setOcrFullRun(event.target.checked)}
          />
          Full OCR run (disable dev page cap)
        </label>

        {documentsState.loading ? <span className="text-xs text-zinc-400">Loading documents...</span> : null}
        {documentsState.error !== null && documentsState.error !== "" ? (
          <span className="text-xs text-rose-300">{documentsState.error}</span>
        ) : null}
        {ocrRequestState.error !== null && ocrRequestState.error !== "" ? (
          <span className="text-xs text-rose-300">{ocrRequestState.error}</span>
        ) : null}
        {ocrRequestState.message !== null && ocrRequestState.message !== "" ? (
          <span className="text-xs text-emerald-300">{ocrRequestState.message}</span>
        ) : null}
        {entityRequestState.error !== null && entityRequestState.error !== "" ? (
          <span className="text-xs text-rose-300">{entityRequestState.error}</span>
        ) : null}
        {entityRequestState.message !== null && entityRequestState.message !== "" ? (
          <span className="text-xs text-emerald-300">{entityRequestState.message}</span>
        ) : null}
        {metaState.error !== null && metaState.error !== "" ? (
          <span className="text-xs text-rose-300">{metaState.error}</span>
        ) : null}
        {metaState.message !== null && metaState.message !== "" ? (
          <span className="text-xs text-emerald-300">{metaState.message}</span>
        ) : null}
        {resetState.error !== null && resetState.error !== "" ? (
          <span className="text-xs text-rose-300">{resetState.error}</span>
        ) : null}
        {resetState.message !== null && resetState.message !== "" ? (
          <span className="text-xs text-emerald-300">{resetState.message}</span>
        ) : null}
      </div>

      {selectedDocument ? (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
          <div className="max-h-48 overflow-y-auto pr-2">
          <p className="text-zinc-300">
            <span className="text-zinc-500">docId:</span> <code>{selectedDocument.id}</code>
          </p>
          <p className="mt-1 break-all text-zinc-300">
            <span className="text-zinc-500">file:</span> {selectedDocument.filePath}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">status:</span> {selectedDocument.extractionStatus}
            {" • "}
            <span className="text-zinc-500">chunks:</span> {selectedDocument._count.chunks}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">diagnostics:</span> textLen=
            {selectedDocument.extractedTextLength ?? "null"}
            {" • "}pages={selectedDocument.extractedPageCount ?? "null"}
            {" • "}extractMs={selectedDocument.extractionDurationMs ?? "null"}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">ocr:</span> {selectedDocument.ocrStatus}
            {selectedDocument.ocrMode !== null && selectedDocument.ocrMode !== "" ? ` • mode=${selectedDocument.ocrMode}` : ""}
            {selectedDocument.ocrReason !== null && selectedDocument.ocrReason !== "" ? ` • ${selectedDocument.ocrReason}` : ""}
            {selectedDocument.ocrRequestedAt !== null && selectedDocument.ocrRequestedAt !== ""
              ? ` • requested ${selectedDocument.ocrRequestedAt}`
              : ""}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">ocr progress:</span>{" "}
            {selectedDocument.ocrProgressCurrentPage ?? 0}/
            {selectedDocument.ocrProgressTotalPages ?? "?"}
            {selectedDocument.ocrProgressMessage !== null && selectedDocument.ocrProgressMessage !== ""
              ? ` • ${selectedDocument.ocrProgressMessage}`
              : ""}
            {selectedDocument.ocrProgressUpdatedAt !== null && selectedDocument.ocrProgressUpdatedAt !== ""
              ? ` • updated ${selectedDocument.ocrProgressUpdatedAt}`
              : ""}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">entity status:</span>{" "}
            {selectedDocument.entityStatus}
            {selectedDocument.entityProgressMessage !== null && selectedDocument.entityProgressMessage !== ""
              ? ` • ${selectedDocument.entityProgressMessage}`
              : ""}
            {selectedDocument.entityProgressUpdatedAt !== null && selectedDocument.entityProgressUpdatedAt !== ""
              ? ` • updated ${selectedDocument.entityProgressUpdatedAt}`
              : ""}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">entity counts:</span>{" "}
            extracted={selectedDocument.entityExtractedCount ?? 0}
            {" • "}rules={selectedDocument.entityRuleLinkCount ?? 0}
            {" • "}images={selectedDocument.entityImageCount ?? 0}
          </p>
          <p className="mt-1 text-zinc-300">
            <span className="text-zinc-500">entity meta:</span>{" "}
            {metaState.payload?.document?.entityMetaStatus ?? "unknown"}
            {metaState.payload?.document?.entityMetaModel != null &&
            metaState.payload.document.entityMetaModel !== ""
              ? ` • model=${metaState.payload.document.entityMetaModel}`
              : ""}
            {metaState.payload?.document?.entityMetaUpdatedAt != null &&
            metaState.payload.document.entityMetaUpdatedAt !== ""
              ? ` • updated ${metaState.payload.document.entityMetaUpdatedAt}`
              : ""}
          </p>
          {selectedDocument.entityError !== null && selectedDocument.entityError !== "" ? (
            <p className="mt-1 break-words text-amber-300">
              <span className="text-zinc-500">entity error:</span> {selectedDocument.entityError}
            </p>
          ) : null}
          {metaState.payload?.document?.entityMetaError != null &&
          metaState.payload.document.entityMetaError !== "" ? (
            <p className="mt-1 break-words text-amber-300">
              <span className="text-zinc-500">entity meta error:</span> {metaState.payload.document.entityMetaError}
            </p>
          ) : null}
          {selectedDocument.ocrError !== null && selectedDocument.ocrError !== "" ? (
            <p className="mt-1 break-words text-amber-300">
              <span className="text-zinc-500">ocrError:</span> {selectedDocument.ocrError}
            </p>
          ) : null}
          {selectedDocument.extractionError !== null && selectedDocument.extractionError !== "" ? (
            <p className="mt-1 break-words text-amber-300">
              <span className="text-zinc-500">error:</span> {selectedDocument.extractionError}
            </p>
          ) : null}
          </div>
          <p className="mt-2">
            <a
              href={`/api/documents/${selectedDocument.id}/chunks`}
              className="text-zinc-300 underline decoration-zinc-700 underline-offset-2 hover:text-zinc-100"
              target="_blank"
              rel="noreferrer"
            >
              Open chunks JSON
            </a>
          </p>
        </div>
      ) : null}

      {entityMeta != null ? (
        <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs text-zinc-300">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              <span className="text-zinc-500">meta mode:</span> {entityMeta.mode ?? "unknown"}
            </span>
            <span>
              <span className="text-zinc-500">batch count:</span> {entityMeta.batch_count ?? 0}
            </span>
            <span>
              <span className="text-zinc-500">parallelism:</span> {entityMeta.batch_concurrency ?? 1}
            </span>
            <span>
              <span className="text-zinc-500">merge:</span> {entityMeta.merge_mode ?? "unknown"}
            </span>
            <span>
              <span className="text-zinc-500">entity types:</span> {entityMeta.entity_types?.length ?? 0}
            </span>
          </div>

          {entityMeta.notes != null && entityMeta.notes.length > 0 ? (
            <div className="mt-3">
              <p className="text-zinc-500">merged notes</p>
              <ul className="mt-1 space-y-1">
                {entityMeta.notes.map((note, index) => (
                  <li key={`${note}-${index}`} className="rounded border border-zinc-800 bg-zinc-900/60 px-2 py-1">
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {entityMeta.entity_types != null && entityMeta.entity_types.length > 0 ? (
            <div className="mt-3">
              <p className="text-zinc-500">merged entity index</p>
              <ul className="mt-2 space-y-2">
                {entityMeta.entity_types.map((entityType, index) => (
                  <li key={`${entityType.name ?? "type"}-${index}`} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3">
                    <p className="font-medium text-zinc-100">
                      {entityType.name ?? "Unnamed type"}
                      {typeof entityType.confidence === "number"
                        ? ` • confidence ${entityType.confidence.toFixed(2)}`
                        : ""}
                    </p>
                    {entityType.aliases != null && entityType.aliases.length > 0 ? (
                      <p className="mt-1">
                        <span className="text-zinc-500">aliases:</span> {entityType.aliases.join(", ")}
                      </p>
                    ) : null}
                    {entityType.signals != null && entityType.signals.length > 0 ? (
                      <p className="mt-1">
                        <span className="text-zinc-500">signals:</span> {entityType.signals.join(", ")}
                      </p>
                    ) : null}
                    {entityType.example_sections != null && entityType.example_sections.length > 0 ? (
                      <p className="mt-1">
                        <span className="text-zinc-500">sections:</span> {entityType.example_sections.join(", ")}
                      </p>
                    ) : null}
                    {entityType.likely_locations != null && entityType.likely_locations.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {entityType.likely_locations.slice(0, 6).map((location, locationIndex) => (
                          <li
                            key={`${entityType.name ?? "type"}-location-${locationIndex}`}
                            className="rounded border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-zinc-400"
                          >
                            pages {location.page_start ?? "?"}-{location.page_end ?? "?"} • chunks{" "}
                            {location.chunk_start ?? "?"}-{location.chunk_end ?? "?"}
                            {location.section_title != null && location.section_title !== "" ? ` • ${location.section_title}` : ""}
                            {location.reason != null && location.reason !== "" ? ` • ${location.reason}` : ""}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {entityMeta.batches != null && entityMeta.batches.length > 0 ? (
            <details className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <summary className="cursor-pointer text-zinc-200">Batch breakdown</summary>
              <ul className="mt-3 space-y-2">
                {entityMeta.batches.map((batch, index) => (
                  <li key={`${batch.batch_label ?? "batch"}-${index}`} className="rounded border border-zinc-800 bg-zinc-950/60 p-2">
                    <p className="font-medium text-zinc-100">{batch.batch_label ?? `Batch ${index + 1}`}</p>
                    <p className="mt-1 text-zinc-400">
                      {(batch.entity_types ?? [])
                        .map((entityType) =>
                          entityType.name != null && entityType.name !== ""
                            ? `${entityType.name}${typeof entityType.confidence === "number" ? ` (${entityType.confidence.toFixed(2)})` : ""}`
                            : null,
                        )
                        .filter((value): value is string => value !== null)
                        .join(", ") || "No entity types returned"}
                    </p>
                    {batch.notes != null && batch.notes.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {batch.notes.map((note, noteIndex) => (
                          <li key={`${note}-${noteIndex}`} className="text-zinc-500">
                            {note}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      {chunksState.error !== null && chunksState.error !== "" ? (
        <p className="mt-4 rounded-lg border border-rose-800 bg-rose-950/20 px-3 py-2 text-sm text-rose-200">
          {chunksState.error}
        </p>
      ) : null}

      {chunksState.payload?.ok === true && chunksState.payload.chunks != null ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">
            <span className="text-zinc-500">loaded chunks:</span> {chunksState.payload.chunks.length}
            {" • "}
            <span className="text-zinc-500">with embeddings:</span>{" "}
            {chunksState.payload.chunks.filter((chunk) => chunk.hasEmbedding).length}
          </div>

          <div className="max-h-[520px] overflow-y-auto pr-2">
            <ul className="space-y-2">
              {chunksState.payload.chunks.map((chunk) => (
                <li key={chunk.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                <p className="text-xs text-zinc-400">
                  chunk {chunk.chunkIndex} • id <code>{chunk.id}</code>
                  {chunk.pageNumber !== null ? ` • page ${chunk.pageNumber}` : ""}
                  {chunk.hasEmbedding ? " • embedded" : " • no-embedding"}
                </p>
                {chunk.chapterHint !== null && chunk.chapterHint !== "" ? (
                  <p className="mt-1 text-xs text-zinc-300">
                    <span className="text-zinc-500">chapter:</span> {chunk.chapterHint}
                  </p>
                ) : null}
                <pre className="mt-2 max-h-40 overflow-y-auto overflow-x-auto whitespace-pre-wrap rounded border border-zinc-800 bg-zinc-900/70 p-2 text-xs text-zinc-200">
                  {chunk.content}
                </pre>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </section>
  );
}
