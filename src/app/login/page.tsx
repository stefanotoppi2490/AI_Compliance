"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 1 && !loading;
  }, [email, password, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setErr(data?.message ?? "Login fallito");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErr("Errore di rete");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-2">
        {/* Left: marketing */}
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm">
            <span className="inline-block size-2 rounded-full bg-emerald-500" />
            Client Scope Guard
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
            Stop alle richieste “extra” non pagate.
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-zinc-600">
            Carichi contratto/preventivo, il sistema estrae deliverable e
            vincoli. Poi incolli una richiesta cliente e ti dice se è{" "}
            <span className="font-semibold">in scope</span>,
            <span className="font-semibold"> out of scope</span> o{" "}
            <span className="font-semibold">ambigua</span>, con motivazione e
            punti di contratto.
          </p>

          <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
            <Feature label="Scope in 1 click" />
            <Feature label="Checklist & citazioni" />
            <Feature label="Storico richieste" />
          </div>
        </section>

        {/* Right: card */}
        <section className="relative">
          <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-zinc-200/70 via-zinc-100 to-transparent blur-2xl" />
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold">Accedi</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Usa email e password. Token in cookie HttpOnly.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Email
                </label>
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Password
                </label>
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none ring-0 transition focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </div>

              {err ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {err}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!canSubmit}
                className="group inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Accesso..." : "Accedi"}
                <span className="transition group-hover:translate-x-0.5">
                  →
                </span>
              </button>

              <div className="text-xs text-zinc-500">
                Non hai un account?
                <Link
                  href="/register"
                  className="font-semibold text-zinc-900 underline underline-offset-4"
                >
                  Crea account
                </Link>
              </div>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function Feature({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm font-medium text-zinc-800 shadow-sm">
      {label}
    </div>
  );
}
