"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientFetch } from "@/lib/http/clientFetch";
import { useMemo, useState } from "react";

type Doc = {
  id: string;
  filename: string;
  createdAt: string;
  processed: boolean;
};

export default function DocumentsList({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["csg", "documents", projectId],
    queryFn: async () => {
      return clientFetch<{ ok: true; documents: Doc[] }>(
        `/api/projects/${projectId}/documents`,
      );
    },
  });

  const docs = data?.documents ?? [];

  // Seleziona automaticamente il primo processed (se presente)
  const defaultSelected = useMemo(() => {
    const firstProcessed = docs.find((d) => d.processed)?.id ?? null;
    return firstProcessed;
  }, [docs]);

  // inizializza selezione se nulla
  if (!selectedId && defaultSelected) {
    // safe in render: ok perché setState sync qui può dare warning in strict;
    // se vuoi super clean, lo sposto in useEffect.
    // ma per ora: facciamolo bene:
  }

  // ✅ versione clean: useEffect
  // (lascio qui sotto)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const React = require("react");
  // eslint-disable-next-line react-hooks/rules-of-hooks
  React.useEffect(() => {
    if (!selectedId && defaultSelected) setSelectedId(defaultSelected);
  }, [defaultSelected, selectedId]);

  const processMutation = useMutation({
    mutationFn: async (documentId: string) => {
      return clientFetch(
        `/api/projects/${projectId}/documents/${documentId}/process`,
        { method: "POST" },
      );
    },
    onSuccess: async (_data, documentId) => {
      await qc.invalidateQueries({ queryKey: ["csg", "documents", projectId] });
      setSelectedId(documentId); // dopo process seleziona quel doc
    },
  });

  const textQuery = useQuery({
    queryKey: ["csg", "document-text", projectId, selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      return clientFetch<{ ok: true; text: string }>(
        `/api/projects/${projectId}/documents/${selectedId}/text`,
      );
    },
  });

  if (isLoading) {
    return <div className="h-24 animate-pulse rounded-2xl bg-zinc-100" />;
  }

  if (docs.length === 0) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-sm">
        Nessun documento caricato.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* LISTA */}
      <ul className="divide-y divide-zinc-100 rounded-2xl border border-zinc-200 bg-white">
        {docs.map((d) => {
          const active = d.id === selectedId;
          return (
            <li
              key={d.id}
              className={[
                "flex items-center justify-between gap-4 px-4 py-3 cursor-pointer",
                active ? "bg-zinc-50" : "hover:bg-zinc-50",
              ].join(" ")}
              onClick={() => setSelectedId(d.id)}
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{d.filename}</div>
                <div className="text-xs text-zinc-500">
                  {new Date(d.createdAt).toLocaleString("it-IT")}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {d.processed ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                    Processed
                  </span>
                ) : (
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600">
                    Raw
                  </span>
                )}

                <button
                  type="button"
                  disabled={d.processed || processMutation.isPending}
                  onClick={(e) => {
                    e.stopPropagation();
                    processMutation.mutate(d.id);
                  }}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold hover:bg-zinc-50 disabled:opacity-50"
                >
                  {d.processed ? "Estratto" : "Estrai"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {/* PREVIEW */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Preview testo estratto</p>
            <p className="mt-1 text-xs text-zinc-500">
              Seleziona un documento. La preview appare solo se “Processed”.
            </p>
          </div>
        </div>

        <div className="mt-3">
          {selectedId ? (
            textQuery.isLoading ? (
              <div className="h-40 animate-pulse rounded-xl bg-zinc-100" />
            ) : textQuery.isError ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                {(textQuery.error as Error).message}
              </div>
            ) : (
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-800">
                {(textQuery.data?.text ?? "").slice(0, 2000)}
                {(textQuery.data?.text ?? "").length > 2000 ? "\n\n..." : ""}
              </pre>
            )
          ) : (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              Nessun documento selezionato.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
