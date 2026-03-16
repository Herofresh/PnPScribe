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
        },
      },
    },
  });

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
          <SignOutForm />
        </header>

        {user.gmEnabled !== true ? (
          <section className="rounded-2xl border border-sky-900 bg-sky-950/20 p-5 text-sm text-sky-100">
            Your account is currently in player mode. GM-owned systems, group invites, and player memberships are the
            next step. Until that lands, a GM-enabled account is required to create or manage systems.
          </section>
        ) : (
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
                        {system._count.documents} documents • {system._count.entities} entities
                      </p>
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
        )}
      </div>
    </main>
  );
}
