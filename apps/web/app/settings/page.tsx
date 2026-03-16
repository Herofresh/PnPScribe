import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignOutForm } from "@/app/sign-out-form";
import { prisma } from "@/lib/prisma";

async function updateProfile(formData: FormData) {
  "use server";

  const session = await auth();
  const userId = session?.user?.id;

  if (userId == null || userId === "") {
    redirect("/login");
  }

  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName.trim().slice(0, 120) : "";

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: name === "" ? null : name,
    },
  });

  revalidatePath("/settings");
  revalidatePath("/");
}

export default async function SettingsPage() {
  const session = await auth();

  if (session?.user?.id == null || session.user.id === "") {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      gmEnabled: true,
      createdAt: true,
      _count: {
        select: {
          systemsOwned: true,
          groupsOwned: true,
          groupMemberships: true,
          createdInvites: true,
        },
      },
    },
  });

  if (user == null) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">PnPScribe</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">Settings</h1>
            <p className="text-sm text-zinc-400">Account and access basics for the new multi-user flow.</p>
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

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="mb-4 text-sm font-medium text-zinc-200">Profile</h2>
          <form action={updateProfile} className="flex flex-col gap-3">
            <label className="text-xs uppercase tracking-[0.15em] text-zinc-500">Display name</label>
            <input
              type="text"
              name="name"
              defaultValue={user.name ?? ""}
              placeholder="Your display name"
              maxLength={120}
              className="h-11 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
            />
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300">
              <span className="text-zinc-500">Email:</span> {user.email}
            </div>
            <button
              type="submit"
              className="h-11 w-fit rounded-lg bg-sky-400 px-4 text-sm font-medium text-zinc-950 hover:bg-sky-300"
            >
              Save profile
            </button>
          </form>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="mb-4 text-sm font-medium text-zinc-200">Access</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Mode</p>
              <p className="mt-2 text-sm text-zinc-100">{user.gmEnabled ? "GM enabled" : "Player only"}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Account created</p>
              <p className="mt-2 text-sm text-zinc-100">{user.createdAt.toLocaleString()}</p>
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-400">
            GM mode is still admin-managed for now. Use the CLI helper to enable it for a user when needed.
          </p>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <h2 className="mb-4 text-sm font-medium text-zinc-200">Workspace Summary</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Owned systems</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">{user._count.systemsOwned}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Owned groups</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">{user._count.groupsOwned}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Memberships</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">{user._count.groupMemberships}</p>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Invite links</p>
              <p className="mt-2 text-2xl font-semibold text-zinc-100">{user._count.createdInvites}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
