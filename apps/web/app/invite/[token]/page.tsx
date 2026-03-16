import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { SignOutForm } from "@/app/sign-out-form";
import { acceptInviteLink, getInviteLinkByToken } from "@/lib/server/groups";
import { HttpError } from "@/lib/server/http-error";

async function acceptInvite(token: string) {
  "use server";

  const session = await auth();
  const userId = session?.user?.id;

  if (userId == null || userId === "") {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`);
  }

  const result = await acceptInviteLink({
    token,
    userId,
  });

  revalidatePath(`/invite/${token}`);
  revalidatePath("/");

  redirect(`/invite/${token}?accepted=1&groupId=${result.membership.groupId}`);
}

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ accepted?: string }>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const session = await auth();
  const userId = session?.user?.id ?? "";
  const isSignedIn = userId !== "";
  const sessionEmail = session?.user?.email ?? "";

  let invite: Awaited<ReturnType<typeof getInviteLinkByToken>>;
  let errorMessage: string | null = null;

  try {
    invite = await getInviteLinkByToken(token);
  } catch (error) {
    if (error instanceof HttpError) {
      errorMessage = error.message;
    } else {
      throw error;
    }

    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10 text-zinc-100">
        <div className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">PnPScribe</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-100">Invite unavailable</h1>
          <p className="mt-3 text-sm text-zinc-300">{errorMessage}</p>
          <p className="mt-4 text-sm">
            <Link href="/" className="underline decoration-zinc-700 underline-offset-2">
              Back to dashboard
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const ownerName = invite.group.owner.name?.trim() ?? "";
  const ownerLabel = ownerName !== "" ? ownerName : invite.group.owner.email;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-zinc-100">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-4 rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">PnPScribe</p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-100">Group Invite</h1>
            <p className="text-sm text-zinc-400">Join a GM-managed group using this invite link.</p>
          </div>
          {isSignedIn ? <SignOutForm /> : null}
        </header>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">System</p>
            <p className="text-xl font-semibold text-zinc-100">{invite.group.system.name}</p>
          </div>
          <div className="mt-5 space-y-2">
            <p className="text-xs uppercase tracking-[0.15em] text-zinc-500">Group</p>
            <p className="text-lg font-medium text-zinc-100">{invite.group.name}</p>
            {invite.group.description != null && invite.group.description !== "" ? (
              <p className="text-sm text-zinc-400">{invite.group.description}</p>
            ) : null}
          </div>
          <p className="mt-5 text-sm text-zinc-400">Invited by {ownerLabel}</p>
        </section>

        {!isSignedIn ? (
          <section className="rounded-2xl border border-sky-900 bg-sky-950/20 p-5 text-sm text-sky-100">
            <p>You need an account before accepting this invite.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
                className="inline-flex h-10 items-center rounded-lg bg-sky-400 px-4 text-sm font-medium text-zinc-950 hover:bg-sky-300"
              >
                Sign In
              </Link>
              <Link
                href={`/register?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
                className="inline-flex h-10 items-center rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-sm text-zinc-100 hover:border-zinc-500"
              >
                Create Account
              </Link>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            {query.accepted === "1" ? (
              <div className="rounded-lg border border-emerald-900 bg-emerald-950/20 px-4 py-3 text-sm text-emerald-200">
                You have joined the group. Return to the dashboard to see the membership in your groups list.
              </div>
            ) : (
              <>
                <p className="text-sm text-zinc-300">Signed in as {sessionEmail}</p>
                <form action={acceptInvite.bind(null, token)} className="mt-4">
                  <button
                    type="submit"
                    className="h-11 rounded-lg bg-emerald-400 px-4 text-sm font-medium text-zinc-950 hover:bg-emerald-300"
                  >
                    Accept Invite
                  </button>
                </form>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
