import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { ChunkDebugPanel } from "@/app/chunk-debug-panel";
import { DocumentUploadPanel } from "@/app/document-upload-panel";
import { EntitiesDebugPanel } from "@/app/entities-debug-panel";
import { RulesAskPanel } from "@/app/rules-ask-panel";
import { SignOutForm } from "@/app/sign-out-form";
import { prisma } from "@/lib/prisma";
import { requireGmUser } from "@/lib/server/auth/access";
import { createGroup, createInviteLink, parseGroupDescription, parseGroupName } from "@/lib/server/groups";

async function createSystemGroup(formData: FormData) {
  "use server";

  const user = await requireGmUser();
  const rawSystemId = formData.get("systemId");
  const systemId = typeof rawSystemId === "string" ? rawSystemId.trim() : "";
  const name = parseGroupName(formData.get("name"));
  const description = parseGroupDescription(formData.get("description"));

  if (systemId === "") {
    return;
  }

  const system = await prisma.system.findUnique({
    where: { id: systemId },
    select: { id: true, ownerId: true },
  });

  if (system == null || system.ownerId !== user.id) {
    return;
  }

  await createGroup({
    systemId: system.id,
    ownerId: user.id,
    name,
    description,
  });

  revalidatePath("/");
}

async function createGroupInvite(formData: FormData) {
  "use server";

  const user = await requireGmUser();
  const rawGroupId = formData.get("groupId");
  const groupId = typeof rawGroupId === "string" ? rawGroupId.trim() : "";

  if (groupId === "") {
    return;
  }

  const group = await prisma.group.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      ownerId: true,
    },
  });

  if (group == null || group.ownerId !== user.id) {
    return;
  }

  await createInviteLink({
    groupId: group.id,
    createdById: user.id,
  });

  revalidatePath("/");
}

async function createOwnedSystem(formData: FormData) {
  "use server";

  const user = await requireGmUser();
  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName.trim().slice(0, 120) : "";

  if (!name) {
    return;
  }

  await prisma.system.create({
    data: {
      name,
      ownerId: user.id,
    },
  });

  revalidatePath("/");
}

