"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientFetch } from "@/lib/http/clientFetch";
import { useEffect, useMemo, useState } from "react";

type Doc = {
  id: string;
  filename: string;
  createdAt: string;
  processed: boolean;
};

type ScopeItem = { text: string; chunk: number };
type ScopeResult = {
  included: ScopeItem[];
  excluded: ScopeItem[];
  unclear: ScopeItem[];
  notes?: string;
};

export default function DocumentsList({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 1) Lista documenti
  const { data, isLoading } = useQuery({
    queryKey: ["csg", "documents", projectId],
    queryFn: async () =>
      clientFetch<{ ok: true; documents: Doc[] }>(
        `/api/projects/${projectId}/documents`,
      ),
  });

  const docs = data?.documents ?? [];

  // seleziona automaticamente il primo processed
  const defaultSelected = useMemo(() => {
    return docs.find((d) => d.processed)?.id ?? docs[0]?.id ?? null;
  }, [docs]);

  useEffect(() => {
    if (!selectedId && defaultSelected) setSelectedId(defaultSelected);
  }, [defaultSelected, selectedId]);

  const selectedDoc = useMemo(() => {
    return docs.find((d) => d.id === selectedId) ?? null;
  }, [docs, selectedId]);

  // 2) Process DOC (estrae testo+chunks)
  const processMutation = useMutation({
    mutationFn: async (documentId: string) =>
      clientFetch(
        `/api/projects/${projectId}/documents/${documentId}/process`,
        {
          method: "POST",
        },
      ),
    onSuccess: async (_data, documentId) => {
      await qc.invalidateQueries({ queryKey: ["csg", "documents", projectId] });
      setSelectedId(documentId);
    },
  });

  // 3) Preview testo estratto
  const textQuery = useQuery({
    queryKey: ["csg", "document-text", projectId, selectedId],
    enabled: !!selectedId && !!selectedDoc?.processed,
    queryFn: async () =>
      clientFetch<{ ok: true; text: string }>(
        `/api/projects/${projectId}/documents/${selectedId}/text`,
      ),
  });

  // 4) Scope AI (genera analysis)
  const scopeMutation = useMutation({
    mutationFn: async () =>
      clientFetch<{ ok: true; result: ScopeResult }>(
        `/api/projects/${projectId}/documents/${selectedId}/scope`,
        { method: "POST" },
      ),
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

  const scopeResult = scopeMutation.data?.result;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* COLONNA SINISTRA: LISTA */}
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

      {/* COLONNA DESTRA: PREVIEW + AI */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Preview testo estratto</p>
            <p className="mt-1 text-xs text-zinc-500">
              Seleziona un documento. L’AI funziona solo su “Processed”.
            </p>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-3">
          {!selectedId || !selectedDoc ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              Nessun documento selezionato.
            </div>
          ) : !selectedDoc.processed ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
              Questo documento è ancora <b>Raw</b>. Premi “Estrai” a sinistra.
            </div>
          ) : textQuery.isLoading ? (
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
          )}
        </div>

        {/* ✅ BOTTONE AI: QUI, dentro al box di destra */}
        <button
          disabled={
            !selectedId || !selectedDoc?.processed || scopeMutation.isPending
          }
          onClick={() => scopeMutation.mutate()}
          className="mt-3 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {scopeMutation.isPending
            ? "Analisi in corso..."
            : "Genera Scope Bullets"}
        </button>

        {/* ✅ RISULTATO AI: QUI, sotto al bottone */}
        {scopeMutation.isError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {(scopeMutation.error as Error).message}
          </div>
        )}

        {scopeResult && (
          <div className="mt-4 space-y-3 text-sm">
            <Section title="IN scope" items={scopeResult.included} badge="IN" />
            <Section
              title="OUT scope"
              items={scopeResult.excluded}
              badge="OUT"
            />
            <Section title="Ambiguità" items={scopeResult.unclear} badge="?" />

            {scopeResult.notes && (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <strong>Note:</strong> {scopeResult.notes}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Helper UI: sezione lista bullet con chunk evidence */
function Section({
  title,
  items,
  badge,
}: {
  title: string;
  items: { text: string; chunk: number }[];
  badge: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
        <div className="font-semibold">{title}</div>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
          {badge}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="px-3 py-3 text-xs text-zinc-500">Nessun elemento.</div>
      ) : (
        <ul className="space-y-2 px-3 py-3">
          {items.map((it, i) => (
            <li key={i} className="rounded-lg bg-zinc-50 p-2">
              <div className="text-sm">{it.text}</div>
              <div className="mt-1 text-[11px] text-zinc-500">
                Evidence: chunk {it.chunk}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
