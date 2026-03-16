"use client";

import { FormEvent, useState } from "react";
import { signIn } from "next-auth/react";

type RegisterResponse = {
  ok: boolean;
  error?: string;
};

export function RegisterForm({ callbackUrl }: { callbackUrl: string }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = (await response.json()) as RegisterResponse;

      if (!response.ok || !data.ok) {
        setError(data.error ?? "Registration failed.");
        setSubmitting(false);
        return;
      }

      const signInResult = await signIn("credentials", {
        email,
        password,
        redirect: false,
        callbackUrl,
      });

      if (typeof signInResult?.error === "string" && signInResult.error.length > 0) {
        setError("Account created, but login failed. Please sign in manually.");
        setSubmitting(false);
        return;
      }

      window.location.href = signInResult?.url ?? callbackUrl;
    } catch {
      setError("Registration request failed.");
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-2xl shadow-zinc-950/40">
      <div className="mb-6 space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-zinc-500">PnPScribe</p>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-100">Create Account</h1>
        <p className="text-sm text-zinc-400">
          The first registered account is bootstrapped as GM-enabled so the app has an owner.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Name (optional)"
          autoComplete="name"
          className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
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
          autoComplete="new-password"
          minLength={8}
          required
          className="h-11 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 outline-none focus:border-zinc-500"
        />
        <button
          type="submit"
          disabled={submitting}
          className="h-11 w-full rounded-lg bg-sky-400 px-4 text-sm font-medium text-zinc-950 hover:bg-sky-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Creating account..." : "Create Account"}
        </button>
      </form>

      {error !== null ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}

      <p className="mt-5 text-sm text-zinc-400">
        Already have an account?{" "}
        <a
          href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="text-zinc-100 underline decoration-zinc-700 underline-offset-2"
        >
          Sign in
        </a>
      </p>
    </div>
  );
}
