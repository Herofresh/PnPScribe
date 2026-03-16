"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

export function LoginForm({ allowGoogle }: { allowGoogle: boolean }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCredentialsLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (typeof result?.error === "string" && result.error.length > 0) {
      setError("Login failed. Check your email and password.");
      setSubmitting(false);
      return;
    }

    window.location.href = "/";
  }

  async function handleGoogleLogin() {
    setSubmitting(true);
    setError(null);
    await signIn("google", { callbackUrl: "/" });
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl shadow-zinc-950/40">
      <div className="mb-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">PnPScribe</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Login</h1>
        <p className="text-sm text-zinc-400">Sign in to access your systems and uploads.</p>
      </div>

      <form onSubmit={handleCredentialsLogin} className="space-y-3">
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          autoComplete="email"
          required
          className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          required
          className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={submitting}
          className="h-11 w-full rounded-lg bg-emerald-400 px-4 text-sm font-medium text-zinc-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Sign In"}
        </button>
      </form>

      {allowGoogle ? (
        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={submitting}
          className="mt-3 h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-4 text-sm font-medium text-zinc-100 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue with Google
        </button>
      ) : null}

      {error !== null ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      <p className="mt-5 text-sm text-zinc-400">
        No account yet?{" "}
        <a href="/register" className="text-zinc-100 underline decoration-zinc-700 underline-offset-2">
          Create one
        </a>
      </p>
    </div>
  );
}
