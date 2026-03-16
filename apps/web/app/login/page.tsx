import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { LoginForm } from "@/app/login/login-form";

export default async function LoginPage() {
  const session = await auth();
  const isSignedIn = session?.user?.id != null && session.user.id !== "";
  const allowGoogle =
    (process.env.AUTH_GOOGLE_ID?.trim() ?? "") !== "" &&
    (process.env.AUTH_GOOGLE_SECRET?.trim() ?? "") !== "";

  if (isSignedIn) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10">
      <LoginForm allowGoogle={allowGoogle} />
    </main>
  );
}
