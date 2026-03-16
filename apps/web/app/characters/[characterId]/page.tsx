import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CharacterAskPanel } from "@/app/character-ask-panel";
import { CharacterFileManager } from "@/app/character-file-manager";
import { SignOutForm } from "@/app/sign-out-form";
import { prisma } from "@/lib/prisma";
import { requireCharacterAccess } from "@/lib/server/auth/access";
import { HttpError } from "@/lib/server/http-error";

export default async function CharacterDetailPage({
  params,
}: {
  params: Promise<{ characterId: string }>;
}) {
  const session = await auth();
  if (session?.user?.id == null || session.user.id === "") {
    redirect("/login");
  }

  const { characterId } = await params;
  let access: Awaited<ReturnType<typeof requireCharacterAccess>>;

  try {
    access = await requireCharacterAccess(characterId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      redirect("/login");
    }
    throw error;
  }

  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      ownerUser: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      group: {
        select: {
          id: true,
          name: true,
          system: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      files: {
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          label: true,
          originalFileName: true,
          filePath: true,
          createdAt: true,
          extractionStatus: true,
          extractedTextLength: true,
          isListed: true,
          replacedById: true,
          uploadedBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          replacedBy: {
            select: {
              id: true,
              label: true,
              originalFileName: true,
            },
          },
        },
      },
    },
  });

  if (character == null) {
    redirect("/");
  }

  const canManage = access.isCharacterOwner || access.isGroupOwner;
  const ownerName = character.ownerUser.name?.trim() ?? "";
  const ownerLabel = ownerName !== "" ? ownerName : character.ownerUser.email;
  const currentFiles = character.files.filter((file) => file.isListed);
  const archivedFiles = character.files.filter((file) => !file.isListed);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">PnPScribe</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">{character.name}</h1>
            <p className="text-sm text-zinc-400">
              {character.group.system.name} • {character.group.name} • owner {ownerLabel}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/groups/${character.group.id}`}
              className="inline-flex h-10 items-center rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 hover:border-zinc-500"
            >
              Group
            </Link>
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 hover:border-zinc-500"
            >
              Dashboard
            </Link>
            <SignOutForm />
          </div>
        </header>

        {character.description != null && character.description !== "" ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm text-zinc-300">
            {character.description}
          </section>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <CharacterFileManager
            characterId={character.id}
            canManage={canManage}
            detailHref=""
            files={currentFiles.map((file) => ({
              ...file,
              createdAt: file.createdAt.toLocaleString(),
            }))}
          />
          <CharacterAskPanel
            characterId={character.id}
            title="Ask About This Character"
            endpoint="/api/characters/:id/ask"
          />
        </div>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-zinc-200">Archived File History</h2>
            <span className="text-xs text-zinc-500">{archivedFiles.length} archived</span>
          </div>
          {archivedFiles.length === 0 ? (
            <p className="text-sm text-zinc-500">No archived files yet.</p>
          ) : (
            <ul className="space-y-3">
              {archivedFiles.map((file) => {
                const uploaderName = file.uploadedBy.name?.trim() ?? "";
                const uploaderLabel = uploaderName !== "" ? uploaderName : file.uploadedBy.email;
                const replacementLabel =
                  file.replacedBy != null
                    ? file.replacedBy.label ?? file.replacedBy.originalFileName
                    : null;

                return (
                  <li key={file.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                    <p className="text-sm font-medium text-zinc-100">{file.label ?? file.originalFileName}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {file.extractionStatus} • uploaded {file.createdAt.toLocaleString()} • by {uploaderLabel}
                    </p>
                    {typeof file.extractedTextLength === "number" ? (
                      <p className="mt-1 text-xs text-zinc-500">text length {file.extractedTextLength}</p>
                    ) : null}
                    {replacementLabel != null ? (
                      <p className="mt-2 text-xs text-zinc-400">Replaced by: {replacementLabel}</p>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-400">Unlisted without replacement.</p>
                    )}
                    <p className="mt-1 break-all text-xs text-zinc-600">{file.filePath}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
