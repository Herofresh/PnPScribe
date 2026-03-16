import Link from "next/link";
import { redirect } from "next/navigation";

import { getEntityById, getEntityRuleLinks } from "@/lib/server/entities";
import { requireOwnedEntity } from "@/lib/server/auth/access";
import { HttpError } from "@/lib/server/http-error";

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ entityId: string }>;
}) {
  const { entityId } = await params;
  if (!entityId) {
    throw new HttpError(400, "entityId is required.");
  }

  try {
    await requireOwnedEntity(entityId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      redirect("/login");
    }
    throw error;
  }

  const entity = await getEntityById(entityId);
  const rules = await getEntityRuleLinks(entityId);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Entity</p>
          <h1 className="text-3xl font-semibold tracking-tight">{entity.name}</h1>
          <p className="text-sm text-zinc-300">
            {entity.type} • conf {entity.confidence.toFixed(2)} • {entity.extractionMethod}
          </p>
          <p className="text-xs text-zinc-500">id: {entity.id}</p>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-zinc-400">Document</p>
              <p className="mt-1 break-all text-zinc-200">{entity.document.filePath}</p>
              <p className="mt-1 text-xs text-zinc-500">docId: {entity.documentId}</p>
            </div>
            <div>
              <p className="text-zinc-400">Source</p>
              <p className="mt-1 text-zinc-200">
                pages {entity.sourcePageStart ?? "?"}–{entity.sourcePageEnd ?? "?"}
              </p>
              <p className="mt-1 text-zinc-200">
                chunks {entity.sourceChunkStart}–{entity.sourceChunkEnd}
              </p>
              <p className="mt-1 text-xs text-zinc-500">group: {entity.groupId ?? "none"}</p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="text-sm font-medium text-zinc-200">Rule Links</h2>
          {rules.links.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No rule links yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {rules.links.map((link) => (
                <li key={link.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-xs">
                  <p className="text-zinc-400">
                    {link.relation} • conf {link.confidence.toFixed(2)} • chunk {link.chunk.chunkIndex}
                    {link.chunk.pageNumber != null ? ` • page ${link.chunk.pageNumber}` : ""}
                  </p>
                  <p className="mt-2 text-zinc-200 whitespace-pre-wrap">{link.chunk.content}</p>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="text-sm font-medium text-zinc-200">Images</h2>
          {entity.images.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No images linked.</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {entity.images.map((image) => (
                <a
                  key={image.id}
                  href={`/api/entities/${entity.id}/images/${image.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/60 transition hover:border-zinc-600"
                >
                  <img
                    src={`/api/entities/${entity.id}/images/${image.id}`}
                    alt={`${entity.name} page ${image.pageNumber}`}
                    className="h-64 w-full bg-zinc-950 object-contain"
                    loading="lazy"
                  />
                  <div className="border-t border-zinc-800 px-3 py-2 text-xs text-zinc-300">
                    <p>
                      page {image.pageNumber} • {image.kind}
                    </p>
                    <p className="mt-1 break-all text-zinc-500">{image.filePath}</p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-zinc-500">
          <Link href="/" className="underline decoration-zinc-700 underline-offset-2">
            Back to dashboard
          </Link>
        </p>
      </div>
    </main>
  );
}
