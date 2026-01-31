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

type ScopeModule = {
  name: string;
  includes?: ScopeItem[];
  excludes?: ScopeItem[];
  unclear?: ScopeItem[];
};

type ScopePhase = {
  name: string;
  timeframe?: string;
  modules?: ScopeModule[];
};

type ScopeResult = {
  project?: { name?: string; technologies?: string[] };
  phases?: ScopePhase[];
  options?: { name: string; details?: { text: string; chunk: number } }[];
  future_phases?: { name: string; details?: { text: string; chunk: number } }[];
  notes?: string;
};

type RequestCheckResult = {
  verdict: "IN_SCOPE" | "OUT_OF_SCOPE" | "UNCLEAR";
  reasons?: ScopeItem[];
  missingInfo?: ScopeItem[];
  suggestedReply?: string;
  confidence?: number;
  assumptions?: ScopeItem[];
};

type RequestCheckItem = {
  id: string;
  createdAt: string;
  input: string;
  result: RequestCheckResult;
};

function dedupe(items: ScopeItem[]) {
  const seen = new Set<string>();
  const out: ScopeItem[] = [];
  for (const it of items) {
    if (!it || typeof it.text !== "string" || typeof it.chunk !== "number")
      continue;
    const key = `${it.chunk}::${it.text.trim()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ text: it.text, chunk: it.chunk });
  }
  return out;
}

function flattenScope(scope: ScopeResult | null): {
  included: ScopeItem[];
  excluded: ScopeItem[];
  unclear: ScopeItem[];
  notes?: string;
} {
  if (!scope) return { included: [], excluded: [], unclear: [] };

  const included: ScopeItem[] = [];
  const excluded: ScopeItem[] = [];
  const unclear: ScopeItem[] = [];

  const phases = Array.isArray(scope.phases) ? scope.phases : [];
  for (const p of phases) {
    const modules = Array.isArray(p?.modules) ? p.modules : [];
    for (const m of modules) {
      const inc = Array.isArray(m?.includes) ? m.includes : [];
      const exc = Array.isArray(m?.excludes) ? m.excludes : [];
      const unc = Array.isArray(m?.unclear) ? m.unclear : [];

      // ✅ costruisci UN item “umano” per modulo
      if (typeof m?.name === "string" && m.name.trim().length > 0) {
        const meta = inc
          .map((x) => (typeof x?.text === "string" ? x.text.trim() : ""))
          .filter(Boolean)
          .join(" • ");

        included.push({
          text: meta ? `${m.name} — ${meta}` : m.name,
          chunk: inc[0]?.chunk ?? 0,
        });
      }

      // ✅ questi rimangono separati (se mai li userai)
      excluded.push(...exc);
      unclear.push(...unc);
    }
  }

  return {
    included: dedupe(included),
    excluded: dedupe(excluded),
    unclear: dedupe(unclear),
    notes: typeof scope.notes === "string" ? scope.notes : undefined,
  };
}

export default function DocumentsList({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [requestText, setRequestText] = useState("");

  // 1) Lista documenti
  const { data, isLoading } = useQuery({
    queryKey: ["csg", "documents", projectId],
    queryFn: async () =>
      clientFetch<{ ok: true; documents: Doc[] }>(
        `/api/projects/${projectId}/documents`,
      ),
  });

  const docs = data?.documents ?? [];

  // seleziona automaticamente il primo processed (o il primo in lista)
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

  // 4) Scope (GET)
  const scopeQuery = useQuery({
    queryKey: ["csg", "scope", projectId, selectedId],
    enabled: !!selectedId && !!selectedDoc?.processed,
    queryFn: async () =>
      clientFetch<{ ok: true; result: ScopeResult | null }>(
        `/api/projects/${projectId}/documents/${selectedId}/scope`,
      ),
  });

  // 5) Scope AI (POST) -> salva su DB, poi invalida GET
  const scopeMutation = useMutation({
    mutationFn: async () =>
      clientFetch<{ ok: true; result: ScopeResult }>(
        `/api/projects/${projectId}/documents/${selectedId}/scope`,
        { method: "POST" },
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["csg", "scope", projectId, selectedId],
      });
    },
  });

  const scopeResult = scopeQuery.data?.result ?? null;
  const flatScope = useMemo(() => flattenScope(scopeResult), [scopeResult]);

  // 6) Request Check history (GET)
  const requestHistoryQuery = useQuery({
    queryKey: ["csg", "request-checks", projectId, selectedId],
    enabled: !!selectedId && !!selectedDoc?.processed,
    queryFn: async () =>
      clientFetch<{ ok: true; items: RequestCheckItem[] }>(
        `/api/projects/${projectId}/documents/${selectedId}/request-check`,
      ),
  });

  // 7) Request Check (POST)
  const requestCheckMutation = useMutation({
    mutationFn: async () =>
      clientFetch<{ ok: true; item: RequestCheckItem }>(
        `/api/projects/${projectId}/documents/${selectedId}/request-check`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ request: requestText }),
        },
      ),
    onSuccess: async () => {
      setRequestText("");
      await qc.invalidateQueries({
        queryKey: ["csg", "request-checks", projectId, selectedId],
      });
    },
  });

  // reset requestText quando cambi documento
  useEffect(() => {
    setRequestText("");
  }, [selectedId]);

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

  const latestCheck = requestHistoryQuery.data?.items?.[0] ?? null;

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

      {/* COLONNA DESTRA: PREVIEW + SCOPE + REQUEST CHECK */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Preview testo estratto</p>
            <p className="mt-1 text-xs text-zinc-500">
              Seleziona un documento. AI solo su “Processed”.
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

        {/* SCOPE BUTTON */}
        <button
          disabled={
            !selectedId || !selectedDoc?.processed || scopeMutation.isPending
          }
          onClick={() => scopeMutation.mutate()}
          className="mt-3 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {scopeMutation.isPending
            ? "Analisi in corso..."
            : scopeResult
              ? "Rigenera Scope"
              : "Genera Scope"}
        </button>

        {/* SCOPE STATUS */}
        {selectedDoc?.processed && (
          <div className="mt-3 text-xs text-zinc-500">
            {scopeQuery.isLoading
              ? "Caricamento scope..."
              : scopeResult
                ? "Scope salvato ✅"
                : "Nessuno scope salvato ancora."}
          </div>
        )}

        {scopeMutation.isError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {(scopeMutation.error as Error).message}
          </div>
        )}

        {/* SCOPE RESULT (flat, come prima) */}
        {scopeResult && (
          <div className="mt-4 space-y-3 text-sm">
            <Section title="IN scope" items={flatScope.included} badge="IN" />
            <Section title="OUT scope" items={flatScope.excluded} badge="OUT" />
            <Section title="Ambiguità" items={flatScope.unclear} badge="?" />

            {flatScope.notes ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <strong>Note:</strong> {flatScope.notes}
              </div>
            ) : null}
          </div>
        )}

        {/* REQUEST CHECK */}
        <div className="mt-6 rounded-2xl border border-zinc-200 bg-white p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">Client Request Check</p>
              <p className="mt-1 text-xs text-zinc-500">
                Incolla la richiesta: verdict + evidence + risposta suggerita.
              </p>
            </div>
          </div>

          <textarea
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            placeholder="Es: Potete includere anche manutenzione 12 mesi e hosting?"
            className="mt-3 h-24 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm outline-none focus:border-zinc-400"
          />

          <button
            disabled={
              !selectedId ||
              !selectedDoc?.processed ||
              !scopeResult ||
              requestCheckMutation.isPending ||
              requestText.trim().length < 10
            }
            onClick={() => requestCheckMutation.mutate()}
            className="mt-3 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {requestCheckMutation.isPending
              ? "Check in corso..."
              : "Verifica richiesta"}
          </button>

          {requestCheckMutation.isError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {(requestCheckMutation.error as Error).message}
            </div>
          )}

          {/* RISULTATO ULTIMO CHECK */}
          {requestHistoryQuery.data?.items?.[0] && (
            <RequestCheckCard item={requestHistoryQuery.data.items[0]} />
          )}

          {/* STORICO */}
          <div className="mt-4">
            <div className="text-xs font-semibold text-zinc-600">
              Storico (ultimi 20)
            </div>

            {requestHistoryQuery.isLoading ? (
              <div className="mt-2 h-10 animate-pulse rounded-xl bg-zinc-100" />
            ) : (requestHistoryQuery.data?.items?.length ?? 0) === 0 ? (
              <div className="mt-2 text-xs text-zinc-500">
                Nessun check ancora.
              </div>
            ) : (
              <div className="mt-2 space-y-2">
                {requestHistoryQuery.data!.items.slice(0, 5).map((it) => (
                  <div
                    key={it.id}
                    className="rounded-xl border border-zinc-200 bg-zinc-50 p-2"
                  >
                    <div className="text-xs text-zinc-500">
                      {new Date(it.createdAt).toLocaleString("it-IT")}
                    </div>
                    <div className="mt-1 text-sm">{it.input}</div>
                    <div className="mt-1 text-xs font-semibold text-zinc-700">
                      {it.result.verdict}
                      {typeof it.result.confidence === "number"
                        ? ` • conf ${it.result.confidence.toFixed(2)}`
                        : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Helper UI: sezione lista bullet con chunk evidence (SAFE) */
function Section({
  title,
  items,
  badge,
}: {
  title: string;
  items?: { text: string; chunk: number }[];
  badge: string;
}) {
  const safeItems = Array.isArray(items) ? items : [];

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
        <div className="font-semibold">{title}</div>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-700">
          {badge}
        </span>
      </div>

      {safeItems.length === 0 ? (
        <div className="px-3 py-3 text-xs text-zinc-500">Nessun elemento.</div>
      ) : (
        <ul className="space-y-2 px-3 py-3">
          {safeItems.map((it, i) => (
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

function RequestCheckCard({ item }: { item: RequestCheckItem }) {
  const v = item.result.verdict;

  const badgeClass =
    v === "IN_SCOPE"
      ? "bg-emerald-100 text-emerald-700"
      : v === "OUT_OF_SCOPE"
        ? "bg-red-100 text-red-700"
        : "bg-amber-100 text-amber-700";

  return (
    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">Risultato</div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badgeClass}`}
        >
          {v}
        </span>
      </div>

      <div className="mt-2 rounded-xl border border-zinc-200 bg-zinc-50 p-2 text-sm">
        {item.input}
      </div>

      <div className="mt-3 space-y-3 text-sm">
        <Section title="Motivi" items={item.result.reasons} badge="✓" />
        <Section
          title="Info mancanti"
          items={item.result.missingInfo}
          badge="?"
        />

        {Array.isArray(item.result.assumptions) &&
        item.result.assumptions.length > 0 ? (
          <Section
            title="Assunzioni"
            items={item.result.assumptions}
            badge="A"
          />
        ) : null}

        {item.result.suggestedReply ? (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="text-xs font-semibold text-zinc-600">
              Risposta suggerita
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm text-zinc-800">
              {item.result.suggestedReply}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