export default async function HomePage() {
  const session = await auth();

  if (session?.user?.id == null || session.user.id === "") {
    redirect("/login");
  }

  const user = session.user;
  const memberships = await prisma.groupMembership.findMany({
    where: { userId: user.id },
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      role: true,
      createdAt: true,
      group: {
        select: {
          id: true,
          name: true,
          description: true,
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
          _count: {
            select: {
              memberships: true,
            },
          },
        },
      },
    },
  });
  const systems = await prisma.system.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          documents: true,
          entities: true,
          groups: true,
        },
      },
      groups: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          _count: {
            select: {
              memberships: true,
              inviteLinks: true,
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
          inviteLinks: {
            where: {
              revokedAt: null,
            },
            orderBy: { createdAt: "desc" },
            take: 3,
            select: {
              id: true,
              token: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
  const baseUrl = process.env.AUTH_URL?.trim() || "http://localhost:3000";

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">PnPScribe</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">Dashboard</h1>
            <p className="text-sm text-zinc-400">
              Signed in as {user.email}
              {user.gmEnabled === true ? " • GM mode enabled" : " • Player mode"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/settings"
              className="inline-flex h-10 items-center rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 hover:border-zinc-500"
            >
              Settings
            </Link>
            <SignOutForm />
          </div>
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-zinc-200">Your Groups</h2>
            <span className="text-xs text-zinc-500">{memberships.length} memberships</span>
          </div>

          {memberships.length === 0 ? (
            <p className="text-sm text-zinc-400">
              You have not joined any groups yet. Accept an invite link from a GM to appear here.
            </p>
          ) : (
            <ul className="space-y-3">
              {memberships.map((membership) => {
                const ownerName = membership.group.owner.name?.trim() ?? "";
                const ownerLabel = ownerName !== "" ? ownerName : membership.group.owner.email;

                return (
                  <li key={membership.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-100">{membership.group.name}</p>
                        <p className="mt-1 text-xs text-zinc-400">{membership.group.system.name}</p>
                      </div>
                      <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">{membership.role}</p>
                    </div>
                    {membership.group.description != null && membership.group.description !== "" ? (
                      <p className="mt-2 text-sm text-zinc-400">{membership.group.description}</p>
                    ) : null}
                    <p className="mt-2 text-xs text-zinc-500">
                      GM: {ownerLabel} • {membership.group._count.memberships} members • joined{" "}
                      {membership.createdAt.toLocaleString()}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {user.gmEnabled === true ? (
          <>
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <h2 className="mb-4 text-sm font-medium text-zinc-200">Create System</h2>
              <form action={createOwnedSystem} className="flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  name="name"
                  placeholder="e.g. Pathfinder 2e"
                  className="h-11 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm outline-none placeholder:text-zinc-500 focus:border-zinc-500"
                  maxLength={120}
                  required
                />
                <button
                  type="submit"
                  className="h-11 rounded-lg bg-emerald-400 px-4 text-sm font-medium text-zinc-950 hover:bg-emerald-300"
                >
                  Create
                </button>
              </form>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-sm font-medium text-zinc-200">Your Systems</h2>
                <span className="text-xs text-zinc-500">{systems.length} total</span>
              </div>

              {systems.length === 0 ? (
                <p className="text-sm text-zinc-400">No systems yet.</p>
              ) : (
                <ul className="space-y-2">
                  {systems.map((system) => (
                    <li key={system.id} className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-zinc-100">{system.name}</p>
                          <p className="mt-1 text-xs text-zinc-500">{system.id}</p>
                        </div>
                        <p className="text-xs text-zinc-500">{system.createdAt.toLocaleString()}</p>
                      </div>
                      <p className="mt-2 text-xs text-zinc-400">
                        {system._count.documents} documents • {system._count.entities} entities • {system._count.groups} groups
                      </p>

                      <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
                        <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Groups</p>
                        <form action={createSystemGroup} className="mt-3 grid gap-2 md:grid-cols-[1fr_1fr_auto]">
                          <input type="hidden" name="systemId" value={system.id} />
                          <input
                            type="text"
                            name="name"
                            placeholder="New group name"
                            maxLength={120}
                            required
                            className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
                          />
                          <input
                            type="text"
                            name="description"
                            placeholder="Optional description"
                            maxLength={500}
                            className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
                          />
                          <button
                            type="submit"
                            className="h-10 rounded-lg bg-sky-400 px-3 text-sm font-medium text-zinc-950 hover:bg-sky-300"
                          >
                            Create Group
                          </button>
                        </form>

                        {system.groups.length === 0 ? (
                          <p className="mt-3 text-sm text-zinc-500">No groups yet.</p>
                        ) : (
                          <ul className="mt-3 space-y-3">
                            {system.groups.map((group) => (
                              <li key={group.id} className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
                                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                  <div>
                                    <p className="text-sm font-medium text-zinc-100">{group.name}</p>
                                    {group.description != null && group.description !== "" ? (
                                      <p className="mt-1 text-xs text-zinc-400">{group.description}</p>
                                    ) : null}
                                    <p className="mt-2 text-xs text-zinc-500">
                                      {group._count.memberships} members • {group._count.inviteLinks} invite links
                                    </p>
                                  </div>
                                  <form action={createGroupInvite}>
                                    <input type="hidden" name="groupId" value={group.id} />
                                    <button
                                      type="submit"
                                      className="h-9 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-xs text-zinc-100 hover:border-zinc-500"
                                    >
                                      Create Invite Link
                                    </button>
                                  </form>
                                </div>

                                {group.inviteLinks.length > 0 ? (
                                  <div className="mt-3 space-y-2">
                                    {group.inviteLinks.map((invite) => (
                                      <div key={invite.id} className="rounded border border-zinc-800 px-3 py-2 text-xs text-zinc-300">
                                        <p className="text-zinc-500">{invite.createdAt.toLocaleString()}</p>
                                        <p className="mt-1 break-all text-zinc-200">{`${baseUrl}/invite/${invite.token}`}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                <div className="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                                  <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Members</p>
                                  {group.memberships.length === 0 ? (
                                    <p className="mt-2 text-xs text-zinc-500">No accepted members yet.</p>
                                  ) : (
                                    <ul className="mt-2 space-y-2">
                                      {group.memberships.map((membership) => {
                                        const memberName = membership.user.name?.trim() ?? "";
                                        const memberLabel = memberName !== "" ? memberName : membership.user.email;

                                        return (
                                          <li
                                            key={membership.id}
                                            className="rounded border border-zinc-800 px-3 py-2 text-xs text-zinc-300"
                                          >
                                            <p className="text-zinc-100">{memberLabel}</p>
                                            <p className="mt-1 text-zinc-500">
                                              {membership.role} • joined {membership.createdAt.toLocaleString()}
                                            </p>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div className="grid gap-6 xl:grid-cols-2">
              <DocumentUploadPanel systems={systems} />
              <RulesAskPanel systems={systems} />
            </div>

            <ChunkDebugPanel systems={systems} />
            <EntitiesDebugPanel systems={systems} />
          </>
        ) : (
          <section className="rounded-2xl border border-sky-900 bg-sky-950/20 p-5 text-sm text-sky-100">
            Your account is currently in player mode. GM mode is still admin-managed. You can already join groups
            through invite links and see accepted memberships above.
          </section>
        )}
      </div>
    </main>
  );
}
