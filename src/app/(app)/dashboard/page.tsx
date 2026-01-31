"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientFetch } from "@/lib/http/clientFetch";
import { useRouter } from "next/navigation";

type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["projects"],
    queryFn: async () =>
      clientFetch<{ ok: true; projects: Project[] }>("/api/projects"),
  });

  const projects = data?.projects ?? [];

  const createMutation = useMutation({
    mutationFn: async () =>
      clientFetch<{ ok: true; project: Project }>("/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name }),
      }),
    onSuccess: async (res) => {
      setOpen(false);
      setName("");
      await qc.invalidateQueries({ queryKey: ["projects"] });
      router.push(`/projects/${res.project.id}`);
    },
  });

  const stats = useMemo(() => {
    return [
      { label: "Progetti", value: projects.length },
      { label: "Preventivi", value: "—" },
      { label: "Analisi", value: "—" },
      { label: "Scope check", value: "—" },
    ];
  }, [projects.length]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-extrabold tracking-tight text-zinc-900">
            Dashboard
          </div>
          <div className="mt-1 text-sm text-zinc-500">
            Lista progetti e analisi contratti.
          </div>
        </div>

        <button
          onClick={() => setOpen(true)}
          className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800"
        >
          + Crea progetto
        </button>
      </div>

      {/* KPI cards (Velvet-ish) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-zinc-200 bg-white p-4"
          >
            <div className="text-xs font-semibold text-zinc-500">{s.label}</div>
            <div className="mt-2 text-2xl font-extrabold text-zinc-900">
              {s.value}
            </div>
          </div>
        ))}
      </div>

      {/* Projects list */}
      <div className="rounded-2xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="text-sm font-semibold text-zinc-900">
            I tuoi progetti
          </div>
          <div className="text-xs text-zinc-500">{projects.length} totali</div>
        </div>

        {isLoading ? (
          <div className="p-4">
            <div className="h-24 animate-pulse rounded-xl bg-zinc-100" />
          </div>
        ) : isError ? (
          <div className="p-4 text-sm text-red-700">
            {(error as Error).message}
          </div>
        ) : projects.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">
            Nessun progetto. Clicca “Crea progetto”.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {projects.map((p) => (
              <li
                key={p.id}
                className="cursor-pointer px-4 py-3 hover:bg-zinc-50"
                onClick={() => router.push(`/projects/${p.id}`)}
              >
                <div className="font-semibold text-zinc-900">{p.name}</div>
                <div className="mt-1 text-xs text-zinc-500">
                  Creato: {new Date(p.createdAt).toLocaleString("it-IT")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Modal create project */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="text-lg font-extrabold text-zinc-900">
              Crea progetto
            </div>
            <div className="mt-1 text-sm text-zinc-500">
              Inserisci solo il nome. Poi vai al dettaglio.
            </div>

            <div className="mt-4">
              <label className="text-xs font-semibold text-zinc-700">
                Nome progetto
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm outline-none focus:border-zinc-400 text-black"
                placeholder="Es: Preventivo Caccavo"
              />
            </div>

            {createMutation.isError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {(createMutation.error as Error).message}
              </div>
            )}

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
              >
                Annulla
              </button>
              <button
                disabled={createMutation.isPending || name.trim().length < 2}
                onClick={() => createMutation.mutate()}
                className="flex-1 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
              >
                {createMutation.isPending ? "Creo..." : "Crea"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
