import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { CharacterAskPanel } from "@/app/character-ask-panel";
import { CharacterFileManager } from "@/app/character-file-manager";
import { ChunkDebugPanel } from "@/app/chunk-debug-panel";
import { DocumentUploadPanel } from "@/app/document-upload-panel";
import { EntitiesDebugPanel } from "@/app/entities-debug-panel";
import { RulesAskPanel } from "@/app/rules-ask-panel";
import { SignOutForm } from "@/app/sign-out-form";
import { prisma } from "@/lib/prisma";
import { requireGmUser, requireGroupAccess } from "@/lib/server/auth/access";
import { createGroup, createInviteLink, parseGroupDescription, parseGroupName } from "@/lib/server/groups";

type DashboardTab = "overview" | "play" | "systems" | "debug";

function readSearchParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function getDashboardHref(tab: DashboardTab, systemId?: string) {
  const params = new URLSearchParams();
  if (tab !== "overview") {
    params.set("tab", tab);
  }
  if (systemId != null && systemId !== "") {
    params.set("system", systemId);
  }

  const query = params.toString();
  return query === "" ? "/" : `/?${query}`;
}

function cx(...tokens: Array<string | false | null | undefined>) {
  return tokens.filter(Boolean).join(" ");
}

function formatCount(value: number, singular: string, plural = `${singular}s`) {
  return `${value} ${value === 1 ? singular : plural}`;
}

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

  if (name === "") {
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

async function createCharacter(formData: FormData) {
  "use server";

  const rawGroupId = formData.get("groupId");
  const groupId = typeof rawGroupId === "string" ? rawGroupId.trim() : "";
  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName.trim().slice(0, 120) : "";
  const rawDescription = formData.get("description");
  const description = typeof rawDescription === "string" ? rawDescription.trim().slice(0, 500) : "";

  if (groupId === "" || name === "") {
    return;
  }

  const access = await requireGroupAccess(groupId);

  await prisma.character.create({
    data: {
      groupId: access.group.id,
      ownerUserId: access.user.id,
      name,
      description: description === "" ? null : description,
    },
  });

  revalidatePath("/");
}

function DashboardPanel(props: {
  title: string;
  eyebrow?: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[26px] border border-white/10 bg-[#0f1728]/82 p-5 shadow-[0_24px_80px_rgba(4,8,20,0.38)] backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          {props.eyebrow != null && props.eyebrow !== "" ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#7dd3c8]">{props.eyebrow}</p>
          ) : null}
          <h2 className="mt-1 text-lg font-semibold tracking-tight text-white">{props.title}</h2>
        </div>
        {props.aside}
      </div>
      {props.children}
    </section>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();

  if (session?.user?.id == null || session.user.id === "") {
    redirect("/login");
  }

  const params = (await searchParams) ?? {};
  const requestedTab = readSearchParam(params.tab);
  const tab: DashboardTab =
    requestedTab === "play" || requestedTab === "systems" || requestedTab === "debug" ? requestedTab : "overview";

  const user = session.user;
  const accessibleSystems = await prisma.system.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        {
          groups: {
            some: {
              memberships: {
                some: {
                  userId: user.id,
                },
              },
            },
          },
        },
      ],
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });

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
          characters: {
            where: {
              ownerUserId: user.id,
            },
            orderBy: [{ createdAt: "desc" }],
            select: {
              id: true,
              name: true,
              description: true,
              files: {
                where: { isListed: true },
                orderBy: [{ createdAt: "desc" }],
                select: {
                  id: true,
                  label: true,
                  originalFileName: true,
                  createdAt: true,
                  extractionStatus: true,
                  extractedTextLength: true,
                },
              },
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
                  extractionStatus: true,
                  extractedTextLength: true,
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

  const authUrl = process.env.AUTH_URL?.trim() ?? "";
  const baseUrl = authUrl !== "" ? authUrl : "http://localhost:3000";
  const selectedSystemId = readSearchParam(params.system);
  const selectedSystem =
    systems.find((system) => system.id === selectedSystemId) ??
    systems[0] ??
    null;

  const statCards = [
    { label: "Accessible systems", value: accessibleSystems.length, tone: "from-[#1f7666] to-[#16394a]" },
    { label: "Joined groups", value: memberships.length, tone: "from-[#2f5ca8] to-[#1f2f63]" },
    { label: "Owned systems", value: systems.length, tone: "from-[#925a22] to-[#4b2514]" },
    {
      label: "Current mode",
      value: user.gmEnabled === true ? "GM" : "Player",
      tone: "from-[#4c2f73] to-[#1f173d]",
    },
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(74,222,128,0.10),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(125,211,252,0.12),_transparent_24%),linear-gradient(180deg,_#08111f_0%,_#09111a_48%,_#060b12_100%)] px-4 py-4 text-[#edf4ff] sm:px-6">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-[1600px] gap-4 lg:grid-cols-[290px_minmax(0,1fr)]">
        <aside className="rounded-[30px] border border-white/10 bg-[#09111d]/88 p-4 shadow-[0_24px_80px_rgba(1,7,16,0.45)] backdrop-blur">
          <div className="flex items-center gap-3 rounded-[24px] border border-white/8 bg-[#101a2d] px-3 py-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_#7dd3c8,_#4f7cff)] text-sm font-semibold tracking-[0.18em] text-[#08111f]">
              PNP
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-[#7dd3c8]">Placeholder</p>
              <p className="mt-1 text-lg font-semibold tracking-tight text-white">PnPScribe</p>
            </div>
          </div>

          <div className="mt-6 rounded-[24px] border border-white/8 bg-[#0d1728]/90 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#6b7a97]">Workspace</p>
            <nav className="mt-3 grid gap-1.5">
              {(["overview", "play", "systems", "debug"] as DashboardTab[]).map((item) => {
                const label =
                  item === "overview" ? "Overview" : item === "play" ? "Play" : item === "systems" ? "Systems" : "Debug";

                return (
                  <Link
                    key={item}
                    href={getDashboardHref(item, selectedSystem?.id)}
                    className={cx(
                      "rounded-2xl px-3 py-2.5 text-sm transition",
                      tab === item
                        ? "bg-[linear-gradient(135deg,_rgba(125,211,200,0.22),_rgba(79,124,255,0.18))] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                        : "text-[#9eb0cf] hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="mt-4 rounded-[24px] border border-white/8 bg-[#0d1728]/90 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#6b7a97]">System Tree</p>
              <span className="text-[11px] text-[#6b7a97]">{systems.length}</span>
            </div>

            {systems.length === 0 ? (
              <p className="mt-3 text-sm text-[#7f8ca7]">No owned systems yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {systems.map((system) => {
                  const isActive = selectedSystem?.id === system.id;
                  return (
                    <li key={system.id} className="rounded-2xl border border-white/6 bg-[#0a1321]/80 p-2.5">
                      <Link
                        href={getDashboardHref("systems", system.id)}
                        className={cx(
                          "flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm transition",
                          isActive ? "bg-white/8 text-white" : "text-[#dbe5f6] hover:bg-white/6",
                        )}
                      >
                        <span className="truncate">[SYS] {system.name}</span>
                        <span className="text-[11px] text-[#7f8ca7]">{system._count.groups}</span>
                      </Link>
                      {system.groups.length > 0 ? (
                        <ul className="mt-2 space-y-1 border-l border-white/8 pl-3">
                          {system.groups.slice(0, 6).map((group) => (
                            <li key={group.id}>
                              <Link
                                href={`/groups/${group.id}`}
                                className="block rounded-lg px-2 py-1.5 text-xs text-[#9eb0cf] transition hover:bg-white/5 hover:text-white"
                              >
                                [GRP] {group.name}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="mt-4 rounded-[24px] border border-white/8 bg-[#0d1728]/90 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#6b7a97]">Joined Games</p>
              <span className="text-[11px] text-[#6b7a97]">{memberships.length}</span>
            </div>

            {memberships.length === 0 ? (
              <p className="mt-3 text-sm text-[#7f8ca7]">No accepted invites yet.</p>
            ) : (
              <ul className="mt-3 space-y-1.5">
                {memberships.slice(0, 8).map((membership) => (
                  <li key={membership.id}>
                    <Link
                      href={`/groups/${membership.group.id}`}
                      className="flex items-center justify-between gap-3 rounded-xl px-2 py-2 text-sm text-[#dbe5f6] transition hover:bg-white/5 hover:text-white"
                    >
                      <span className="truncate">{membership.group.name}</span>
                      <span className="text-[11px] uppercase tracking-[0.16em] text-[#7f8ca7]">{membership.role}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>

        <div className="flex min-h-0 flex-col gap-4">
          <header className="rounded-[30px] border border-white/10 bg-[#09111d]/88 px-5 py-5 shadow-[0_24px_80px_rgba(1,7,16,0.45)] backdrop-blur">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-3xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#7dd3c8]">
                  {tab === "overview"
                    ? "Command Deck"
                    : tab === "play"
                      ? "Player Workspace"
                      : tab === "systems"
                        ? "System Workshop"
                        : "Inspection Bay"}
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                  {tab === "overview"
                    ? "A cleaner dashboard for your campaign stack"
                    : tab === "play"
                      ? "Characters, groups, and player-side context"
                      : tab === "systems"
                        ? "Build and manage owned systems like a file tree"
                        : "Inspect ingestion, chunks, entities, and meta index output"}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#95a5c2]">
                  Signed in as {user.email}. {user.gmEnabled === true ? "GM mode enabled." : "Player mode active."}
                  {selectedSystem != null ? ` Focus system: ${selectedSystem.name}.` : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href="/settings"
                  className="inline-flex h-11 items-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white transition hover:bg-white/10"
                >
                  Settings
                </Link>
                <SignOutForm />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {(["overview", "play", "systems", "debug"] as DashboardTab[]).map((item) => {
                const label =
                  item === "overview" ? "Overview" : item === "play" ? "Play" : item === "systems" ? "Systems" : "Debug";
                return (
                  <Link
                    key={item}
                    href={getDashboardHref(item, selectedSystem?.id)}
                    className={cx(
                      "rounded-full px-4 py-2 text-sm transition",
                      tab === item
                        ? "bg-white text-[#08111f]"
                        : "border border-white/8 bg-white/4 text-[#b7c5de] hover:bg-white/8 hover:text-white",
                    )}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          </header>

          {tab === "overview" ? (
            <div className="grid gap-4">
              <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {statCards.map((card) => (
                  <div
                    key={card.label}
                    className={cx(
                      "rounded-[26px] border border-white/10 bg-gradient-to-br p-5 shadow-[0_20px_70px_rgba(4,8,20,0.34)]",
                      card.tone,
                    )}
                  >
                    <p className="text-[11px] uppercase tracking-[0.22em] text-white/70">{card.label}</p>
                    <p className="mt-4 text-3xl font-semibold tracking-tight text-white">{card.value}</p>
                  </div>
                ))}
              </section>

              <DashboardPanel
                title="Rules Ask"
                eyebrow="Assistant"
                aside={<span className="text-xs text-[#7f8ca7]">{accessibleSystems.length} accessible systems</span>}
              >
                <RulesAskPanel systems={accessibleSystems} />
              </DashboardPanel>

              <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
                <DashboardPanel title="Current Focus" eyebrow="Overview">
                  {selectedSystem != null ? (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/8 bg-[#0a1321]/80 p-4">
                        <p className="text-xl font-semibold text-white">{selectedSystem.name}</p>
                        <p className="mt-2 text-sm text-[#95a5c2]">
                          {formatCount(selectedSystem._count.documents, "document")} •{" "}
                          {formatCount(selectedSystem._count.entities, "entity")} •{" "}
                          {formatCount(selectedSystem._count.groups, "group")}
                        </p>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {selectedSystem.groups.slice(0, 4).map((group) => (
                          <Link
                            key={group.id}
                            href={`/groups/${group.id}`}
                            className="rounded-2xl border border-white/8 bg-[#0a1321]/80 p-4 transition hover:bg-white/6"
                          >
                            <p className="text-sm font-medium text-white">{group.name}</p>
                            <p className="mt-2 text-xs text-[#7f8ca7]">
                              {formatCount(group._count.memberships, "member")} •{" "}
                              {formatCount(group.characters.length, "character")}
                            </p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[#95a5c2]">Create a system to anchor the workspace.</p>
                  )}
                </DashboardPanel>

                <DashboardPanel title="Mode Notes" eyebrow="Account">
                  <div className="rounded-2xl border border-white/8 bg-[#0a1321]/80 p-4 text-sm text-[#c8d4e8]">
                    {user.gmEnabled === true ? (
                      <p>
                        GM mode is active. Use the <span className="text-white">Systems</span> tab to create systems,
                        upload rulebooks, manage groups, and issue invite links.
                      </p>
                    ) : (
                      <p>
                        Player mode is active. Use the <span className="text-white">Play</span> tab to manage character
                        files and ask system-aware character questions. GM mode can be enabled later.
                      </p>
                    )}
                  </div>
                </DashboardPanel>
              </div>
            </div>
          ) : null}

          {tab === "play" ? (
            <DashboardPanel
              title="Your Groups"
              eyebrow="Play"
              aside={<span className="text-xs text-[#7f8ca7]">{memberships.length} memberships</span>}
            >
              {memberships.length === 0 ? (
                <p className="text-sm text-[#95a5c2]">
                  You have not joined any groups yet. Accept an invite link from a GM to appear here.
                </p>
              ) : (
                <ul className="space-y-4">
                  {memberships.map((membership) => {
                    const ownerName = membership.group.owner.name?.trim() ?? "";
                    const ownerLabel = ownerName !== "" ? ownerName : membership.group.owner.email;

                    return (
                      <li key={membership.id} className="rounded-[24px] border border-white/8 bg-[#0a1321]/82 p-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <Link
                              href={`/groups/${membership.group.id}`}
                              className="text-base font-semibold text-white underline decoration-white/10 underline-offset-4 hover:text-[#d6e5ff]"
                            >
                              {membership.group.name}
                            </Link>
                            <p className="mt-1 text-sm text-[#7f8ca7]">{membership.group.system.name}</p>
                          </div>
                          <p className="text-[11px] uppercase tracking-[0.22em] text-[#7dd3c8]">{membership.role}</p>
                        </div>

                        {membership.group.description != null && membership.group.description !== "" ? (
                          <p className="mt-3 text-sm text-[#9eb0cf]">{membership.group.description}</p>
                        ) : null}

                        <p className="mt-3 text-xs text-[#7f8ca7]">
                          GM: {ownerLabel} • {membership.group._count.memberships} members • joined{" "}
                          {membership.createdAt.toLocaleString()}
                        </p>

                        <div className="mt-4 rounded-[22px] border border-white/8 bg-[#0d1728]/90 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7dd3c8]">
                              Characters
                            </p>
                            <span className="text-xs text-[#7f8ca7]">{membership.group.characters.length} current</span>
                          </div>

                          <form action={createCharacter} className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
                            <input type="hidden" name="groupId" value={membership.group.id} />
                            <input
                              type="text"
                              name="name"
                              placeholder="New character name"
                              maxLength={120}
                              required
                              className="h-11 rounded-2xl border border-white/10 bg-[#08111f] px-3 text-sm text-white outline-none placeholder:text-[#61708b] focus:border-[#7dd3c8]"
                            />
                            <input
                              type="text"
                              name="description"
                              placeholder="Optional description"
                              maxLength={500}
                              className="h-11 rounded-2xl border border-white/10 bg-[#08111f] px-3 text-sm text-white outline-none placeholder:text-[#61708b] focus:border-[#7dd3c8]"
                            />
                            <button
                              type="submit"
                              className="h-11 rounded-2xl bg-[linear-gradient(135deg,_#7dd3c8,_#7ca7ff)] px-4 text-sm font-medium text-[#08111f] hover:opacity-90"
                            >
                              Create Character
                            </button>
                          </form>

                          {membership.group.characters.length === 0 ? (
                            <p className="mt-4 text-sm text-[#7f8ca7]">No characters yet.</p>
                          ) : (
                            <ul className="mt-4 space-y-3">
                              {membership.group.characters.map((character) => (
                                <li key={character.id} className="rounded-2xl border border-white/8 bg-[#08111f] p-4">
                                  <Link
                                    href={`/characters/${character.id}`}
                                    className="text-sm font-semibold text-white underline decoration-white/10 underline-offset-4 hover:text-[#d6e5ff]"
                                  >
                                    {character.name}
                                  </Link>
                                  {character.description != null && character.description !== "" ? (
                                    <p className="mt-2 text-xs text-[#95a5c2]">{character.description}</p>
                                  ) : null}
                                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                                    <CharacterFileManager
                                      characterId={character.id}
                                      canManage={true}
                                      detailHref={`/characters/${character.id}`}
                                      files={character.files.map((file) => ({
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
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </DashboardPanel>
          ) : null}

          {tab === "systems" ? (
            user.gmEnabled === true ? (
              <div className="grid gap-4">
                <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <DashboardPanel title="Create System" eyebrow="GM Tools">
                    <form action={createOwnedSystem} className="flex flex-col gap-3 sm:flex-row">
                      <input
                        type="text"
                        name="name"
                        placeholder="e.g. Pathfinder 2e"
                        maxLength={120}
                        required
                        className="h-11 flex-1 rounded-2xl border border-white/10 bg-[#08111f] px-3 text-sm text-white outline-none placeholder:text-[#61708b] focus:border-[#7dd3c8]"
                      />
                      <button
                        type="submit"
                        className="h-11 rounded-2xl bg-[linear-gradient(135deg,_#7dd3c8,_#7ca7ff)] px-4 text-sm font-medium text-[#08111f] hover:opacity-90"
                      >
                        Create
                      </button>
                    </form>
                  </DashboardPanel>

                  <DashboardPanel title="System Focus" eyebrow="Selected System">
                    {selectedSystem != null ? (
                      <div className="grid gap-3 md:grid-cols-3">
                        <div className="rounded-2xl border border-white/8 bg-[#08111f] p-4">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-[#7dd3c8]">Documents</p>
                          <p className="mt-3 text-3xl font-semibold text-white">{selectedSystem._count.documents}</p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-[#08111f] p-4">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-[#7dd3c8]">Entities</p>
                          <p className="mt-3 text-3xl font-semibold text-white">{selectedSystem._count.entities}</p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-[#08111f] p-4">
                          <p className="text-[10px] uppercase tracking-[0.22em] text-[#7dd3c8]">Groups</p>
                          <p className="mt-3 text-3xl font-semibold text-white">{selectedSystem._count.groups}</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-[#95a5c2]">Select a system from the left tree.</p>
                    )}
                  </DashboardPanel>
                </div>

                {selectedSystem != null ? (
                  <DashboardPanel
                    title={selectedSystem.name}
                    eyebrow="System Workspace"
                    aside={<span className="text-xs text-[#7f8ca7]">{selectedSystem.createdAt.toLocaleString()}</span>}
                  >
                    <div className="rounded-[22px] border border-white/8 bg-[#0d1728]/90 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7dd3c8]">Groups</p>
                        <span className="text-xs text-[#7f8ca7]">{selectedSystem.groups.length} total</span>
                      </div>

                      <form action={createSystemGroup} className="mt-3 grid gap-2 lg:grid-cols-[1fr_1fr_auto]">
                        <input type="hidden" name="systemId" value={selectedSystem.id} />
                        <input
                          type="text"
                          name="name"
                          placeholder="New group name"
                          maxLength={120}
                          required
                          className="h-11 rounded-2xl border border-white/10 bg-[#08111f] px-3 text-sm text-white outline-none placeholder:text-[#61708b] focus:border-[#7dd3c8]"
                        />
                        <input
                          type="text"
                          name="description"
                          placeholder="Optional description"
                          maxLength={500}
                          className="h-11 rounded-2xl border border-white/10 bg-[#08111f] px-3 text-sm text-white outline-none placeholder:text-[#61708b] focus:border-[#7dd3c8]"
                        />
                        <button
                          type="submit"
                          className="h-11 rounded-2xl bg-[#7ca7ff] px-4 text-sm font-medium text-[#08111f] hover:bg-[#93b7ff]"
                        >
                          Create Group
                        </button>
                      </form>

                      {selectedSystem.groups.length === 0 ? (
                        <p className="mt-4 text-sm text-[#7f8ca7]">No groups yet.</p>
                      ) : (
                        <ul className="mt-4 space-y-4">
                          {selectedSystem.groups.map((group) => (
                            <li key={group.id} className="rounded-2xl border border-white/8 bg-[#08111f] p-4">
                              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                                <div>
                                  <Link
                                    href={`/groups/${group.id}`}
                                    className="text-sm font-semibold text-white underline decoration-white/10 underline-offset-4 hover:text-[#d6e5ff]"
                                  >
                                    {group.name}
                                  </Link>
                                  {group.description != null && group.description !== "" ? (
                                    <p className="mt-2 text-xs text-[#95a5c2]">{group.description}</p>
                                  ) : null}
                                  <p className="mt-2 text-xs text-[#7f8ca7]">
                                    {group._count.memberships} members • {group._count.inviteLinks} invite links
                                  </p>
                                </div>
                                <form action={createGroupInvite}>
                                  <input type="hidden" name="groupId" value={group.id} />
                                  <button
                                    type="submit"
                                    className="h-10 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs text-white hover:bg-white/10"
                                  >
                                    Create Invite Link
                                  </button>
                                </form>
                              </div>

                              {group.inviteLinks.length > 0 ? (
                                <div className="mt-3 space-y-2">
                                  {group.inviteLinks.map((invite) => (
                                    <div key={invite.id} className="rounded-2xl border border-white/8 bg-[#0d1728]/90 px-3 py-3 text-xs text-[#cdd9eb]">
                                      <p className="text-[#7f8ca7]">{invite.createdAt.toLocaleString()}</p>
                                      <p className="mt-1 break-all text-white">{`${baseUrl}/invite/${invite.token}`}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              <div className="mt-4 grid gap-4 xl:grid-cols-2">
                                <div className="rounded-2xl border border-white/8 bg-[#0d1728]/90 p-4">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7dd3c8]">
                                    Members
                                  </p>
                                  {group.memberships.length === 0 ? (
                                    <p className="mt-3 text-sm text-[#7f8ca7]">No accepted members yet.</p>
                                  ) : (
                                    <ul className="mt-3 space-y-2">
                                      {group.memberships.map((membership) => {
                                        const memberName = membership.user.name?.trim() ?? "";
                                        const memberLabel = memberName !== "" ? memberName : membership.user.email;

                                        return (
                                          <li key={membership.id} className="rounded-xl border border-white/8 bg-[#08111f] px-3 py-2 text-xs text-[#dbe5f6]">
                                            <p className="text-white">{memberLabel}</p>
                                            <p className="mt-1 text-[#7f8ca7]">
                                              {membership.role} • joined {membership.createdAt.toLocaleString()}
                                            </p>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </div>

                                <div className="rounded-2xl border border-white/8 bg-[#0d1728]/90 p-4">
                                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#7dd3c8]">
                                    Characters
                                  </p>
                                  {group.characters.length === 0 ? (
                                    <p className="mt-3 text-sm text-[#7f8ca7]">No characters in this group yet.</p>
                                  ) : (
                                    <ul className="mt-3 space-y-3">
                                      {group.characters.map((character) => {
                                        const ownerName = character.ownerUser.name?.trim() ?? "";
                                        const ownerLabel = ownerName !== "" ? ownerName : character.ownerUser.email;

                                        return (
                                          <li key={character.id} className="rounded-xl border border-white/8 bg-[#08111f] p-3 text-xs text-[#dbe5f6]">
                                            <Link
                                              href={`/characters/${character.id}`}
                                              className="text-sm font-semibold text-white underline decoration-white/10 underline-offset-4 hover:text-[#d6e5ff]"
                                            >
                                              {character.name}
                                            </Link>
                                            <p className="mt-1 text-[#7f8ca7]">Owner: {ownerLabel}</p>
                                            {character.description != null && character.description !== "" ? (
                                              <p className="mt-2 text-[#95a5c2]">{character.description}</p>
                                            ) : null}
                                            <div className="mt-3 grid gap-3">
                                              <CharacterFileManager
                                                characterId={character.id}
                                                canManage={true}
                                                detailHref={`/characters/${character.id}`}
                                                files={character.files.map((file) => ({
                                                  ...file,
                                                  createdAt: file.createdAt.toLocaleString(),
                                                }))}
                                              />
                                            </div>
                                          </li>
                                        );
                                      })}
                                    </ul>
                                  )}
                                </div>
                              </div>

                              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                                <CharacterAskPanel
                                  characterId={group.id}
                                  title="Ask About Group Character Context"
                                  endpoint="/api/groups/:id/ask-characters"
                                />
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </DashboardPanel>
                ) : null}

                <DocumentUploadPanel systems={systems} />
              </div>
            ) : (
              <DashboardPanel title="GM Mode Required" eyebrow="Systems">
                <p className="text-sm text-[#95a5c2]">
                  Your account is currently in player mode. GM mode is still admin-managed, so the system workspace
                  stays read-only for now.
                </p>
              </DashboardPanel>
            )
          ) : null}

          {tab === "debug" ? (
            user.gmEnabled === true ? (
              <div className="grid gap-4">
                <DashboardPanel title="Index and Extraction Debug" eyebrow="Inspection">
                  <p className="text-sm text-[#95a5c2]">
                    Use this area to inspect chunks, rerun OCR, build the entity meta index, and verify extraction
                    output against the selected system tree.
                  </p>
                </DashboardPanel>
                <ChunkDebugPanel systems={systems} />
                <EntitiesDebugPanel systems={systems} />
              </div>
            ) : (
              <DashboardPanel title="Debug Locked" eyebrow="Inspection">
                <p className="text-sm text-[#95a5c2]">Debug tooling is currently limited to GM mode.</p>
              </DashboardPanel>
            )
          ) : null}
        </div>
      </div>
    </main>
  );
}
