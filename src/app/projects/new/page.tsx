"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { clientFetch } from "@/lib/http/clientFetch";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function NewProjectPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      return clientFetch<{ ok: true; project: { id: string; name: string } }>(
        "/api/projects",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name }),
        },
      );
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["csg", "projects"] });
      router.push(`/projects/${data.project.id}`);
      router.refresh();
    },
  });

  const can = name.trim().length >= 2 && !createMutation.isPending;

  return (
    <main className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight">
            Nuovo progetto
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Un progetto = un cliente o un contratto (per ora).
          </p>

          <div className="mt-6">
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Nome progetto
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-zinc-300 focus:ring-4 focus:ring-zinc-100"
              placeholder="Es. Preventivo Caccavo 2026"
            />
          </div>

          {createMutation.isError ? (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {(createMutation.error as Error).message}
            </div>
          ) : null}

          <button
            disabled={!can}
            onClick={() => createMutation.mutate()}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {createMutation.isPending ? "Creazione..." : "Crea progetto →"}
          </button>
        </div>
      </div>
    </main>
  );
}
