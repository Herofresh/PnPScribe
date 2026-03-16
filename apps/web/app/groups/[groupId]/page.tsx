import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CharacterAskPanel } from "@/app/character-ask-panel";
import { SignOutForm } from "@/app/sign-out-form";
import { prisma } from "@/lib/prisma";
import { requireGroupAccess } from "@/lib/server/auth/access";
import { HttpError } from "@/lib/server/http-error";

export default async function GroupDetailPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const session = await auth();
  if (session?.user?.id == null || session.user.id === "") {
    redirect("/login");
  }

  const { groupId } = await params;
  let access: Awaited<ReturnType<typeof requireGroupAccess>>;

  try {
    access = await requireGroupAccess(groupId);
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      redirect("/login");
    }
    throw error;
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      description: true,
      ownerId: true,
      system: {
        select: {
          id: true,
          name: true,
        },
      },
      owner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      memberships: {
        orderBy: [{ createdAt: "asc" }],
        select: {
          id: true,
          role: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      characters: {
        orderBy: [{ createdAt: "desc" }],
        select: {
          id: true,
          name: true,
          description: true,
          ownerUser: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          files: {
            where: { isListed: true },
            orderBy: [{ createdAt: "desc" }],
            select: {
              id: true,
              label: true,
              originalFileName: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  if (group == null) {
    redirect("/");
  }

  const ownerName = group.owner.name?.trim() ?? "";
  const ownerLabel = ownerName !== "" ? ownerName : group.owner.email;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">PnPScribe</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">{group.name}</h1>
            <p className="text-sm text-zinc-400">
              {group.system.name} • GM {ownerLabel}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 hover:border-zinc-500"
            >
              Dashboard
            </Link>
            <SignOutForm />
          </div>
        </header>

        {group.description != null && group.description !== "" ? (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 text-sm text-zinc-300">
            {group.description}
          </section>
        ) : null}

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="mb-4 text-sm font-medium text-zinc-200">Members</h2>
          {group.memberships.length === 0 ? (
            <p className="text-sm text-zinc-500">No accepted members yet.</p>
          ) : (
            <ul className="space-y-2">
              {group.memberships.map((membership) => {
                const memberName = membership.user.name?.trim() ?? "";
                const memberLabel = memberName !== "" ? memberName : membership.user.email;

                return (
                  <li key={membership.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                    <p className="text-sm text-zinc-100">{memberLabel}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {membership.role} • joined {membership.createdAt.toLocaleString()}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-zinc-200">Characters</h2>
            <span className="text-xs text-zinc-500">{group.characters.length} total</span>
          </div>
          {group.characters.length === 0 ? (
            <p className="text-sm text-zinc-500">No characters in this group yet.</p>
          ) : (
            <ul className="space-y-3">
              {group.characters.map((character) => {
                const characterOwnerName = character.ownerUser.name?.trim() ?? "";
                const characterOwnerLabel =
                  characterOwnerName !== "" ? characterOwnerName : character.ownerUser.email;

                return (
                  <li key={character.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{character.name}</p>
                        <p className="mt-1 text-xs text-zinc-500">Owner: {characterOwnerLabel}</p>
                      </div>
                      <Link
                        href={`/characters/${character.id}`}
                        className="inline-flex h-9 items-center rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 hover:border-zinc-500"
                      >
                        Open Character
                      </Link>
                    </div>
                    {character.description != null && character.description !== "" ? (
                      <p className="mt-2 text-sm text-zinc-400">{character.description}</p>
                    ) : null}
                    {character.files.length > 0 ? (
                      <ul className="mt-3 space-y-2">
                        {character.files.map((file) => (
                          <li key={file.id} className="rounded border border-zinc-800 px-3 py-2 text-xs text-zinc-300">
                            {file.label ?? file.originalFileName} • {file.createdAt.toLocaleString()}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 text-xs text-zinc-500">No current files.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {access.isOwner ? (
          <CharacterAskPanel
            characterId={group.id}
            title="Ask About Group Character Context"
            endpoint="/api/groups/:id/ask-characters"
          />
        ) : null}
      </div>
    </main>
  );
}
