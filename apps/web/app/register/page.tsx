import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RegisterForm } from "@/app/register/register-form";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const params = await searchParams;
  const callbackUrl =
    typeof params.callbackUrl === "string" && params.callbackUrl.trim() !== ""
      ? params.callbackUrl
      : "/";

  if (session?.user?.id != null && session.user.id !== "") {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10">
      <RegisterForm callbackUrl={callbackUrl} />
    </main>
  );
}
