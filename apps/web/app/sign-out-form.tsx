import { signOut } from "@/auth";

export function SignOutForm() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="h-10 rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 hover:border-zinc-500"
      >
        Sign Out
      </button>
    </form>
  );
}
