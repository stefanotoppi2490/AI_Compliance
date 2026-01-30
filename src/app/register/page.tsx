"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return email.trim().length > 3 && password.length >= 8 && !loading;
  }, [email, password, loading]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setErr(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          name: name.trim() ? name.trim() : null,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data?.ok) {
        setErr(data?.message ?? "Registrazione fallita");
        return;
      }

      // se register crea anche la sessione + cookie, vai diretto
      router.push("/dashboard");
      router.refresh();
    } catch {
      setErr("Errore di rete");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-50 text-zinc-900 antialiased">
      <div className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-10 px-6 py-10 lg:grid-cols-2">
        {/* Left: marketing */}
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 shadow-sm">
            <span className="inline-block size-2 rounded-full bg-emerald-500" />
            Client Scope Guard
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 sm:text-5xl">
            Crea un account
          </h1>

          <p className="max-w-xl text-base leading-relaxed text-zinc-600">
            Parti in 2 minuti: registrati, crea un progetto, carica un
            preventivo/contratto e verifica subito se una richiesta cliente è{" "}
            <span className="font-semibold">in scope</span> o{" "}
            <span className="font-semibold">out of scope</span>.
          </p>

          <div className="grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
            <Feature label="Upload DOCX/PDF" />
            <Feature label="Scope bullets" />
            <Feature label="Verdetto + citazioni" />
          </div>

          <div className="text-sm text-zinc-600">
            Hai già un account?{" "}
            <Link
              href="/login"
              className="font-semibold text-zinc-900 underline underline-offset-4"
            >
              Accedi
            </Link>
          </div>
        </section>

        {/* Right: card */}
        <section className="relative">
          <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-br from-zinc-200/70 via-zinc-100 to-transparent blur-2xl" />
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <h2 className="text-xl font-bold">Registrazione</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Crea le credenziali per accedere alla dashboard.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Nome (opzionale)
                </label>
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  type="text"
                  autoComplete="name"
                  placeholder="Stefano"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">
                  Email
                </label>
                <input
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100"
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
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 8 caratteri"
                  required
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Suggerimento: usa almeno 8 caratteri (meglio 12+).
                </p>
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
                {loading ? "Creazione..." : "Crea account"}
                <span className="transition group-hover:translate-x-0.5">
                  →
                </span>
              </button>

              <div className="text-xs text-zinc-500">
                Registrandoti accetti i Termini e la Privacy (li aggiungiamo
                dopo).
              </div>
            </form>

            <div className="mt-6 border-t border-zinc-200 pt-5 text-sm text-zinc-600">
              Hai già un account?{" "}
              <Link
                href="/login"
                className="font-semibold text-zinc-900 underline underline-offset-4"
              >
                Accedi
              </Link>
            </div>
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
