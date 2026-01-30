"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { clientFetch } from "@/lib/http/clientFetch";

type ProjectDto = { id: string; name: string; createdAt: string };

export default function ProjectsList() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ["csg", "projects"],
    queryFn: async () => {
      return clientFetch<{ ok: true; projects: ProjectDto[] }>("/api/projects");
    },
  });

  const projects = data?.projects ?? [];

  return (
    <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold">Progetti</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Crea un progetto per ogni cliente/contratto.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
            type="button"
          >
            {isFetching ? "Aggiorno..." : "Refresh"}
          </button>

          <Link
            href="/projects/new"
            className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
          >
            + Nuovo
          </Link>
        </div>
      </div>

      <div className="mt-5">
        {isLoading ? (
          <SkeletonList />
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {(error as Error).message}
          </div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700">
            Nessun progetto ancora. Clicca{" "}
            <span className="font-semibold">“Nuovo”</span> per crearne uno.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {projects.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="text-xs text-zinc-500">
                    Creato: {new Date(p.createdAt).toLocaleString("it-IT")}
                  </div>
                </div>

                <Link
                  href={`/projects/${p.id}`}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50"
                >
                  Apri →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-14 animate-pulse rounded-2xl border border-zinc-200 bg-zinc-50"
        />
      ))}
    </div>
  );
}
