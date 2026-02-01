"use client";

import React, { use, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clientFetch } from "@/lib/http/clientFetch";
import { upload } from "@vercel/blob/client";
import { MarkdownReport } from "./MarkdownReport";

type Doc = {
  id: string;
  originalName: string;
  mimeType: string;
  blobUrl: string;
  isActive: boolean;
  createdAt: string;
  status?: "UPLOADED" | "AI_READY" | "ERROR";
  openaiFileId?: string | null;
  vectorStoreId?: string | null;
};

type RiskItem = {
  id: string;
  createdAt: string;
  result: { markdown?: string } | any;
  inputMeta?: any;
};

type ScopeCheckItem = {
  id: string;
  createdAt: string;
  request: string;
  result: { markdown?: string } | any;
};

type GeneratedProposalItem = {
  id: string;
  createdAt: string;
  documentId: string;
  filename: string;
  blobUrl: string;
};

function StatusBadge({ status }: { status?: string }) {
  const s = status ?? "UPLOADED";
  const cls =
    s === "AI_READY"
      ? "bg-emerald-100 text-emerald-700"
      : s === "ERROR"
        ? "bg-red-100 text-red-700"
        : "bg-zinc-100 text-zinc-700";
  const label =
    s === "AI_READY" ? "AI_READY" : s === "ERROR" ? "ERROR" : "UPLOADED";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function getMarkdown(result: any): string {
  // nuovo formato: { markdown: "..." }
  if (result && typeof result.markdown === "string") return result.markdown;

  // fallback per vecchi record (se avevi reportMarkdown o simili)
  if (result && typeof result.reportMarkdown === "string")
    return result.reportMarkdown;

  // fallback estremo: stringa "raw"
  if (typeof result === "string") return result;

  return "";
}

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const qc = useQueryClient();

  const [fileErr, setFileErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [scopeReq, setScopeReq] = useState("");

  // ---- Documents (GET)
  const docsQuery = useQuery({
    queryKey: ["project-documents", projectId],
    queryFn: async () =>
      clientFetch<{ ok: true; documents: Doc[] }>(
        `/api/projects/${projectId}/documents`,
      ),
  });

  const docs = docsQuery.data?.documents ?? [];
  const activeDoc = useMemo(() => docs.find((d) => d.isActive) ?? null, [docs]);

  const isReady = !!activeDoc && activeDoc.status === "AI_READY";
  const isErrored = !!activeDoc && activeDoc.status === "ERROR";
  const isUploaded = !!activeDoc && activeDoc.status === "UPLOADED";

  // ---- Create Document (POST)
  const createDocMutation = useMutation({
    mutationFn: async (payload: {
      originalName: string;
      mimeType: string;
      blobUrl: string;
    }) =>
      clientFetch<{ ok: true; document: Doc }>(
        `/api/projects/${projectId}/documents`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["project-documents", projectId],
      });
      await qc.invalidateQueries({ queryKey: ["risk-history", projectId] });
      await qc.invalidateQueries({ queryKey: ["scope-history", projectId] });
      await qc.invalidateQueries({ queryKey: ["proposal-history", projectId] });
    },
  });

  // ---- Prepare active doc (OpenAI file + VectorStore + poll -> AI_READY)
  const prepareMutation = useMutation({
    mutationFn: async (documentId: string) =>
      clientFetch<{ ok: true; document: Doc }>(
        `/api/projects/${projectId}/documents/${documentId}/prepare`,
        { method: "POST" },
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({
        queryKey: ["project-documents", projectId],
      });
    },
  });

  async function onPickFile(file: File | null) {
    if (!file) return;

    setFileErr(null);

    const allowed = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (!allowed.includes(file.type)) {
      setFileErr("Formato non supportato. Carica PDF o DOCX.");
      return;
    }

    // max 20MB (MVP)
    if (file.size > 20 * 1024 * 1024) {
      setFileErr("File troppo grande (max 20MB).");
      return;
    }

    setUploading(true);

    try {
      // 1) Upload diretto a Vercel Blob
      const blob = await upload(
        `projects/${projectId}/${Date.now()}_${file.name}`.replaceAll(" ", "_"),
        file,
        {
          access: "public",
          handleUploadUrl: "/api/blob/upload",
        },
      );

      // 2) Crea Document su DB (disattiva altri, 1 attivo)
      const created = await createDocMutation.mutateAsync({
        originalName: file.name,
        mimeType: file.type,
        blobUrl: blob.url,
      });

      const newDocId = created?.document?.id;
      if (!newDocId) throw new Error("Document create failed (missing id)");

      // 3) Prepare: upload OpenAI + vector store + poll -> AI_READY
      await prepareMutation.mutateAsync(newDocId);

      // 4) refresh histories
      await qc.invalidateQueries({ queryKey: ["risk-history", projectId] });
      await qc.invalidateQueries({ queryKey: ["scope-history", projectId] });
      await qc.invalidateQueries({ queryKey: ["proposal-history", projectId] });
    } catch (e) {
      setFileErr((e as Error).message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  // ---- Risk history
  const riskHistoryQuery = useQuery({
    queryKey: ["risk-history", projectId],
    queryFn: async () =>
      clientFetch<{ ok: true; items: RiskItem[] }>(
        `/api/projects/${projectId}/risk-analysis`,
      ),
  });

  // ---- Scope history
  const scopeHistoryQuery = useQuery({
    queryKey: ["scope-history", projectId],
    queryFn: async () =>
      clientFetch<{ ok: true; items: ScopeCheckItem[] }>(
        `/api/projects/${projectId}/scope-check`,
      ),
  });

  // ---- Run risk
  const riskMutation = useMutation({
    mutationFn: async () =>
      clientFetch<{ ok: true; item: RiskItem }>(
        `/api/projects/${projectId}/risk-analysis`,
        { method: "POST" },
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["risk-history", projectId] });
      await qc.invalidateQueries({ queryKey: ["proposal-history", projectId] });
    },
  });

  // ---- Run scope check
  const scopeMutation = useMutation({
    mutationFn: async () =>
      clientFetch<{ ok: true; item: ScopeCheckItem }>(
        `/api/projects/${projectId}/scope-check`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ request: scopeReq }),
        },
      ),
    onSuccess: async () => {
      setScopeReq("");
      await qc.invalidateQueries({ queryKey: ["scope-history", projectId] });
    },
  });

  const latestRisk = riskHistoryQuery.data?.items?.[0] ?? null;
  const latestScope = scopeHistoryQuery.data?.items?.[0] ?? null;

  // ✅ bottone proposal solo se esiste una risk analysis
  // Nota: senza documentId nel payload risk, questa è “almeno una risk nel progetto”.
  const hasRiskForActiveDoc = useMemo(() => {
    if (!activeDoc) return false;
    const items = riskHistoryQuery.data?.items ?? [];
    return items.length > 0;
  }, [activeDoc, riskHistoryQuery.data?.items]);

  const uploadDisabled =
    uploading || createDocMutation.isPending || prepareMutation.isPending;

  // ---- Generated proposals history
  const proposalHistoryQuery = useQuery({
    queryKey: ["proposal-history", projectId],
    queryFn: async () =>
      clientFetch<{ ok: true; items: GeneratedProposalItem[] }>(
        `/api/projects/${projectId}/generated-proposal`,
      ),
  });

  // ---- Generate proposal
  const generateProposalMutation = useMutation({
    mutationFn: async () =>
      clientFetch<{ ok: true; item: GeneratedProposalItem }>(
        `/api/projects/${projectId}/generated-proposal`,
        { method: "POST" },
      ),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["proposal-history", projectId] });
    },
  });

  const latestProposal = proposalHistoryQuery.data?.items?.[0] ?? null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl font-extrabold tracking-tight text-zinc-900">
            Dettaglio progetto
          </div>
          <div className="mt-1 text-sm text-zinc-500">
            Carica un preventivo (PDF/DOCX). Il sistema lo prepara (OpenAI +
            Vector Store) e poi puoi eseguire Risk Analysis e Scope Check.
          </div>
        </div>

        <a
          href="/dashboard"
          className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
        >
          ← Dashboard
        </a>
      </div>

      {/* Upload card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              Preventivo
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              Supportati: PDF, DOCX • max 20MB
            </div>
          </div>

          <label
            className={`cursor-pointer rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 ${
              uploadDisabled ? "pointer-events-none opacity-50" : ""
            }`}
          >
            {uploading || prepareMutation.isPending
              ? "Preparazione..."
              : "Carica file"}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
              disabled={uploadDisabled}
            />
          </label>
        </div>

        {fileErr && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {fileErr}
          </div>
        )}

        {/* Active doc */}
        <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          {!activeDoc ? (
            <div className="text-sm text-zinc-600">
              Nessun preventivo caricato.
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-semibold text-zinc-900">
                    {activeDoc.originalName}
                  </div>
                  <StatusBadge status={activeDoc.status} />
                </div>

                <div className="text-xs text-zinc-500">
                  {new Date(activeDoc.createdAt).toLocaleString("it-IT")} •{" "}
                  {activeDoc.mimeType} •{" "}
                  <span className="font-semibold">attivo</span>
                </div>

                {isUploaded && (
                  <div className="text-xs text-zinc-600">
                    In preparazione: upload su OpenAI + indicizzazione…
                  </div>
                )}

                {isErrored && (
                  <div className="text-xs text-red-700">
                    Preparazione fallita. Premi “Riprova preparazione”.
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={activeDoc.blobUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                >
                  Apri
                </a>

                {activeDoc.status !== "AI_READY" && (
                  <button
                    type="button"
                    disabled={prepareMutation.isPending}
                    onClick={() => prepareMutation.mutate(activeDoc.id)}
                    className="rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    {prepareMutation.isPending
                      ? "Preparando..."
                      : "Riprova preparazione"}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {prepareMutation.isError && (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {(prepareMutation.error as Error).message}
          </div>
        )}
      </div>

      {/* ACTIONS */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Risk */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-5">
          <div>
            <div className="text-sm font-semibold text-zinc-900">
              Contract Risk Analysis
            </div>
            <div className="mt-1 text-xs text-zinc-500">
              Analizza criticità e rischi (salvato nello storico). Richiede
              documento AI_READY.
            </div>
          </div>

          <button
            disabled={!isReady || riskMutation.isPending}
            onClick={() => riskMutation.mutate()}
            className="mt-4 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
          >
            {!isReady
              ? "Documento non pronto (AI_READY richiesto)"
              : riskMutation.isPending
                ? "Analisi..."
                : "Esegui Risk Analysis"}
          </button>

          {riskMutation.isError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {(riskMutation.error as Error).message}
            </div>
          )}

          {latestRisk && (
            <MarkdownCard
              title="Ultimo risultato"
              createdAt={latestRisk.createdAt}
              markdown={getMarkdown(latestRisk.result)}
            />
          )}
        </div>

        {/* Proposal + Scope */}
        <div className="space-y-4">
          {/* Generated Proposal */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div>
              <div className="text-sm font-semibold text-zinc-900">
                Preventivo ottimizzato
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Genera una versione ottimizzata e scaricabile (DOCX). Richiede
                documento AI_READY + Risk Analysis.
              </div>
            </div>

            <button
              disabled={
                !isReady ||
                !hasRiskForActiveDoc ||
                generateProposalMutation.isPending
              }
              onClick={() => generateProposalMutation.mutate()}
              className="mt-4 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {!isReady
                ? "Documento non pronto (AI_READY richiesto)"
                : !hasRiskForActiveDoc
                  ? "Esegui prima la Risk Analysis"
                  : generateProposalMutation.isPending
                    ? "Generazione..."
                    : "Genera versione ottimizzata"}
            </button>

            {isReady && !hasRiskForActiveDoc && (
              <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Per generare la versione ottimizzata serve prima una Risk
                Analysis (usata come checklist).
              </div>
            )}

            {generateProposalMutation.isError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {(generateProposalMutation.error as Error).message}
              </div>
            )}

            {/* ✅ QUI: solo link download, niente markdown */}
            {latestProposal && (
              <div className="mt-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-900 truncate">
                      {latestProposal.filename}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {new Date(latestProposal.createdAt).toLocaleString(
                        "it-IT",
                      )}
                    </div>
                  </div>

                  <a
                    href={latestProposal.blobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded-xl bg-zinc-900 px-3 py-2 text-sm font-semibold text-white hover:bg-zinc-800"
                  >
                    Scarica versione ottimizzata
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Scope */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-5">
            <div>
              <div className="text-sm font-semibold text-zinc-900">
                Scope Check
              </div>
              <div className="mt-1 text-xs text-zinc-500">
                Incolla una richiesta del cliente e verifica se è in scope.
                Richiede documento AI_READY.
              </div>
            </div>

            <textarea
              value={scopeReq}
              onChange={(e) => setScopeReq(e.target.value)}
              placeholder="Es: login email/password senza social è incluso?"
              className="mt-4 h-24 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-black outline-none focus:border-zinc-400"
              disabled={!isReady}
            />

            <button
              disabled={
                !isReady ||
                scopeMutation.isPending ||
                scopeReq.trim().length < 6
              }
              onClick={() => scopeMutation.mutate()}
              className="mt-3 w-full rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50"
            >
              {!isReady
                ? "Documento non pronto (AI_READY richiesto)"
                : scopeMutation.isPending
                  ? "Check..."
                  : "Verifica richiesta"}
            </button>

            {scopeMutation.isError && (
              <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {(scopeMutation.error as Error).message}
              </div>
            )}

            {latestScope && (
              <MarkdownCard
                title="Ultimo risultato"
                createdAt={latestScope.createdAt}
                markdown={getMarkdown(latestScope.result)}
              />
            )}
          </div>
        </div>
      </div>

      {/* HISTORIES (accordion) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <HistoryAccordion
          title="Storico Contract Risk Analysis"
          subtitle="ultimi 20"
          loading={riskHistoryQuery.isLoading}
          items={riskHistoryQuery.data?.items ?? []}
          renderItem={(it: RiskItem) => (
            <HistoryItem
              createdAt={it.createdAt}
              markdown={getMarkdown(it.result)}
            />
          )}
        />

        <HistoryAccordion
          title="Storico Scope Check"
          subtitle="ultimi 20"
          loading={scopeHistoryQuery.isLoading}
          items={scopeHistoryQuery.data?.items ?? []}
          renderItem={(it: ScopeCheckItem) => (
            <div className="space-y-2">
              <div className="text-xs text-zinc-500">
                {new Date(it.createdAt).toLocaleString("it-IT")}
              </div>
              <div className="text-sm text-zinc-900">{it.request}</div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <MarkdownReport markdown={getMarkdown(it.result)} />
              </div>
            </div>
          )}
        />
      </div>

      {/* Upload history */}
      <div className="rounded-2xl border border-zinc-200 bg-white">
        <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
          <div className="text-sm font-semibold text-zinc-900">
            Storico upload
          </div>
          <div className="text-xs text-zinc-500">{docs.length} file</div>
        </div>

        {docsQuery.isLoading ? (
          <div className="p-4">
            <div className="h-20 animate-pulse rounded-xl bg-zinc-100" />
          </div>
        ) : docs.length === 0 ? (
          <div className="p-6 text-sm text-zinc-500">
            Nessun file nello storico.
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {docs.map((d) => (
              <li key={d.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="truncate text-sm font-semibold text-zinc-900">
                        {d.originalName}
                      </div>
                      <StatusBadge status={d.status} />
                      {d.isActive ? (
                        <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white">
                          attivo
                        </span>
                      ) : null}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {new Date(d.createdAt).toLocaleString("it-IT")}
                    </div>
                  </div>

                  <a
                    href={d.blobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50"
                  >
                    Apri
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ----------------- UI Helpers ----------------- */

function MarkdownCard({
  title,
  createdAt,
  markdown,
}: {
  title: string;
  createdAt: string;
  markdown: string;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="text-sm font-semibold text-black">{title}</div>
        <div className="text-xs text-zinc-500">
          {new Date(createdAt).toLocaleString("it-IT")}
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        <MarkdownReport markdown={markdown} />
      </div>
    </div>
  );
}

function HistoryItem({
  createdAt,
  markdown,
}: {
  createdAt: string;
  markdown: string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-zinc-500">
        {new Date(createdAt).toLocaleString("it-IT")}
      </div>
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        <MarkdownReport markdown={markdown} />
      </div>
    </div>
  );
}

function HistoryAccordion<T>({
  title,
  subtitle,
  loading,
  items,
  renderItem,
}: {
  title: string;
  subtitle?: string;
  loading: boolean;
  items: T[];
  renderItem: (it: T) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const list = (items as any[]).slice(0, 20);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3 text-left hover:bg-zinc-50 transition-colors"
      >
        <div className="text-sm font-semibold text-zinc-900">{title}</div>
        <div className="flex items-center gap-2">
          {subtitle && (
            <span className="text-xs text-zinc-500">{subtitle}</span>
          )}
          <span
            className={`inline-block text-zinc-500 transition-transform ${
              open ? "rotate-180" : ""
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
      </button>

      {open && (
        <>
          {loading ? (
            <div className="p-4">
              <div className="h-20 animate-pulse rounded-xl bg-zinc-100" />
            </div>
          ) : list.length === 0 ? (
            <div className="p-6 text-sm text-zinc-500">Nessun elemento.</div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {list.map((it: any) => (
                <li key={it.id} className="px-4 py-3">
                  {renderItem(it)}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
