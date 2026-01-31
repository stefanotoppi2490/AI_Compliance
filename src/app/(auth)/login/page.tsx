"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { clientFetch } from "@/lib/http/clientFetch";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setPending(true);
    try {
      await clientFetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      router.push("/dashboard");
    } catch (e) {
      setErr((e as Error).message || "Login failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="text-center">
            <div className="text-xl font-extrabold tracking-tight text-zinc-900">
              Accedi
            </div>
            <div className="mt-1 text-sm text-zinc-500">
              Gestisci preventivi, rischi e scope.
            </div>
          </div>

          {err && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {err}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-6 space-y-3">
            <div>
              <label className="text-xs font-semibold text-zinc-700">
                Email
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                autoComplete="email"
                required
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 text-black"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-zinc-700">
                Password
              </label>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="current-password"
                required
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 text-black"
                placeholder="••••••••"
              />
            </div>

            <button
              disabled={pending}
              type="submit"
              className="mt-2 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {pending ? "Accesso..." : "Login"}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-zinc-600">
            Non hai un account?{" "}
            <a
              className="font-semibold text-zinc-900 hover:underline"
              href="/register"
            >
              Registrati
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
