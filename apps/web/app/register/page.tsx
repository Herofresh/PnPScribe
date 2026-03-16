import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { RegisterForm } from "@/app/register/register-form";

export default async function RegisterPage() {
  const session = await auth();

  if (session?.user?.id != null && session.user.id !== "") {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-10">
      <RegisterForm />
    </main>
  );
}
